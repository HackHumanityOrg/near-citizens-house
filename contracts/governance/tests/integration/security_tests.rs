use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{create_proposal, setup_env};

fn assert_failure_contains(result: &near_workspaces::result::ExecutionFinalResult, needle: &str) {
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains(needle),
        "Expected failure containing '{}', got {:?}",
        needle,
        failures
    );
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "security")]
#[allure_description("Verifies sec 001 all admin functions require one yocto.")]
#[allure_test]
async fn it_sec_001_all_admin_functions_require_one_yocto() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;

    let res = admin
        .call(governance.id(), "add_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "account_id": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "remove_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "account_id": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": 0 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "expire_pending_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": 0 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "clear_stale_pending_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": 0, "account_id": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "clear_stale_blocklist_op")
        .gas(crate::helpers::GAS_HEAVY)
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "account_id": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "account_id": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_bps": 800 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_voting_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_period_secs": 86_400 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_verified_accounts_contract")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_contract": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_pending_expiry_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_period_secs": 300 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_min_proposal_bond")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_min": NearToken::from_millinear(10).as_yoctonear().to_string() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_period_secs": 300 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "update_max_start_delay_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "new_period_secs": 1000 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "Requires attached deposit");

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "security")]
#[allure_description("Verifies sec 002 non admin cannot call admin methods.")]
#[allure_test]
async fn it_sec_002_non_admin_cannot_call_admin_methods() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let user = &crate::helpers::user(&users, 0);
    let deposit = NearToken::from_yoctonear(1);

    let res = user
        .call(governance.id(), "add_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "account_id": user.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "remove_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "account_id": admin.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "sec",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let res = user
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "expire_pending_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "clear_stale_pending_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "proposal_id": proposal_id, "account_id": user.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "clear_stale_blocklist_op")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "account_id": user.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "account_id": user.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_bps": 800 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_voting_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_period_secs": 86_400 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_verified_accounts_contract")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_contract": user.id().as_str() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_pending_expiry_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_period_secs": 300 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_min_proposal_bond")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_min": NearToken::from_millinear(10).as_yoctonear().to_string() }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_period_secs": 300 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = user
        .call(governance.id(), "update_max_start_delay_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(deposit)
        .args_json(json!({ "new_period_secs": 1000 }))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Security")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "security")]
#[allure_description("Verifies sec 003 004 005 private callbacks rejected.")]
#[allure_test]
async fn it_sec_003_004_005_private_callbacks_rejected() -> anyhow::Result<()> {
    let (_worker, governance, _verified, _admin, _backend, users) = setup_env(1).await?;
    let user = &crate::helpers::user(&users, 0);

    let res = user
        .call(governance.id(), "on_snapshot")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": 0 }))
        .transact()
        .await?;
    assert!(res.is_failure());

    let res = user
        .call(governance.id(), "on_vote_verification")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": 0, "voter": user.id() }))
        .transact()
        .await?;
    assert!(res.is_failure());

    let res = user
        .call(governance.id(), "on_blocklist_verification")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "account_id": user.id() }))
        .transact()
        .await?;
    assert!(res.is_failure());
    Ok(())
}
