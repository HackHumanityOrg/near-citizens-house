//! Security tests for verified-accounts contract
//!
//! Tests for replay attempt rejection, batch size limits, and storage economics.

use crate::helpers::{generate_nep413_signature, init, nonce_to_base64, WASM_PATH};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "replay-attack")]
#[allure_description("Verifies that replay attempts are rejected by account uniqueness.")]
#[allure_test]
#[tokio::test]
async fn test_signature_replay_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [42u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // First verification should succeed
    let first_result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": "replay_test_sumsub_applicant_id_1",
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature.clone(),
                "public_key": public_key.clone(),
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient.clone()
            },
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

    // Now try to replay the EXACT SAME signature with a DIFFERENT SumSub applicant ID
    // Account uniqueness should reject this attempt.
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": "replay_test_sumsub_applicant_id_2", // Different SumSub applicant ID - trying to bypass check
            "near_account_id": user.id(),           // Same account
            "signature_data": {
                "account_id": user.id(),            // Same account
                "signature": signature.clone(),     // SAME signature!
                "public_key": public_key.clone(),   // Same public key
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient
            },
            "user_context_data": "context2"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify replay is rejected", || {
        // This should fail - the account uniqueness check should catch it
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(
            failure_msg.contains("NEAR account already verified"),
            "Expected replay to be rejected by account uniqueness, got: {}",
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
#[allure_description("Verifies that are_verified enforces the batch size limit of 100 accounts.")]
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
     changes that would exceed the account's balance. This test dynamically calculates the \
     drain amount based on actual storage usage to ensure reliability."
)]
#[allure_test]
#[tokio::test]
async fn test_insufficient_contract_balance_rejected() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;

    // Read WASM file
    let wasm = std::fs::read(WASM_PATH).expect(
        "Could not find WASM file. Please build the contract first with `cargo near build reproducible-wasm`",
    );

    // Create backend account (will have enough balance from dev_create_account)
    let backend = worker.dev_create_account().await?;

    // Create a contract account with plenty of balance for deployment and operations
    let contract_account = worker
        .root_account()?
        .create_subaccount("lowbalance")
        .initial_balance(NearToken::from_near(10)) // 10 NEAR - plenty of headroom
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

    // Query actual storage usage and balance after initialization
    // This ensures we calculate the correct drain amount regardless of WASM size variations
    let account_state = worker.view_account(contract.id()).await?;
    let current_balance = account_state.balance;
    let storage_usage = account_state.storage_usage; // in bytes

    // Storage cost on NEAR: 10^19 yoctoNEAR per byte (1 NEAR per 100KB)
    const STORAGE_PRICE_PER_BYTE: u128 = 10_000_000_000_000_000_000;

    // Calculate minimum required balance for current storage
    let min_for_storage = (storage_usage as u128) * STORAGE_PRICE_PER_BYTE;

    // Add a small buffer (0.001 NEAR) to ensure the transfer itself doesn't fail
    // but leave insufficient balance for additional storage (verification records need ~7KB)
    let buffer = NearToken::from_millinear(1).as_yoctonear(); // 0.001 NEAR
    let target_remaining = min_for_storage + buffer;

    // Calculate how much to drain
    let drain_amount = current_balance
        .as_yoctonear()
        .saturating_sub(target_remaining);

    step("Calculate and verify drain parameters", || {
        assert!(
            drain_amount > 0,
            "Contract doesn't have enough balance to drain. Balance: {}, Min required: {}",
            current_balance.as_yoctonear(),
            target_remaining
        );
    });

    // Drain the contract's balance to leave it with just enough for current storage
    let drain_result = contract_account
        .transfer_near(backend.id(), NearToken::from_yoctonear(drain_amount))
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
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Attempt to store verification - should fail due to insufficient balance
    // The error may occur at broadcast time (pre-validation) or execution time,
    // depending on exact balance and timing. Both are valid failures.
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": "low_balance_test_sumsub_applicant_id",
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient
            },
            "user_context_data": "test_context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await;

    // The transaction should fail - either at broadcast time or execution time
    // depending on exact balance calculations and NEAR protocol version
    step(
        "Verify store_verification fails due to insufficient balance",
        || {
            match &result {
                Ok(execution_result) => {
                    // Transaction was broadcast but should have failed during execution
                    assert!(
                        execution_result.is_failure(),
                        "Expected store_verification to fail with insufficient balance"
                    );
                    let failure_msg = format!("{:?}", execution_result.failures());
                    assert!(
                        failure_msg.contains("LackBalanceForState"),
                        "Expected LackBalanceForState error from NEAR protocol, got: {}",
                        failure_msg
                    );
                }
                Err(err) => {
                    // Transaction was rejected at broadcast time - also valid
                    let err_msg = err.to_string();
                    assert!(
                        err_msg.contains("LackBalanceForState"),
                        "Expected LackBalanceForState error, got: {}",
                        err_msg
                    );
                }
            }
        },
    );

    // Verify the verification was not stored (NEAR's atomic transactions ensure rollback)
    let count: u32 = contract.view("get_verified_count").await?.json()?;

    step(
        "Verify no verification was stored (atomic rollback)",
        || {
            assert_eq!(
                count, 0,
                "Expected no verifications to be stored due to atomic rollback"
            );
        },
    );

    Ok(())
}
