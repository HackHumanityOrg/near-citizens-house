//! Setup and initialization tests for sputnik-bridge contract

use super::helpers::*;
use allure_rs::prelude::*;

// ==================== SETUP TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "initialization")]
#[allure_test]
#[tokio::test]
async fn test_full_setup() -> anyhow::Result<()> {
    let env = setup().await?;

    // Verify all contracts are deployed
    assert!(!env.sputnik_dao.id().to_string().is_empty());
    assert!(!env.verified_accounts.id().to_string().is_empty());
    assert!(!env.bridge.id().to_string().is_empty());

    // Verify bridge initialization
    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;
    assert_eq!(info.backend_wallet, env.backend.id().to_string());
    assert_eq!(info.sputnik_dao, env.sputnik_dao.id().to_string());
    assert_eq!(
        info.verified_accounts_contract,
        env.verified_accounts.id().to_string()
    );
    assert_eq!(info.citizen_role, "citizen");

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao")]
#[allure_test]
#[tokio::test]
async fn test_bridge_connected_to_dao() -> anyhow::Result<()> {
    let env = setup().await?;

    // Verify DAO policy has bridge in bridge role (matches production dao-policy.json)
    let is_in_bridge_role =
        is_account_in_role(&env.sputnik_dao, env.bridge.id().as_str(), "bridge").await?;
    assert!(is_in_bridge_role, "Bridge should be in bridge role");

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "policy")]
#[allure_test]
#[tokio::test]
async fn test_dao_policy_configured_correctly() -> anyhow::Result<()> {
    let env = setup().await?;

    let policy = get_dao_policy(&env.sputnik_dao).await?;

    // Verify proposal period is short (10 seconds)
    let proposal_period = policy
        .get("proposal_period")
        .and_then(|p| p.as_str())
        .unwrap();
    assert_eq!(proposal_period, PROPOSAL_PERIOD_NS.to_string());

    // Verify citizen role exists
    let roles = policy.get("roles").and_then(|r| r.as_array()).unwrap();
    let citizen_role = roles
        .iter()
        .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("citizen"));
    assert!(citizen_role.is_some(), "Citizen role should exist");

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("integration", "query", "view")]
#[allure_test]
#[tokio::test]
async fn test_get_info() -> anyhow::Result<()> {
    let env = setup().await?;

    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    assert_eq!(info.backend_wallet, env.backend.id().to_string());
    assert_eq!(info.sputnik_dao, env.sputnik_dao.id().to_string());
    assert_eq!(
        info.verified_accounts_contract,
        env.verified_accounts.id().to_string()
    );
    assert_eq!(info.citizen_role, "citizen");

    Ok(())
}
