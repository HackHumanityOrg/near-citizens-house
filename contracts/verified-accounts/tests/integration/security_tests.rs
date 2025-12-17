//! Security tests for verified-accounts contract
//!
//! Tests for signature replay attack prevention and batch size limits.

use crate::helpers::{generate_nep413_signature, init, test_self_proof};
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
        // Multiple layers of defense - any of these would block the replay:
        // - "Signature already used" (signature tracking - our new defense)
        // - "NEAR account already verified" (existing account check)
        assert!(
            failure_msg.contains("Signature already used")
                || failure_msg.contains("NEAR account already verified"),
            "Expected replay to be rejected by defense-in-depth, got: {}",
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
#[allure_description("Verifies that are_accounts_verified enforces the batch size limit of 100 accounts.")]
#[allure_test]
#[tokio::test]
async fn test_batch_size_limit_enforced() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // Create more than 100 account IDs
    let too_many_accounts: Vec<String> =
        (0..101).map(|i| format!("account{}.testnet", i)).collect();

    // Call are_accounts_verified with too many accounts - should fail
    let result = contract
        .view("are_accounts_verified")
        .args_json(json!({"account_ids": too_many_accounts}))
        .await;

    step("Verify batch size limit is enforced", || {
        // View call should fail due to assertion
        assert!(result.is_err(), "Expected batch size limit to be enforced");
    });

    Ok(())
}
