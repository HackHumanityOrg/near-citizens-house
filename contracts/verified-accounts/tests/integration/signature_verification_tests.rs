//! Signature verification tests for verified-accounts contract

use crate::helpers::{generate_nep413_signature, init, test_self_proof};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "signature")]
#[allure_description("Verifies that invalid signatures (all zeros) are rejected.")]
#[allure_test]
#[tokio::test]
async fn test_invalid_signature_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // This should fail because the signature doesn't match the message
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64], // Invalid signature (all zeros)
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": contract.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify invalid signature is rejected", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Invalid NEAR signature"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("integration", "verification", "signature")]
#[allure_description(
    "Verifies that valid NEP-413 signatures are accepted and verification is stored correctly."
)]
#[allure_test]
#[tokio::test]
async fn test_valid_signature_verification_succeeds() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [1u8; 32]; // Non-zero nonce for clarity
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Store verification with valid signature
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "valid_test_nullifier",
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
        "Verify store_verification succeeds with valid signature",
        || {
            assert!(
                result.is_success(),
                "store_verification failed: {:?}",
                result.failures()
            );
        },
    );

    // Verify the account is now marked as verified
    let is_verified: bool = contract
        .view("is_verified")
        .args_json(json!({"account_id": user.id()}))
        .await?
        .json()?;

    step("Verify account is now marked as verified", || {
        assert!(is_verified);
    });

    // Verify count increased
    let count: u64 = contract.view("get_verified_count").await?.json()?;

    step("Verify count increased to 1", || {
        assert_eq!(count, 1);
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "nullifier")]
#[allure_description(
    "Verifies that duplicate nullifiers are rejected to prevent double-verification."
)]
#[allure_test]
#[tokio::test]
async fn test_duplicate_nullifier_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;

    // Generate valid signatures for both users
    let nonce1: [u8; 32] = [1u8; 32];
    let nonce2: [u8; 32] = [2u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature1, public_key1) =
        generate_nep413_signature(&user1, challenge, &nonce1, &recipient);
    let (signature2, public_key2) =
        generate_nep413_signature(&user2, challenge, &nonce2, &recipient);

    // First verification should succeed
    let first_result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "duplicate_test_nullifier",
            "near_account_id": user1.id(),
            "attestation_id": "1",
            "signature_data": {
                "account_id": user1.id(),
                "signature": signature1,
                "public_key": public_key1,
                "challenge": challenge,
                "nonce": nonce1.to_vec(),
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

    // Second verification with same nullifier should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "duplicate_test_nullifier", // Same nullifier!
            "near_account_id": user2.id(),
            "attestation_id": "2",
            "signature_data": {
                "account_id": user2.id(),
                "signature": signature2,
                "public_key": public_key2,
                "challenge": challenge,
                "nonce": nonce2.to_vec(),
                "recipient": recipient.clone()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify duplicate nullifier is rejected", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Nullifier already used"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "duplicate")]
