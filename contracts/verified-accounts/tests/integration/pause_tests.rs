//! Pause functionality tests for verified-accounts contract

use crate::helpers::{generate_nep413_signature, init, test_self_proof};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "pause")]
#[allure_description("Verifies that storing verifications is blocked when the contract is paused.")]
#[allure_test]
#[tokio::test]
async fn test_store_verification_when_paused() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Pause the contract (requires 1 yocto deposit)
    let pause_result = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify pause succeeds", || {
        assert!(
            pause_result.is_success(),
            "Pause failed: {:?}",
            pause_result.failures()
        );
    });

    // Try to store verification - should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64],
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify store_verification fails when paused", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Contract is paused"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "yocto")]
#[allure_description("Verifies that pause requires exactly 1 yoctoNEAR deposit.")]
#[allure_test]
#[tokio::test]
async fn test_pause_requires_one_yocto() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    let no_deposit = backend.call(contract.id(), "pause").transact().await?;

    step("Verify pause fails without deposit", || {
        assert!(no_deposit.is_failure());
        let failure_msg = format!("{:?}", no_deposit.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    let too_much = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(2))
        .transact()
        .await?;

    step("Verify pause fails with 2 yoctoNEAR", || {
        assert!(too_much.is_failure());
        let failure_msg = format!("{:?}", too_much.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    let is_paused: bool = contract.view("is_paused").await?.json()?;
    step(
        "Verify contract remains unpaused after failed attempts",
        || {
            assert!(!is_paused);
        },
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "yocto")]
#[allure_description("Verifies that unpause requires exactly 1 yoctoNEAR deposit.")]
#[allure_test]
#[tokio::test]
async fn test_unpause_requires_one_yocto() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Pause first with correct deposit
    backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    let no_deposit = backend.call(contract.id(), "unpause").transact().await?;

    step("Verify unpause fails without deposit", || {
        assert!(no_deposit.is_failure());
        let failure_msg = format!("{:?}", no_deposit.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    let too_much = backend
        .call(contract.id(), "unpause")
        .deposit(NearToken::from_yoctonear(2))
        .transact()
        .await?;

    step("Verify unpause fails with 2 yoctoNEAR", || {
        assert!(too_much.is_failure());
        let failure_msg = format!("{:?}", too_much.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    let is_paused: bool = contract.view("is_paused").await?.json()?;
    step(
        "Verify contract remains paused after failed unpause attempts",
        || {
            assert!(is_paused);
        },
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "pause")]
#[allure_description("Test 2.7.2: Verifies that read operations (is_account_verified, get_verified_count, get_verified_accounts) still work when the contract is paused.")]
#[allure_test]
#[tokio::test]
async fn test_pause_allows_read_operations() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // First verify a user
    let nonce: [u8; 32] = [5u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "nullifier": "pause_read_test_nullifier",
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
            "user_context_data": "context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?
        .into_result()?;

    // Pause the contract
    backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    // Verify contract is paused
    let is_paused: bool = contract.view("is_paused").await?.json()?;

    step("Verify contract is paused", || {
        assert!(is_paused, "Contract should be paused");
    });

    // Read operations should still work while paused
    let is_verified: bool = contract
        .view("is_account_verified")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;

    step("Verify is_account_verified works when paused", || {
        assert!(
            is_verified,
            "Should return true for verified account even when paused"
        );
    });

    let count: u64 = contract.view("get_verified_count").await?.json()?;

    step("Verify get_verified_count works when paused", || {
        assert_eq!(count, 1, "Count should be accessible when paused");
    });

    let accounts: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 0, "limit": 10}))
        .await?
        .json()?;

    step("Verify get_verified_accounts works when paused", || {
        assert_eq!(
            accounts.len(),
            1,
            "get_verified_accounts should work when paused"
        );
    });

    Ok(())
}
