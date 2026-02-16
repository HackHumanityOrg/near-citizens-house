use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{
    create_proposal, get_proposal, init_governance, init_mock_verified_accounts,
    seed_mock_verified_accounts, setup_env,
};
use tokio::time::{sleep, Duration};

fn assert_failure_contains(result: &near_workspaces::result::ExecutionFinalResult, needle: &str) {
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains(needle),
        "Expected failure containing '{}', got {:?}",
        needle,
        failures
    );
}

async fn wait_for_blocklist_locked(
    governance: &near_workspaces::Contract,
    expected: bool,
) -> anyhow::Result<bool> {
    for _ in 0..40 {
        let locked: bool = governance.view("is_blocklist_locked").await?.json()?;
        if locked == expected {
            return Ok(true);
        }
        sleep(Duration::from_millis(50)).await;
    }
    Ok(false)
}

async fn setup_env_with_mock(
    verified_accounts: usize,
) -> anyhow::Result<(
    near_workspaces::Worker<near_workspaces::network::Sandbox>,
    near_workspaces::Contract,
    near_workspaces::Contract,
    near_workspaces::Account,
    Vec<near_workspaces::Account>,
)> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let mut users = Vec::new();
    for _ in 0..verified_accounts {
        users.push(worker.dev_create_account().await?);
    }
    seed_mock_verified_accounts(&mock_verified, &users, 0).await?;
    Ok((worker, governance, mock_verified, admin, users))
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 001 add blocklist verified account.")]
#[allure_test]
async fn it_block_001_add_blocklist_verified_account() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let is_blocklisted: bool = governance
        .view("is_blocklisted")
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .await?
        .json()?;
    assert!(is_blocklisted);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 002 add blocklist unverified account.")]
#[allure_test]
async fn it_block_002_add_blocklist_unverified_account() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;
    let unverified = worker.dev_create_account().await?;
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": unverified.id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let is_blocklisted: bool = governance
        .view("is_blocklisted")
        .args_json(json!({ "account_id": unverified.id() }))
        .await?
        .json()?;
    assert!(!is_blocklisted);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 003 blocklist lock during active proposal.")]
#[allure_test]
async fn it_block_003_blocklist_lock_during_active_proposal() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "lock",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_failure());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 004 unblocklist happy path.")]
#[allure_test]
async fn it_block_004_unblocklist_happy_path() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let result = admin
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let is_blocklisted: bool = governance
        .view("is_blocklisted")
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .await?
        .json()?;
    assert!(!is_blocklisted);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 005 pending blocklist op prevents another.")]
#[allure_test]
async fn it_block_005_pending_blocklist_op_prevents_another() -> anyhow::Result<()> {
    let (_worker, governance, _mock_verified, admin, users) = setup_env_with_mock(2).await?;
    let tx = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact_async()
        .await?;
    let _ = tx; // leave pending
    let _ = wait_for_blocklist_locked(&governance, true).await?;
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id() }))
        .transact()
        .await?;
    assert!(result.is_failure());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 006 pending blocklist op prevents unblocklist.")]
#[allure_test]
async fn it_block_006_pending_blocklist_op_prevents_unblocklist() -> anyhow::Result<()> {
    let (_worker, governance, _mock_verified, admin, users) = setup_env_with_mock(2).await?;
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let _tx = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id() }))
        .transact_async()
        .await?;
    let _ = wait_for_blocklist_locked(&governance, true).await?;
    let result = admin
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_failure());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 007 clear stale blocklist op.")]
#[allure_test]
async fn it_block_007_clear_stale_blocklist_op() -> anyhow::Result<()> {
    let (_worker, governance, _mock_verified, admin, users) = setup_env_with_mock(1).await?;
    let _tx = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact_async()
        .await?;
    let _ = wait_for_blocklist_locked(&governance, true).await?;
    let result = admin
        .call(governance.id(), "clear_stale_blocklist_op")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({}))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 008 blocklist subtraction in snapshot.")]
#[allure_test]
async fn it_block_008_blocklist_subtraction_in_snapshot() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(10).await?;
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "snap",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.snapshot_verified_count, 8);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 009 is blocklist locked lifecycle.")]
#[allure_test]
async fn it_block_009_is_blocklist_locked_lifecycle() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let locked: bool = governance.view("is_blocklist_locked").await?.json()?;
    assert!(!locked);
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "lock",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let locked: bool = governance.view("is_blocklist_locked").await?.json()?;
    assert!(locked);
    let proposal = get_proposal(&governance, proposal_id).await?;
    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    let locked: bool = governance.view("is_blocklist_locked").await?.json()?;
    assert!(!locked);

    let _tx = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact_async()
        .await?;
    let locked = wait_for_blocklist_locked(&governance, true).await?;
    assert!(locked);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist", "voting")]
#[allure_description("Verifies block 010 blocklisted vote rejected while valid vote counts.")]
#[allure_test]
async fn it_block_010_verified_and_blocklisted_voter_rejected() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;
    let blocked_voter = crate::helpers::user(&users, 0);
    let allowed_voter = crate::helpers::user(&users, 1);

    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": blocked_voter.id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    let is_blocklisted: bool = governance
        .view("is_blocklisted")
        .args_json(json!({ "account_id": blocked_voter.id() }))
        .await?
        .json()?;
    assert!(is_blocklisted);

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "blocked-voter",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);

    let result = blocked_voter
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_BLOCKLISTED");

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);

    let blocked_has_voted: bool = governance
        .view("has_voted")
        .args_json(json!({ "proposal_id": proposal_id, "account_id": blocked_voter.id() }))
        .await?
        .json()?;
    assert!(!blocked_has_voted);

    let result = allowed_voter
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.yes_votes, 1);
    assert_eq!(proposal.no_votes, 0);

    let allowed_has_voted: bool = governance
        .view("has_voted")
        .args_json(json!({ "proposal_id": proposal_id, "account_id": allowed_voter.id() }))
        .await?
        .json()?;
    assert!(allowed_has_voted);

    Ok(())
}
