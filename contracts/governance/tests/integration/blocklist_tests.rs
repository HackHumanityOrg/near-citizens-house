use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;
use std::collections::HashSet;

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

async fn setup_env_with_mock_config(
    verified_accounts: usize,
    delay_get_verification: bool,
) -> anyhow::Result<(
    near_workspaces::Worker<near_workspaces::network::Sandbox>,
    near_workspaces::Contract,
    near_workspaces::Contract,
    near_workspaces::Account,
    Vec<near_workspaces::Account>,
)> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, delay_get_verification).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let mut users = Vec::new();
    for _ in 0..verified_accounts {
        users.push(worker.dev_create_account().await?);
    }
    seed_mock_verified_accounts(&mock_verified, &users, 0).await?;
    Ok((worker, governance, mock_verified, admin, users))
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
    setup_env_with_mock_config(verified_accounts, true).await
}

async fn setup_env_with_fast_mock(
    verified_accounts: usize,
) -> anyhow::Result<(
    near_workspaces::Worker<near_workspaces::network::Sandbox>,
    near_workspaces::Contract,
    near_workspaces::Contract,
    near_workspaces::Account,
    Vec<near_workspaces::Account>,
)> {
    setup_env_with_mock_config(verified_accounts, false).await
}

async fn list_all_blocklist_accounts(
    governance: &near_workspaces::Contract,
    page_size: u32,
) -> anyhow::Result<Vec<String>> {
    let mut out = Vec::new();
    let mut from_index = 0u32;

    for _ in 0..1000 {
        let page: Vec<String> = governance
            .view("list_blocklist")
            .args_json(json!({ "from_index": from_index, "limit": page_size }))
            .await?
            .json()?;
        if page.is_empty() {
            break;
        }
        let page_len = u32::try_from(page.len()).expect("blocklist page length fits u32");
        out.extend(page);
        if page_len < page_size {
            break;
        }
        from_index = from_index.saturating_add(page_len);
    }

    Ok(out)
}

