use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, init_governance,
    init_mock_verified_accounts, proposal_storage_keys, setup_env,
    DEFAULT_GRACE_PERIOD_SECS, GAS_HEAVY};
use borsh::{to_vec, BorshDeserialize};
use near_sdk::IntoStorageKey;

async fn pending_votes_count(
    governance: &near_workspaces::Contract,
    proposal_id: u32,
) -> anyhow::Result<u64> {
    Ok(governance
        .view("get_pending_votes_count")
        .args_json(json!({ "proposal_id": proposal_id }))
        .await?
        .json()?)
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Async Voting")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "async-vote")]
#[allure_description("Verifies vote async 001 submitted before end callback after end.")]
#[allure_test]
async fn it_vote_async_001_submitted_before_end_callback_after_end() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "async1", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.yes_votes, 1);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Async Voting")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "async-vote")]
#[allure_description("Verifies vote async 002 callback executes after finalize.")]
#[allure_test]
async fn it_vote_async_002_callback_executes_after_finalize() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "async2", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + (DEFAULT_GRACE_PERIOD_SECS * 1_000_000_000))
        .await?;
    let finalize = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(finalize.is_success());

    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.yes_votes, 0);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Async Voting")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "async-vote")]
#[allure_description("Verifies vote async 003 callback error leaves no pending lock.")]
#[allure_test]
async fn it_vote_async_003_callback_error_leaves_no_pending_lock() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, true, false).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let voter = worker.dev_create_account().await?;

    let result = mock_verified
        .call("add_verified")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "account_id": voter.id(), "verified_at": 0u64 }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal_id =
        create_proposal(&admin, &governance, "async3", None, NearToken::from_millinear(10)).await?;

    let result = voter
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    let pending = pending_votes_count(&governance, proposal_id).await?;
    assert_eq!(pending, 0);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Async Voting")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "async-vote")]
#[allure_description("Verifies vote async 004 stuck pending vote cleared by admin.")]
#[allure_test]
async fn it_vote_async_004_stuck_pending_vote_cleared_by_admin() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "async4", None, NearToken::from_millinear(10)).await?;

    // Inject a pending vote deterministically.
    let pending_key = (proposal_id, crate::helpers::user(&users, 0).id().clone());
    let key_prefix = governance::StorageKey::PendingVotes.into_storage_key();
    let mut key = key_prefix.clone();
    key.extend_from_slice(&to_vec(&pending_key)?);
    let pending_vote = governance::PendingVote {
        submitted_at: 0,
        choice: governance::VoteChoice::Yes,
        voter_deposit: NearToken::from_near(0)};
    worker
        .patch_state(governance.id(), &key, &to_vec(&pending_vote)?)
        .await?;

    let proposal_keys = proposal_storage_keys(&worker, &governance, proposal_id).await?;
    for proposal_key in &proposal_keys {
        if let Some(raw) = worker.view_state(governance.id()).await?.get(proposal_key) {
            let mut proposal: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
            proposal.pending_vote_count = 1;
            let bytes = to_vec(&proposal)?;
            worker.patch_state(governance.id(), proposal_key, &bytes).await?;
        }
    }
    let state = worker.view_state(governance.id()).await?;
    assert!(
        state.contains_key(&key),
        "pending vote entry missing after patch"
    );
    let pending_after = pending_votes_count(&governance, proposal_id).await?;
    assert_eq!(pending_after, 1);

    let result = admin
        .call(governance.id(), "clear_stale_pending_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id, "account_id": crate::helpers::user(&users, 0).id().as_str() }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Async Voting")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "async-vote")]
#[allure_description("Verifies vote async 005 clear stale pending vote unblocks finalize.")]
#[allure_test]
async fn it_vote_async_005_clear_stale_pending_vote_unblocks_finalize() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "async5", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    // Inject pending vote and count.
    let pending_key = (proposal_id, crate::helpers::user(&users, 0).id().clone());
    let key_prefix = governance::StorageKey::PendingVotes.into_storage_key();
    let mut key = key_prefix.clone();
    key.extend_from_slice(&to_vec(&pending_key)?);
    let pending_vote = governance::PendingVote {
        submitted_at: 0,
        choice: governance::VoteChoice::Yes,
        voter_deposit: NearToken::from_near(0)};
    worker
        .patch_state(governance.id(), &key, &to_vec(&pending_vote)?)
        .await?;

    let proposal_keys = proposal_storage_keys(&worker, &governance, proposal_id).await?;
    for proposal_key in &proposal_keys {
        if let Some(raw) = worker.view_state(governance.id()).await?.get(proposal_key) {
            let mut proposal: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
            proposal.pending_vote_count = 1;
            let bytes = to_vec(&proposal)?;
            worker.patch_state(governance.id(), proposal_key, &bytes).await?;
        }
    }

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let pending_after = pending_votes_count(&governance, proposal_id).await?;
    if pending_after == 0 {
        for proposal_key in &proposal_keys {
            if let Some(raw) = worker.view_state(governance.id()).await?.get(proposal_key) {
                let mut proposal: governance::Proposal =
                    governance::Proposal::try_from_slice(raw)?;
                proposal.pending_vote_count = 1;
                let bytes = to_vec(&proposal)?;
                worker.patch_state(governance.id(), proposal_key, &bytes).await?;
            }
        }
    }
    let pending_after = pending_votes_count(&governance, proposal_id).await?;
    assert_eq!(pending_after, 1);
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_failure());

    let result = admin
        .call(governance.id(), "clear_stale_pending_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id, "account_id": crate::helpers::user(&users, 0).id().as_str() }))
        .transact()
        .await?;
    assert!(result.is_success());

    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}
