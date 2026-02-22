use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{init_governance, init_verified_accounts};

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "initialization")]
#[allure_description("Verifies init 001 double initialization rejected.")]
#[allure_test]
async fn it_init_001_double_initialization_rejected() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let (verified_contract, _backend) = init_verified_accounts(&worker).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &verified_contract, &admin).await?;

    let result = admin
        .call(governance.id(), "new")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({
            "verified_accounts_contract": verified_contract.id(),
            "admins": vec![admin.id()],
            "quorum_bps": 700,
            "voting_period_secs": 86_400,
            "pending_expiry_secs": 300,
            "min_proposal_bond": NearToken::from_millinear(10).as_yoctonear().to_string(),
            "finalize_grace_period_secs": 300,
            "max_start_delay_secs": 7_776_000
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    Ok(())
}