async fn wait_for_proposal_not_pending(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    governance: &near_workspaces::Contract,
    proposal_id: u32,
) -> anyhow::Result<governance::ProposalView> {
    for _ in 0..60 {
        let proposal = get_proposal(governance, proposal_id).await?;
        if proposal.status != governance::ProposalStatus::Pending {
            return Ok(proposal);
        }
        worker.fast_forward(1).await?;
        sleep(Duration::from_millis(50)).await;
    }
    anyhow::bail!("proposal did not leave Pending")
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

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "blocklist")]
#[allure_description("Verifies block 011 adding existing blocklist entry is idempotent.")]
#[allure_test]
async fn it_block_011_add_existing_blocklist_entry_is_idempotent() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let target = crate::helpers::user(&users, 0);

    let first = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": target.id() }))
        .transact()
        .await?;
    assert!(first.is_success());

    let second = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": target.id() }))
        .transact()
        .await?;
    assert!(second.is_success());

    let entries: Vec<String> = governance
        .view("list_blocklist")
        .args_json(json!({ "from_index": 0, "limit": 100 }))
        .await?
        .json()?;
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0], target.id().to_string());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "quorum", "e2e")]
#[allure_description(
    "Verifies block 012 blocklist affects voting eligibility and quorum across proposals."
)]
#[allure_test]
async fn it_block_012_blocklist_vote_eligibility_and_quorum_across_proposals() -> anyhow::Result<()>
{
    let (worker, governance, _verified, admin, _backend, users) = setup_env(5).await?;
    let quorum_bps = 6_000u16; // 60%

    // Make quorum requirements explicit and non-trivial for both rounds.
    let set_quorum = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": quorum_bps }))
        .transact()
        .await?;
    assert!(set_quorum.is_success());

    // Round 1: no blocklist, 5 verified accounts => quorum ceil(5 * 60%) = 3.
    let first_id = create_proposal(
        &admin,
        &governance,
        "round-1",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let first = get_proposal(&governance, first_id).await?;
    assert_eq!(first.snapshot_verified_count, 5);
    assert_eq!(first.quorum_bps, quorum_bps);
    assert_eq!(first.status, governance::ProposalStatus::Active);

    for voter in users.iter().take(3) {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": first_id, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }

    crate::helpers::fast_forward_to_timestamp(&worker, first.ends_at.0 + 1).await?;
    let finalize_first = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": first_id }))
        .transact()
        .await?;
    assert!(finalize_first.is_success());

    let first = get_proposal(&governance, first_id).await?;
    assert_eq!(first.snapshot_verified_count, 5);
    assert_eq!(first.yes_votes, 3);
    assert_eq!(first.no_votes, 0);
    assert_eq!(first.status, governance::ProposalStatus::Succeeded);

    // Blocklist 2 previously-verified accounts.
    for blocked in users.iter().take(2) {
        let result = admin
            .call(governance.id(), "blocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": blocked.id() }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    for blocked in users.iter().take(2) {
        let is_blocklisted: bool = governance
            .view("is_blocklisted")
            .args_json(json!({ "account_id": blocked.id() }))
            .await?
            .json()?;
        assert!(is_blocklisted);
    }

    // Round 2: effective snapshot is 5 - 2 = 3 => quorum ceil(3 * 60%) = 2.
    let second_id = create_proposal(
        &admin,
        &governance,
        "round-2",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let second = get_proposal(&governance, second_id).await?;
    assert_eq!(second.snapshot_verified_count, 3);
    assert_eq!(second.quorum_bps, quorum_bps);
    assert_eq!(second.status, governance::ProposalStatus::Active);

    let blocked_vote = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": second_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(blocked_vote.is_failure());
    assert_failure_contains(&blocked_vote, "ERR_BLOCKLISTED");
    let blocked_has_voted: bool = governance
        .view("has_voted")
        .args_json(json!({
            "proposal_id": second_id,
            "account_id": crate::helpers::user(&users, 0).id()
        }))
        .await?
        .json()?;
    assert!(!blocked_has_voted);

    let allowed_vote = crate::helpers::user(&users, 2)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": second_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(allowed_vote.is_success());

    crate::helpers::fast_forward_to_timestamp(&worker, second.ends_at.0 + 1).await?;
    let finalize_second = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": second_id }))
        .transact()
        .await?;
    assert!(finalize_second.is_success());

    let second = get_proposal(&governance, second_id).await?;
    assert_eq!(second.snapshot_verified_count, 3);
    assert_eq!(second.yes_votes, 1);
    assert_eq!(second.no_votes, 0);
    assert_eq!(second.status, governance::ProposalStatus::Failed);
    assert_eq!(
        second.failure_kind,
        Some(governance::FailureKind::QuorumNotMet)
    );

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "quorum", "e2e")]
#[allure_description(
    "Verifies block 013 quorum threshold tracks blocklist and unblocklist across proposal rounds."
)]
#[allure_test]
async fn it_block_013_quorum_tracks_blocklist_and_unblocklist_across_rounds() -> anyhow::Result<()>
{
    let (worker, governance, _verified, admin, _backend, users) = setup_env(5).await?;
    let quorum_bps = 6_000u16; // 60%

    let set_quorum = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": quorum_bps }))
        .transact()
        .await?;
    assert!(set_quorum.is_success());

    // Round 1: snapshot = 5, quorum = ceil(5 * 60%) = 3. Exactly 3 votes should pass.
    let p1 = create_proposal(
        &admin,
        &governance,
        "blocklist-r1",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p1_view = get_proposal(&governance, p1).await?;
    assert_eq!(p1_view.snapshot_verified_count, 5);
    for voter in users.iter().take(3) {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": p1, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }
    crate::helpers::fast_forward_to_timestamp(&worker, p1_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p1 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p1_final = get_proposal(&governance, p1).await?;
    assert_eq!(p1_final.status, governance::ProposalStatus::Succeeded);

    // Blocklist two verified accounts.
    for blocked in users.iter().take(2) {
        let result = admin
            .call(governance.id(), "blocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": blocked.id() }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    // Round 2: snapshot = 3, quorum = 2. One allowed vote should fail quorum.
    let p2 = create_proposal(
        &admin,
        &governance,
        "blocklist-r2",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p2_view = get_proposal(&governance, p2).await?;
    assert_eq!(p2_view.snapshot_verified_count, 3);

    let blocked_vote = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2, "choice": "yes" }))
        .transact()
        .await?;
    assert!(blocked_vote.is_failure());
    assert_failure_contains(&blocked_vote, "ERR_BLOCKLISTED");

    let allowed_vote = crate::helpers::user(&users, 2)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2, "choice": "yes" }))
        .transact()
        .await?;
    assert!(allowed_vote.is_success());

    crate::helpers::fast_forward_to_timestamp(&worker, p2_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p2_final = get_proposal(&governance, p2).await?;
    assert_eq!(p2_final.status, governance::ProposalStatus::Failed);
    assert_eq!(
        p2_final.failure_kind,
        Some(governance::FailureKind::QuorumNotMet)
    );

    // Round 3: snapshot = 3, quorum = 2. Two votes should pass exactly at threshold.
    let p3 = create_proposal(
        &admin,
        &governance,
        "blocklist-r3",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p3_view = get_proposal(&governance, p3).await?;
    assert_eq!(p3_view.snapshot_verified_count, 3);
    for voter in users.iter().skip(2).take(2) {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": p3, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }
    crate::helpers::fast_forward_to_timestamp(&worker, p3_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p3 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p3_final = get_proposal(&governance, p3).await?;
    assert_eq!(p3_final.status, governance::ProposalStatus::Succeeded);

    // Unblock one previously blocked account.
    let unblock = admin
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(unblock.is_success());

    let is_blocklisted: bool = governance
        .view("is_blocklisted")
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .await?
        .json()?;
    assert!(!is_blocklisted);

    // Round 4: snapshot = 4, quorum = ceil(4 * 60%) = 3.
    // Verify unblocked account can vote again and threshold is increased.
    let p4 = create_proposal(
        &admin,
        &governance,
        "blocklist-r4",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p4_view = get_proposal(&governance, p4).await?;
    assert_eq!(p4_view.snapshot_verified_count, 4);

    for voter in [
        crate::helpers::user(&users, 0), // unblocked account
        crate::helpers::user(&users, 2),
        crate::helpers::user(&users, 3),
    ] {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": p4, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }

    crate::helpers::fast_forward_to_timestamp(&worker, p4_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p4 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p4_final = get_proposal(&governance, p4).await?;
    assert_eq!(p4_final.status, governance::ProposalStatus::Succeeded);
    assert_eq!(p4_final.yes_votes, 3);

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "quorum")]
#[allure_description(
    "Verifies block 014 blocklisting unverified accounts does not change snapshots or quorum."
)]
#[allure_test]
async fn it_block_014_unverified_blocklist_does_not_affect_snapshot_or_quorum() -> anyhow::Result<()>
{
    let (worker, governance, _verified, admin, _backend, users) = setup_env(4).await?;
    let quorum_bps = 7_500u16; // 75% of 4 = 3

    let set_quorum = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": quorum_bps }))
        .transact()
        .await?;
    assert!(set_quorum.is_success());

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

    let blocklist_entries: Vec<String> = governance
        .view("list_blocklist")
        .args_json(json!({ "from_index": 0, "limit": 100 }))
        .await?
        .json()?;
    assert!(blocklist_entries.is_empty());

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "unverified-no-impact",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.snapshot_verified_count, 4);
    assert_eq!(proposal.quorum_bps, quorum_bps);

    for voter in users.iter().take(3) {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }

    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(finalize.is_success());

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
    assert_eq!(proposal.yes_votes, 3);

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "proposal-lock")]
#[allure_description(
    "Verifies block 015 pending blocklist op blocks proposal creation until stale op is cleared."
)]
#[allure_test]
async fn it_block_015_pending_blocklist_op_blocks_proposal_until_cleared() -> anyhow::Result<()> {
    let (worker, governance, _mock_verified, admin, users) = setup_env_with_mock(3).await?;
    let target = crate::helpers::user(&users, 0);

    let _tx = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": target.id() }))
        .transact_async()
        .await?;

    let locked = wait_for_blocklist_locked(&governance, true).await?;
    assert!(locked);

    // While pending op exists, proposal creation must be blocked.
    let blocked_create = admin
        .call(governance.id(), "create_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_millinear(10))
        .args_json(json!({
            "title": "blocked-by-pending-op",
            "author": "author",
            "description": "desc",
            "start_at": null
        }))
        .transact()
        .await?;
    assert!(blocked_create.is_failure());
    assert_failure_contains(&blocked_create, "ERR_BLOCKLIST_OP_PENDING");

    let clear = admin
        .call(governance.id(), "clear_stale_blocklist_op")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({}))
        .transact()
        .await?;
    if clear.is_failure() {
        // Callback may have already cleared the pending op; this is also a valid state.
        assert_failure_contains(&clear, "ERR_BLOCKLIST_OP_NOT_PENDING");
    }

    let unlocked = wait_for_blocklist_locked(&governance, false).await?;
    assert!(unlocked);

    // Give delayed callback receipts time to settle; pending op was cleared so target should not be added.
    worker.fast_forward(3).await?;
    sleep(Duration::from_millis(100)).await;

    let is_blocklisted: bool = governance
        .view("is_blocklisted")
        .args_json(json!({ "account_id": target.id() }))
        .await?
        .json()?;
    let expected_snapshot = if is_blocklisted { 2 } else { 3 };

    // Proposal should now be creatable with a snapshot consistent with current blocklist state.
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "after-clear",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);
    assert_eq!(proposal.snapshot_verified_count, expected_snapshot);

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "quorum", "zero-snapshot")]
#[allure_description(
    "Verifies block 016 blocklisting all verified accounts yields zero snapshot and non-votable proposal."
)]
#[allure_test]
async fn it_block_016_all_verified_blocklisted_yields_zero_snapshot() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(3).await?;

    for account in &users {
        let result = admin
            .call(governance.id(), "blocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": account.id() }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    let all_blocklisted = list_all_blocklist_accounts(&governance, 2).await?;
    assert_eq!(all_blocklisted.len(), 3);

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "zero-snapshot",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = wait_for_proposal_not_pending(&worker, &governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(
        proposal.failure_kind,
        Some(governance::FailureKind::ZeroSnapshot)
    );
    assert_eq!(proposal.snapshot_verified_count, 0);

    let outsider = worker.dev_create_account().await?;
    let vote = outsider
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(vote.is_failure());
    assert_failure_contains(&vote, "ERR_PROPOSAL_NOT_ACTIVE");

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "quorum", "rounding")]
#[allure_description("Verifies block 017 quorum ceil rounding boundaries at 3333 vs 3334 bps.")]
#[allure_test]
async fn it_block_017_quorum_rounding_boundaries_3333_vs_3334() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(3).await?;

    // 3333 bps on snapshot 3 => ceil(0.9999) = 1
    let set_3333 = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 3333 }))
        .transact()
        .await?;
    assert!(set_3333.is_success());

    let p1 = create_proposal(
        &admin,
        &governance,
        "rounding-3333",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p1_view = wait_for_proposal_not_pending(&worker, &governance, p1).await?;
    assert_eq!(p1_view.status, governance::ProposalStatus::Active);
    assert_eq!(p1_view.snapshot_verified_count, 3);
    assert_eq!(p1_view.quorum_bps, 3333);

    let vote = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p1, "choice": "yes" }))
        .transact()
        .await?;
    assert!(vote.is_success());

    crate::helpers::fast_forward_to_timestamp(&worker, p1_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p1 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p1_final = get_proposal(&governance, p1).await?;
    assert_eq!(p1_final.status, governance::ProposalStatus::Succeeded);

    // 3334 bps on snapshot 3 => ceil(1.0002) = 2
    let set_3334 = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 3334 }))
        .transact()
        .await?;
    assert!(set_3334.is_success());

    let p2 = create_proposal(
        &admin,
        &governance,
        "rounding-3334-fail",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p2_view = wait_for_proposal_not_pending(&worker, &governance, p2).await?;
    assert_eq!(p2_view.status, governance::ProposalStatus::Active);
    assert_eq!(p2_view.snapshot_verified_count, 3);
    assert_eq!(p2_view.quorum_bps, 3334);

    let vote = crate::helpers::user(&users, 1)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2, "choice": "yes" }))
        .transact()
        .await?;
    assert!(vote.is_success());

    crate::helpers::fast_forward_to_timestamp(&worker, p2_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p2_final = get_proposal(&governance, p2).await?;
    assert_eq!(p2_final.status, governance::ProposalStatus::Failed);
    assert_eq!(
        p2_final.failure_kind,
        Some(governance::FailureKind::QuorumNotMet)
    );

    let p3 = create_proposal(
        &admin,
        &governance,
        "rounding-3334-pass",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p3_view = wait_for_proposal_not_pending(&worker, &governance, p3).await?;
    assert_eq!(p3_view.snapshot_verified_count, 3);
    assert_eq!(p3_view.quorum_bps, 3334);

    for voter in [
        crate::helpers::user(&users, 1),
        crate::helpers::user(&users, 2),
    ] {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": p3, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }

    crate::helpers::fast_forward_to_timestamp(&worker, p3_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p3 }))
        .transact()
        .await?;
    assert!(finalize.is_success());
    let p3_final = get_proposal(&governance, p3).await?;
    assert_eq!(p3_final.status, governance::ProposalStatus::Succeeded);
    assert_eq!(p3_final.yes_votes, 2);

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "pagination", "quorum")]
#[allure_description(
    "Verifies block 018 large blocklist pagination has no gaps/duplicates and snapshots stay correct."
)]
#[allure_test]
async fn it_block_018_large_blocklist_pagination_and_snapshot_consistency() -> anyhow::Result<()> {
    let (worker, governance, _mock_verified, admin, users) = setup_env_with_fast_mock(130).await?;
    let blocked_ids: Vec<String> = users.iter().take(57).map(|u| u.id().to_string()).collect();

    for account_id in &blocked_ids {
        let result = admin
            .call(governance.id(), "blocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": account_id }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    let paged = list_all_blocklist_accounts(&governance, 17).await?;
    let paged_set: HashSet<String> = paged.iter().cloned().collect();
    let expected_set: HashSet<String> = blocked_ids.iter().cloned().collect();
    assert_eq!(
        paged.len(),
        paged_set.len(),
        "duplicate entries found in pagination"
    );
    assert_eq!(
        paged_set, expected_set,
        "pagination had gaps or unexpected entries"
    );

    let unblocked_ids: Vec<String> = blocked_ids.iter().step_by(8).take(6).cloned().collect();
    for account_id in &unblocked_ids {
        let result = admin
            .call(governance.id(), "unblocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": account_id }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    let paged_after = list_all_blocklist_accounts(&governance, 17).await?;
    let paged_after_set: HashSet<String> = paged_after.iter().cloned().collect();
    let unblocked_set: HashSet<String> = unblocked_ids.iter().cloned().collect();
    let expected_after_set: HashSet<String> =
        expected_set.difference(&unblocked_set).cloned().collect();
    assert_eq!(
        paged_after.len(),
        paged_after_set.len(),
        "duplicate entries found after unblocklist pagination"
    );
    assert_eq!(
        paged_after_set, expected_after_set,
        "pagination did not reflect unblocklist updates correctly"
    );

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "large-pagination-snapshot",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = wait_for_proposal_not_pending(&worker, &governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);
    assert_eq!(
        proposal.snapshot_verified_count,
        (users.len() - expected_after_set.len()) as u64
    );

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "race", "quorum")]
#[allure_description(
    "Verifies block 019 async blocklist callback vs stale-clear race keeps invariants intact."
)]
#[allure_test]
async fn it_block_019_async_blocklist_clear_race_invariants() -> anyhow::Result<()> {
    let (worker, governance, _mock_verified, admin, users) = setup_env_with_mock(12).await?;
    let attempts = 8usize;
    let attempted_ids: HashSet<String> = users
        .iter()
        .take(attempts)
        .map(|u| u.id().to_string())
        .collect();

    for i in 0..attempts {
        let target = crate::helpers::user(&users, i);
        let _tx = admin
            .call(governance.id(), "blocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": target.id() }))
            .transact_async()
            .await?;

        let locked = wait_for_blocklist_locked(&governance, true).await?;
        assert!(locked, "blocklist should become locked during pending op");

        let clear = admin
            .call(governance.id(), "clear_stale_blocklist_op")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({}))
            .transact()
            .await?;
        if clear.is_failure() {
            assert_failure_contains(&clear, "ERR_BLOCKLIST_OP_NOT_PENDING");
        }

        let unlocked = wait_for_blocklist_locked(&governance, false).await?;
        assert!(
            unlocked,
            "blocklist should unlock after clear/callback resolution"
        );

        worker.fast_forward(2).await?;
        sleep(Duration::from_millis(50)).await;

        let current = list_all_blocklist_accounts(&governance, 25).await?;
        let current_set: HashSet<String> = current.iter().cloned().collect();
        assert_eq!(
            current.len(),
            current_set.len(),
            "duplicate blocklist entries found"
        );
        assert!(
            current_set.iter().all(|id| attempted_ids.contains(id)),
            "blocklist contains accounts that were never targeted in race test"
        );
    }

    let locked: bool = governance.view("is_blocklist_locked").await?.json()?;
    assert!(!locked);

    let final_blocklist = list_all_blocklist_accounts(&governance, 25).await?;
    let final_set: HashSet<String> = final_blocklist.iter().cloned().collect();

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "race-invariants-snapshot",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = wait_for_proposal_not_pending(&worker, &governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);
    assert_eq!(
        proposal.snapshot_verified_count,
        (users.len() - final_set.len()) as u64
    );

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "blocklist", "immutability", "history")]
#[allure_description(
    "Verifies block 020 finalized proposal history remains immutable after later blocklist changes."
)]
#[allure_test]
async fn it_block_020_historical_proposal_immutability_after_blocklist_changes(
) -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(5).await?;

    let set_quorum = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 6000 }))
        .transact()
        .await?;
    assert!(set_quorum.is_success());

    let p1 = create_proposal(
        &admin,
        &governance,
        "immutability-r1",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p1_view = wait_for_proposal_not_pending(&worker, &governance, p1).await?;
    assert_eq!(p1_view.status, governance::ProposalStatus::Active);

    for voter in users.iter().take(4) {
        let choice = if voter.id() == crate::helpers::user(&users, 3).id() {
            "no"
        } else {
            "yes"
        };
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": p1, "choice": choice }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }

    crate::helpers::fast_forward_to_timestamp(&worker, p1_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p1 }))
        .transact()
        .await?;
    assert!(finalize.is_success());

    let p1_final = get_proposal(&governance, p1).await?;
    let p1_baseline = (
        p1_final.status.clone(),
        p1_final.failure_kind.clone(),
        p1_final.quorum_bps,
        p1_final.snapshot_verified_count,
        p1_final.yes_votes,
        p1_final.no_votes,
        p1_final.created_at.0,
        p1_final.start_at.0,
        p1_final.ends_at.0,
        p1_final.pending_vote_count,
    );

    for blocked in users.iter().take(2) {
        let result = admin
            .call(governance.id(), "blocklist_account")
            .gas(crate::helpers::GAS_HEAVY)
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({ "account_id": blocked.id() }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    let p2 = create_proposal(
        &admin,
        &governance,
        "immutability-r2",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p2_view = wait_for_proposal_not_pending(&worker, &governance, p2).await?;
    let vote = crate::helpers::user(&users, 2)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2, "choice": "yes" }))
        .transact()
        .await?;
    assert!(vote.is_success());
    crate::helpers::fast_forward_to_timestamp(&worker, p2_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2 }))
        .transact()
        .await?;
    assert!(finalize.is_success());

    let unblock = admin
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(unblock.is_success());

    let p3 = create_proposal(
        &admin,
        &governance,
        "immutability-r3",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let p3_view = wait_for_proposal_not_pending(&worker, &governance, p3).await?;
    for voter in [
        crate::helpers::user(&users, 0),
        crate::helpers::user(&users, 2),
        crate::helpers::user(&users, 4),
    ] {
        let vote = voter
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": p3, "choice": "yes" }))
            .transact()
            .await?;
        assert!(vote.is_success());
    }
    crate::helpers::fast_forward_to_timestamp(&worker, p3_view.ends_at.0 + 1).await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p3 }))
        .transact()
        .await?;
    assert!(finalize.is_success());

    let p1_after = get_proposal(&governance, p1).await?;
    let p1_after_tuple = (
        p1_after.status.clone(),
        p1_after.failure_kind.clone(),
        p1_after.quorum_bps,
        p1_after.snapshot_verified_count,
        p1_after.yes_votes,
        p1_after.no_votes,
        p1_after.created_at.0,
        p1_after.start_at.0,
        p1_after.ends_at.0,
        p1_after.pending_vote_count,
    );
    assert_eq!(p1_after_tuple, p1_baseline);

    let p1_voter_still_recorded: bool = governance
        .view("has_voted")
        .args_json(json!({
            "proposal_id": p1,
            "account_id": crate::helpers::user(&users, 0).id()
        }))
        .await?
        .json()?;
    assert!(p1_voter_still_recorded);

    Ok(())
}
