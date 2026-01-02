//! Security tests for verified-accounts contract
//!
//! Tests for signature replay attack prevention, batch size limits, and storage economics.

use crate::helpers::{generate_nep413_signature, init, test_self_proof, WASM_PATH};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "replay-attack")]
#[allure_description("Verifies that signature replay attacks are prevented. Defense-in-depth ensures both account-already-verified and signature-already-used checks catch replay attempts.")]
#[allure_test]
#[tokio::test]
async fn test_signature_replay_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [42u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // First verification should succeed
    let first_result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "replay_test_nullifier_1",
            "near_account_id": user.id(),
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature.clone(),
                "public_key": public_key.clone(),
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient.clone()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context1"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify first verification succeeds", || {
        assert!(
            first_result.is_success(),
            "First verification failed: {:?}",
            first_result.failures()
        );
    });

    // Now try to replay the EXACT SAME signature with a DIFFERENT nullifier
    // In a scenario where the account check might be bypassed, the signature tracking
    // provides a second layer of defense. In practice, the account check ("NEAR account
    // already verified") will catch this first, but signature tracking adds defense-in-depth.
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "replay_test_nullifier_2", // Different nullifier - trying to bypass nullifier check
            "near_account_id": user.id(),           // Same account
            "attestation_id": "2",
            "signature_data": {
                "account_id": user.id(),            // Same account
                "signature": signature.clone(),     // SAME signature!
                "public_key": public_key.clone(),   // Same public key
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify signature replay is rejected", || {
        // This should fail - the signature tracking or account check will catch it
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(
            failure_msg.contains("Signature already used"),
            "Expected replay to be rejected by signature tracking, got: {}",
            failure_msg
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("normal")]
#[allure_tags("integration", "security", "batch-limit")]
#[allure_description(
    "Verifies that are_verified enforces the batch size limit of 100 accounts."
)]
#[allure_test]
#[tokio::test]
async fn test_batch_size_limit_enforced() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // Create more than 100 account IDs
    let too_many_accounts: Vec<String> =
        (0..101).map(|i| format!("account{}.testnet", i)).collect();

    // Call are_verified with too many accounts - should fail
    let result = contract
        .view("are_verified")
        .args_json(json!({"account_ids": too_many_accounts}))
        .await;

    step("Verify batch size limit is enforced", || {
        // View call should fail due to assertion
        assert!(result.is_err(), "Expected batch size limit to be enforced");
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "storage", "economics")]
#[allure_description(
    "Verifies that verification storage fails when contract has insufficient available balance. \
     The NEAR protocol enforces storage costs at transaction commit time, preventing state \
     changes that would exceed the account's balance."
)]
#[allure_test]
#[tokio::test]
async fn test_insufficient_contract_balance_rejected() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;

    // Read WASM file
    let wasm = std::fs::read(WASM_PATH).expect(
        "Could not find WASM file. Please build the contract first with `cargo near build`",
    );

    // Create backend account (will have enough balance from dev_create_account)
    let backend = worker.dev_create_account().await?;

    // Create a contract account with plenty of balance for deployment
    let contract_account = worker
        .root_account()?
        .create_subaccount("lowbalance")
        .initial_balance(NearToken::from_near(5)) // 5 NEAR - plenty for deployment
        .transact()
        .await?
        .result;

    // Deploy contract
    let deploy_result = contract_account.deploy(&wasm).await?;
    let contract = deploy_result.result;

    step("Verify contract deployment succeeds", || {
        assert!(
            deploy_result.details.is_success(),
            "Contract deployment failed: {:?}",
            deploy_result.details.failures()
        );
    });

    // Initialize the contract with the backend wallet
    let init_result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .transact()
        .await?;

    step("Verify contract initialization succeeds", || {
        assert!(
            init_result.is_success(),
            "Contract initialization failed: {:?}",
            init_result.failures()
        );
    });

    // Drain the contract's balance by transferring most of it away.
    //
    // Storage costs on NEAR: 1 NEAR per 100KB (1e19 yoctoNEAR per byte)
    // The ~175KB WASM locks ~1.75 NEAR for code storage.
    // Each verification record needs ~7KB = ~0.07 NEAR additional storage.
    //
    // We transfer 3.235 NEAR from the 5 NEAR initial balance, leaving ~1.765 NEAR.
    // This is just above the code storage minimum but insufficient for additional data.
    let drain_result = contract_account
        .transfer_near(backend.id(), NearToken::from_millinear(3235))
        .await?;

    step("Verify balance drain succeeds", || {
        assert!(
            drain_result.is_success(),
            "Balance drain failed: {:?}",
            drain_result.failures()
        );
    });

    // Create a user account and generate a valid NEP-413 signature
    let user = worker.dev_create_account().await?;
    let nonce: [u8; 32] = [99u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Attempt to store verification - should fail due to insufficient balance
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "low_balance_test_nullifier",
            "near_account_id": user.id(),
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test_context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step(
        "Verify store_verification fails due to insufficient balance",
        || {
            assert!(
                result.is_failure(),
                "Expected store_verification to fail with insufficient balance"
            );

            // The NEAR protocol enforces storage costs at transaction commit time.
            // Even though the contract code may execute, the state changes are rejected
            // if the account lacks sufficient balance to cover storage costs.
            let failure_msg = format!("{:?}", result.failures());
            assert!(
                failure_msg.contains("LackBalanceForState"),
                "Expected LackBalanceForState error from NEAR protocol, got: {}",
                failure_msg
            );
        },
    );

    // Verify the verification was not stored (NEAR's atomic transactions ensure rollback)
    let count: u32 = contract.view("get_verified_count").await?.json()?;

    step("Verify no verification was stored (atomic rollback)", || {
        assert_eq!(
            count, 0,
            "Expected no verifications to be stored due to atomic rollback"
        );
    });

    Ok(())
}
