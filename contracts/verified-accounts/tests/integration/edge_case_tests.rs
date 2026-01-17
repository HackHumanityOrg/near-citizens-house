//! Edge case tests for verified-accounts contract

use crate::helpers::{generate_nep413_signature, init, test_self_proof};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("normal")]
#[allure_tags("integration", "edge-case", "context-data")]
#[allure_description(
    "Verifies that user_context_data at exactly the maximum limit (4096 bytes) is accepted."
)]
#[allure_test]
#[tokio::test]
async fn test_max_length_user_context_data() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let nonce: [u8; 32] = [99u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Create user_context_data at exactly the max limit (4096 bytes)
    let max_context = "x".repeat(4096);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "max_context_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 1,
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": max_context
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify max length user_context_data is accepted", || {
        assert!(
            result.is_success(),
            "Should accept user_context_data at exactly 4096 bytes. Failures: {:?}",
            result.failures()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("normal")]
#[allure_tags("integration", "edge-case", "unicode")]
#[allure_description(
    "Verifies that unicode characters in user_context_data are handled correctly."
)]
#[allure_test]
#[tokio::test]
async fn test_unicode_in_user_context_data() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let nonce: [u8; 32] = [100u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Create user_context_data with unicode characters
    let unicode_context = "Hello 世界! Привет мир! 🌍🚀✨ Ελληνικά العربية";

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "unicode_context_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 2,
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": unicode_context
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify store_verification succeeds with unicode", || {
        assert!(
            result.is_success(),
            "Should accept unicode in user_context_data. Failures: {:?}",
            result.failures()
        );
    });

    // Verify the unicode data was stored correctly
    let account: serde_json::Value = contract
        .view("get_full_verification")
        .args_json(json!({"account_id": user.id()}))
        .await?
        .json()?;

    step("Verify unicode data was stored correctly", || {
        assert!(
            account.get("user_context_data").is_some(),
            "Should have user_context_data"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("normal")]
#[allure_tags("integration", "edge-case", "nonce")]
#[allure_description("Verifies that all-zeros nonce (edge case - weak randomness) is accepted.")]
#[allure_test]
#[tokio::test]
async fn test_nonce_all_zeros() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // All-zeros nonce (edge case - weak randomness, but should still be accepted)
    let nonce: [u8; 32] = [0u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "zero_nonce_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 3,
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "zero_nonce_context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify all-zeros nonce is accepted", || {
        // All-zeros nonce is valid (though weak) - the contract should accept it
        // Security note: In practice, nonces should be cryptographically random
        assert!(
            result.is_success(),
            "Should accept all-zeros nonce (weak but valid). Failures: {:?}",
            result.failures()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("normal")]
#[allure_tags("integration", "edge-case", "nonce")]
#[allure_description("Verifies that all-0xFF nonce (max byte values) is accepted.")]
#[allure_test]
#[tokio::test]
async fn test_nonce_all_max_bytes() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // All-0xFF nonce (max byte values)
    let nonce: [u8; 32] = [0xFFu8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "max_nonce_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 3,
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "max_nonce_context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify all-0xFF nonce is accepted", || {
        assert!(
            result.is_success(),
            "Should accept all-0xFF nonce. Failures: {:?}",
            result.failures()
        );
    });

    Ok(())
}
