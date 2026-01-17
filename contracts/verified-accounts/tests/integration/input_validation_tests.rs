//! Input validation tests for verified-accounts contract

use crate::helpers::{init, nonce_to_base64, test_self_proof};
use allure_rs::prelude::*;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use near_workspaces::types::NearToken;
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("integration", "validation", "nonce")]
#[allure_description("Verifies that nonces with invalid length (not 32 bytes) are rejected.")]
#[allure_test]
#[tokio::test]
async fn test_invalid_nonce_length() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 1,
            "signature_data": {
                "account_id": user.id(),
                "signature": BASE64.encode([0u8; 64]),
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": BASE64.encode([0u8; 16]), // Invalid: should be 32 bytes
                "recipient": contract.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify invalid nonce length is rejected", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Nonce must be exactly 32 bytes"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("integration", "validation", "signature")]
#[allure_description("Verifies that signatures with invalid length (not 64 bytes) are rejected.")]
#[allure_test]
#[tokio::test]
async fn test_invalid_signature_length() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 1,
            "signature_data": {
                "account_id": user.id(),
                "signature": BASE64.encode([0u8; 32]), // Invalid: should be 64 bytes
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": nonce_to_base64(&[0u8; 32]),
                "recipient": contract.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify invalid signature length is rejected", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Signature must be 64 bytes"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("integration", "validation", "account-id")]
#[allure_description("Verifies that account ID mismatch between near_account_id and signature_data.account_id is rejected.")]
#[allure_test]
#[tokio::test]
async fn test_account_id_mismatch() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;
    let different_user = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(), // Trying to verify this account
            "attestation_id": 1,
            "signature_data": {
                "account_id": different_user.id(), // But signature is for different account
                "signature": BASE64.encode([0u8; 64]),
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": nonce_to_base64(&[0u8; 32]),
                "recipient": contract.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify account ID mismatch is rejected", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Signature account ID must match"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("integration", "validation", "recipient")]
#[allure_description("Verifies that signature_data.recipient must match the contract account.")]
#[allure_test]
#[tokio::test]
async fn test_recipient_mismatch() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;
    let different_recipient = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "attestation_id": 1,
            "signature_data": {
                "account_id": user.id(),
                "signature": BASE64.encode([0u8; 64]),
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": nonce_to_base64(&[0u8; 32]),
                "recipient": different_recipient.id() // Recipient mismatch
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify recipient mismatch is rejected", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Signature recipient must match contract account"));
    });

    Ok(())
}