#[allure_description("Verifies that an already verified account cannot be verified again.")]
#[allure_test]
#[tokio::test]
async fn test_account_already_verified_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate valid signatures with different nonces
    let nonce1: [u8; 32] = [1u8; 32];
    let nonce2: [u8; 32] = [2u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature1, public_key1) =
        generate_nep413_signature(&user, challenge, &nonce1, &recipient);
    let (signature2, public_key2) =
        generate_nep413_signature(&user, challenge, &nonce2, &recipient);

    // First verification should succeed
    let first_result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "first_nullifier",
            "near_account_id": user.id(),
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature1,
                "public_key": public_key1,
                "challenge": challenge,
                "nonce": nonce1.to_vec(),
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

    // Second verification for same account should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "second_nullifier", // Different nullifier
            "near_account_id": user.id(),    // Same account!
            "attestation_id": "2",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature2,
                "public_key": public_key2,
                "challenge": challenge,
                "nonce": nonce2.to_vec(),
                "recipient": recipient.clone()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step(
        "Verify second verification for same account is rejected",
        || {
            assert!(result.is_failure());
            let failure_msg = format!("{:?}", result.failures());
            assert!(failure_msg.contains("NEAR account already verified"));
        },
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("integration", "read", "verification-data")]
#[allure_description("Verifies that get_full_verification returns the correct verification data.")]
#[allure_test]
#[tokio::test]
async fn test_get_full_verification_returns_data() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [42u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Store verification
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "data_test_nullifier",
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
            "user_context_data": "custom_context_data"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify store_verification succeeds", || {
        assert!(
            result.is_success(),
            "store_verification failed: {:?}",
            result.failures()
        );
    });

    // Get the verified account data
    let account_data: serde_json::Value = contract
        .view("get_full_verification")
        .args_json(json!({"account_id": user.id()}))
        .await?
        .json()?;

    step("Verify get_full_verification returns correct data", || {
        // Verify the returned data
        assert_eq!(
            account_data.get("attestation_id"),
            Some(&serde_json::json!("1"))
        );
        assert_eq!(
            account_data.get("user_context_data"),
            Some(&serde_json::json!("custom_context_data"))
        );
        assert!(account_data
            .get("verified_at")
            .is_some_and(|v| v.is_number()));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("integration", "read", "pagination")]
#[allure_description(
    "Verifies that list_verifications pagination works correctly with multiple verified accounts."
)]
#[allure_test]
#[tokio::test]
async fn test_list_verifications_pagination() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;

    // Create and verify 3 users
    let mut users = Vec::new();
    for i in 0..3 {
        let user = worker.dev_create_account().await?;
        let nonce: [u8; 32] = [i as u8; 32];
        let challenge = "Identify myself";
        let recipient = contract.id().to_string();

        let (signature, public_key) =
            generate_nep413_signature(&user, challenge, &nonce, &recipient);

        let result = backend
            .call(contract.id(), "store_verification")
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({
                "nullifier": format!("pagination_nullifier_{}", i),
                "near_account_id": user.id(),
                "attestation_id": format!("{}", i + 1),
                "signature_data": {
                    "account_id": user.id(),
                    "signature": signature,
                    "public_key": public_key,
                    "challenge": challenge,
                    "nonce": nonce.to_vec(),
                    "recipient": recipient
                },
                "self_proof": test_self_proof(),
                "user_context_data": format!("context_{}", i)
            }))
            .gas(Gas::from_tgas(100))
            .transact()
            .await?;

        assert!(
            result.is_success(),
            "Verification {} failed: {:?}",
            i,
            result.failures()
        );
        users.push(user);
    }

    // Verify total count
    let count: u64 = contract.view("get_verified_count").await?.json()?;

    step("Verify total count is 3", || {
        assert_eq!(count, 3);
    });

    // Test pagination - get first 2
    let page1: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 0, "limit": 2}))
        .await?
        .json()?;

    step("Verify first page returns 2 items", || {
        assert_eq!(page1.len(), 2);
    });

    // Test pagination - get remaining 1
    let page2: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 2, "limit": 2}))
        .await?
        .json()?;

    step("Verify second page returns 1 item", || {
        assert_eq!(page2.len(), 1);
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("integration", "verification", "attestation")]
#[allure_description("Test 2.6.5: Verifies that the same attestation_id can be used for different accounts (not a unique constraint).")]
#[allure_test]
#[tokio::test]
async fn test_allow_same_attestation_id_different_accounts() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;

    // Generate valid signatures for both users
    let nonce1: [u8; 32] = [3u8; 32];
    let nonce2: [u8; 32] = [4u8; 32];
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();

    let (signature1, public_key1) =
        generate_nep413_signature(&user1, challenge, &nonce1, &recipient);
    let (signature2, public_key2) =
        generate_nep413_signature(&user2, challenge, &nonce2, &recipient);

    // First verification with attestation_id "1"
    let first_result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "attestation_test_nullifier_1",
            "near_account_id": user1.id(),
            "attestation_id": "1",  // Same attestation_id
            "signature_data": {
                "account_id": user1.id(),
                "signature": signature1,
                "public_key": public_key1,
                "challenge": challenge,
                "nonce": nonce1.to_vec(),
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

    // Second verification with same attestation_id but different account
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "attestation_test_nullifier_2",  // Different nullifier
            "near_account_id": user2.id(),                 // Different account
            "attestation_id": "1",                         // Same attestation_id!
            "signature_data": {
                "account_id": user2.id(),
                "signature": signature2,
                "public_key": public_key2,
                "challenge": challenge,
                "nonce": nonce2.to_vec(),
                "recipient": recipient.clone()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step(
        "Verify same attestation_id for different accounts is allowed",
        || {
            // Should succeed - attestation_id is not a unique constraint
            assert!(
                result.is_success(),
                "Same attestation_id for different accounts should be allowed. Failures: {:?}",
                result.failures()
            );
        },
    );

    Ok(())
}
