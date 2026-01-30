//! Access control tests for verified-accounts contract

use crate::helpers::{init, nonce_to_base64};
use allure_rs::prelude::*;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use near_workspaces::types::NearToken;
use near_workspaces::AccountId;
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "authorization")]
#[allure_description(
    "Verifies that unauthorized accounts cannot store verifications. Security-critical test."
)]
#[allure_test]
#[tokio::test]
async fn test_unauthorized_store_verification() -> anyhow::Result<()> {
    let (worker, contract, _backend) = init().await?;
    let unauthorized = worker.dev_create_account().await?;
    let user = worker.dev_create_account().await?;

    // Try to store verification from unauthorized account
    let result = unauthorized
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
"near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": BASE64.encode([0u8; 64]),
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": nonce_to_base64(&[0u8; 32]),
                "recipient": contract.id()
            },
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify unauthorized store_verification fails", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Only backend wallet can store verifications"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "authorization")]
#[allure_description(
    "Verifies that unauthorized accounts cannot pause the contract. Security-critical test."
)]
#[allure_test]
#[tokio::test]
async fn test_unauthorized_pause() -> anyhow::Result<()> {
    let (worker, contract, _backend) = init().await?;
    let unauthorized = worker.dev_create_account().await?;

    let result = unauthorized
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify unauthorized pause fails", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(failure_msg.contains("Only backend wallet can pause"));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("integration", "admin", "pause")]
#[allure_description(
    "Verifies that the backend wallet can pause and unpause the contract correctly."
)]
#[allure_test]
#[tokio::test]
async fn test_authorized_pause_unpause() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Pause the contract (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify pause succeeds", || {
        assert!(result.is_success(), "Pause failed: {:?}", result.failures());
    });

    // Verify it's paused
    let is_paused: bool = contract.view("is_paused").await?.json()?;

    step("Verify contract is paused", || {
        assert!(is_paused);
    });

    // Unpause the contract (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "unpause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify unpause succeeds", || {
        assert!(
            result.is_success(),
            "Unpause failed: {:?}",
            result.failures()
        );
    });

    // Verify it's unpaused
    let is_paused: bool = contract.view("is_paused").await?.json()?;

    step("Verify contract is unpaused", || {
        assert!(!is_paused);
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "deposit", "yocto")]
#[allure_description("Verifies that store_verification requires exactly 1 yoctoNEAR deposit. This prevents accidental calls and provides a small security measure.")]
#[allure_test]
#[tokio::test]
async fn test_store_verification_requires_one_yocto() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Try to store verification without any deposit
    let result_no_deposit = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
"near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": BASE64.encode([0u8; 64]),
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": nonce_to_base64(&[0u8; 32]),
                "recipient": contract.id()
            },
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify store_verification fails without deposit", || {
        assert!(result_no_deposit.is_failure());
        let failure_msg = format!("{:?}", result_no_deposit.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    // Try with 2 yoctoNEAR (too much)
    let result_too_much = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(2))
        .args_json(json!({
"near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": BASE64.encode([0u8; 64]),
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": nonce_to_base64(&[0u8; 32]),
                "recipient": contract.id()
            },
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    step("Verify store_verification fails with 2 yoctoNEAR", || {
        assert!(result_too_much.is_failure());
        let failure_msg = format!("{:?}", result_too_much.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "deposit", "yocto")]
#[allure_description("Verifies that update_backend_wallet requires exactly 1 yoctoNEAR deposit.")]
#[allure_test]
#[tokio::test]
async fn test_update_backend_wallet_requires_one_yocto() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let new_backend = worker.dev_create_account().await?;

    let result_no_deposit = backend
        .call(contract.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .transact()
        .await?;

    step("Verify update_backend_wallet fails without deposit", || {
        assert!(result_no_deposit.is_failure());
        let failure_msg = format!("{:?}", result_no_deposit.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    let result_too_much = backend
        .call(contract.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(2))
        .transact()
        .await?;

    step(
        "Verify update_backend_wallet fails with 2 yoctoNEAR",
        || {
            assert!(result_too_much.is_failure());
            let failure_msg = format!("{:?}", result_too_much.failures());
            assert!(
                failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
                "Expected yoctoNEAR error, got: {}",
                failure_msg
            );
        },
    );

    let current_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;
    step(
        "Verify backend wallet unchanged after failed updates",
        || {
            assert_eq!(current_backend, *backend.id());
        },
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("integration", "admin", "backend-wallet")]
#[allure_description(
    "Verifies that the backend wallet can be updated and the new wallet gains proper permissions."
)]
#[allure_test]
#[tokio::test]
async fn test_update_backend_wallet() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let new_backend = worker.dev_create_account().await?;

    // Update backend wallet (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "update_backend_wallet")
        .args_json(json!({"new_backend_wallet": new_backend.id()}))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify update_backend_wallet succeeds", || {
        assert!(
            result.is_success(),
            "Update backend wallet failed: {:?}",
            result.failures()
        );
    });

    // Verify new backend wallet
    let current_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify new backend wallet is set", || {
        assert_eq!(current_backend, *new_backend.id());
    });

    // Old backend can no longer pause (with 1 yocto deposit)
    let old_backend_result = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify old backend cannot pause", || {
        assert!(old_backend_result.is_failure());
    });

    // New backend can pause (with 1 yocto deposit)
    let new_backend_result = new_backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify new backend can pause", || {
        assert!(
            new_backend_result.is_success(),
            "New backend pause failed: {:?}",
            new_backend_result.failures()
        );
    });

    Ok(())
}
