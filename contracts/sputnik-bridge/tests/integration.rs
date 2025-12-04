//! Integration tests for sputnik-bridge contract
//!
//! These tests verify the bridge contract's initialization and view methods.
//! Full cross-contract tests with SputnikDAO require additional setup.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use near_workspaces::types::NearToken;
use near_workspaces::{network::Sandbox, Account, Contract, Worker};
use serde_json::json;

// ==================== CONSTANTS ====================

/// WASM bytecode for bridge contract
const BRIDGE_WASM: &[u8] = include_bytes!("../target/near/sputnik_bridge.wasm");

/// WASM bytecode for verified-accounts contract
const VERIFIED_ACCOUNTS_WASM: &[u8] =
    include_bytes!("../../verified-accounts/target/near/verified_accounts.wasm");

// ==================== DATA STRUCTURES ====================

/// Bridge info structure (must match contract)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BridgeInfo {
    pub backend_wallet: String,
    pub sputnik_dao: String,
    pub verified_accounts_contract: String,
    pub citizen_role: String,
}

/// Test environment
pub struct TestEnv {
    pub worker: Worker<Sandbox>,
    pub bridge: Contract,
    pub verified_accounts: Contract,
    pub backend: Account,
    pub mock_sputnik_dao: Account, // Mock account for SputnikDAO (not full contract)
}

// ==================== SETUP ====================

/// Basic setup - deploys bridge and verified-accounts contracts
async fn setup() -> anyhow::Result<TestEnv> {
    let worker = near_workspaces::sandbox().await?;

    // Create accounts
    let backend = worker.dev_create_account().await?;
    let mock_sputnik_dao = worker.dev_create_account().await?;

    // Deploy verified-accounts contract
    let verified_accounts = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;
    verified_accounts
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .transact()
        .await?
        .into_result()?;

    // Deploy bridge contract
    let bridge = worker.dev_deploy(BRIDGE_WASM).await?;
    bridge
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id(),
            "sputnik_dao": mock_sputnik_dao.id(),
            "verified_accounts_contract": verified_accounts.id(),
            "citizen_role": "citizen"
        }))
        .transact()
        .await?
        .into_result()?;

    Ok(TestEnv {
        worker,
        bridge,
        verified_accounts,
        backend,
        mock_sputnik_dao,
    })
}

// ==================== TESTS ====================

#[tokio::test]
async fn test_initialization() -> anyhow::Result<()> {
    let env = setup().await?;

    // Verify initialization
    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    assert_eq!(info.backend_wallet, env.backend.id().to_string());
    assert_eq!(info.sputnik_dao, env.mock_sputnik_dao.id().to_string());
    assert_eq!(
        info.verified_accounts_contract,
        env.verified_accounts.id().to_string()
    );
    assert_eq!(info.citizen_role, "citizen");

    Ok(())
}

#[tokio::test]
async fn test_get_backend_wallet() -> anyhow::Result<()> {
    let env = setup().await?;

    let backend_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;
    assert_eq!(backend_wallet, env.backend.id().to_string());

    Ok(())
}

#[tokio::test]
async fn test_get_sputnik_dao() -> anyhow::Result<()> {
    let env = setup().await?;

    let sputnik_dao: String = env.bridge.view("get_sputnik_dao").await?.json()?;
    assert_eq!(sputnik_dao, env.mock_sputnik_dao.id().to_string());

    Ok(())
}

#[tokio::test]
async fn test_get_verified_accounts_contract() -> anyhow::Result<()> {
    let env = setup().await?;

    let verified_accounts_contract: String = env
        .bridge
        .view("get_verified_accounts_contract")
        .await?
        .json()?;
    assert_eq!(
        verified_accounts_contract,
        env.verified_accounts.id().to_string()
    );

    Ok(())
}

#[tokio::test]
async fn test_get_citizen_role() -> anyhow::Result<()> {
    let env = setup().await?;

    let citizen_role: String = env.bridge.view("get_citizen_role").await?.json()?;
    assert_eq!(citizen_role, "citizen");

    Ok(())
}

#[tokio::test]
async fn test_update_backend_wallet() -> anyhow::Result<()> {
    let env = setup().await?;
    let new_backend = env.worker.dev_create_account().await?;

    // Update backend wallet (should succeed from current backend)
    env.backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({
            "new_backend_wallet": new_backend.id()
        }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    // Verify update
    let backend_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;
    assert_eq!(backend_wallet, new_backend.id().to_string());

    Ok(())
}

#[tokio::test]
async fn test_update_backend_wallet_unauthorized() -> anyhow::Result<()> {
    let env = setup().await?;
    let unauthorized = env.worker.dev_create_account().await?;

    // Try to update from unauthorized account
    let result = unauthorized
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({
            "new_backend_wallet": unauthorized.id()
        }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_update_citizen_role() -> anyhow::Result<()> {
    let env = setup().await?;

    // Update citizen role
    env.backend
        .call(env.bridge.id(), "update_citizen_role")
        .args_json(json!({
            "new_role": "voter"
        }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    // Verify update
    let citizen_role: String = env.bridge.view("get_citizen_role").await?.json()?;
    assert_eq!(citizen_role, "voter");

    Ok(())
}

#[tokio::test]
async fn test_update_citizen_role_unauthorized() -> anyhow::Result<()> {
    let env = setup().await?;
    let unauthorized = env.worker.dev_create_account().await?;

    // Try to update from unauthorized account
    let result = unauthorized
        .call(env.bridge.id(), "update_citizen_role")
        .args_json(json!({
            "new_role": "voter"
        }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_add_member_unauthorized() -> anyhow::Result<()> {
    let env = setup().await?;
    let unauthorized = env.worker.dev_create_account().await?;
    let user = env.worker.dev_create_account().await?;

    // Try to add member from unauthorized account
    let result = unauthorized
        .call(env.bridge.id(), "add_member")
        .args_json(json!({
            "near_account_id": user.id()
        }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(200))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_add_member_not_verified() -> anyhow::Result<()> {
    let env = setup().await?;
    let user = env.worker.dev_create_account().await?;

    // Try to add unverified user
    let result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({
            "near_account_id": user.id()
        }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(200))
        .transact()
        .await?;

    // Should fail because user is not verified
    assert!(result.is_failure());
    // Error message: "Account is not verified - cannot add to DAO"
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains("not verified") || failures.contains("Account is not verified"),
        "Expected 'not verified' error, got: {}",
        failures
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_unauthorized() -> anyhow::Result<()> {
    let env = setup().await?;
    let unauthorized = env.worker.dev_create_account().await?;

    // Try to create proposal from unauthorized account
    let result = unauthorized
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({
            "description": "Test proposal"
        }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_empty_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Try to create proposal with empty description
    let result = env
        .backend
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({
            "description": ""
        }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("cannot be empty"));

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_description_too_long() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create description over limit (10,000 chars)
    let long_description = "x".repeat(10_001);

    // Try to create proposal with too long description
    let result = env
        .backend
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({
            "description": long_description
        }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("exceeds maximum"));

    Ok(())
}
