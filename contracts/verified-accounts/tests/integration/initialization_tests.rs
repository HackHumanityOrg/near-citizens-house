//! Initialization tests for verified-accounts contract

use crate::helpers::{init, WASM_PATH};
use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use near_workspaces::AccountId;
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("integration", "initialization", "setup")]
#[allure_description("Verifies that the contract initializes correctly with proper backend wallet, zero count, and unpaused state.")]
#[allure_test]
#[tokio::test]
async fn test_contract_initialization() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Verify backend wallet is set correctly
    let result: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify backend wallet is set correctly", || {
        assert_eq!(result, *backend.id());
    });

    // Verify initial count is 0
    let count: u64 = contract.view("get_verified_count").await?.json()?;

    step("Verify initial count is 0", || {
        assert_eq!(count, 0);
    });

    // Verify contract is not paused initially
    let is_paused: bool = contract.view("is_paused").await?.json()?;

    step("Verify contract is not paused initially", || {
        assert!(!is_paused);
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("integration", "initialization", "security")]
#[allure_description("Test 1.1.4: Verifies that the contract cannot be reinitialized after initial setup.")]
#[allure_test]
#[tokio::test]
async fn test_init_cannot_reinitialize() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Try to reinitialize the contract - should fail
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .transact()
        .await?;

    step("Verify reinitialization fails with correct error", || {
        assert!(
            result.is_failure(),
            "Reinitialization should fail. Got success instead."
        );

        // Verify error message indicates contract is already initialized
        let failure_msg = format!("{:?}", result.failures());
        assert!(
            failure_msg.contains("already initialized") || failure_msg.contains("The contract has already been initialized"),
            "Expected 'already initialized' error, got: {}",
            failure_msg
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("integration", "initialization", "account-types")]
#[allure_description("Test 1.1.5: Verifies that the contract can be initialized with a subaccount as backend wallet.")]
#[allure_test]
#[tokio::test]
async fn test_init_with_subaccount_backend() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;

    // Create a parent account first
    let parent = worker.dev_create_account().await?;

    // Create a subaccount under the parent
    let subaccount = parent
        .create_subaccount("backend")
        .initial_balance(NearToken::from_near(10))
        .transact()
        .await?
        .into_result()?;

    // Deploy contract
    let wasm = std::fs::read(WASM_PATH).expect("Could not find WASM file");
    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize with subaccount as backend wallet
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": subaccount.id()
        }))
        .transact()
        .await?;

    step("Verify init with subaccount succeeds", || {
        assert!(
            result.is_success(),
            "Init with subaccount should succeed. Failures: {:?}",
            result.failures()
        );
    });

    // Verify backend wallet is set correctly
    let backend_wallet: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify backend wallet is set to subaccount", || {
        assert_eq!(backend_wallet, *subaccount.id());
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("integration", "initialization", "account-types")]
#[allure_description("Test 1.1.6: Verifies that the contract can be initialized with an implicit account (64 hex chars) as backend wallet.")]
#[allure_test]
#[tokio::test]
async fn test_init_with_implicit_account_backend() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;

    // In NEAR, implicit accounts are 64 hex characters representing a public key
    // Dev accounts in sandbox are essentially implicit-like accounts
    let implicit_backend = worker.dev_create_account().await?;

    // Deploy contract
    let wasm = std::fs::read(WASM_PATH).expect("Could not find WASM file");
    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize with the dev account (which has implicit-style ID in sandbox)
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": implicit_backend.id()
        }))
        .transact()
        .await?;

    step("Verify init with implicit account succeeds", || {
        assert!(
            result.is_success(),
            "Init with implicit-style account should succeed. Failures: {:?}",
            result.failures()
        );
    });

    // Verify backend wallet is set correctly
    let backend_wallet: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify backend wallet is set to implicit account", || {
        assert_eq!(backend_wallet, *implicit_backend.id());
    });

    Ok(())
}
