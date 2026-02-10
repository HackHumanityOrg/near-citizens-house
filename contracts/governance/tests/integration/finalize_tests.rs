use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, init_governance,
    init_mock_verified_accounts, proposal_storage_keys, seed_mock_verified_accounts};
use borsh::{to_vec, BorshDeserialize};
use near_sdk::IntoStorageKey;

fn assert_failure_contains(result: &near_workspaces::result::ExecutionFinalResult, needle: &str) {
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains(needle),
        "Expected failure containing '{}', got {:?}",
        needle,
        failures
    );
}

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
#[allure_sub_suite("Finalize")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "finalize")]
#[allure_description("Verifies final 001 finalize blocked by pending votes before grace.")]
#[allure_test]
async fn it_final_001_finalize_blocked_by_pending_votes_before_grace() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let users = vec![worker.dev_create_account().await?];
    seed_mock_verified_accounts(&mock_verified, &users, 0).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "final1", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    // Inject pending vote and count to avoid callback races.
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

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;

    // Ensure pending_vote_count is still > 0 (callbacks may clear it quickly).
    let keys = proposal_storage_keys(&worker, &governance, proposal_id).await?;
    for key in &keys {
        if let Some(raw) = worker.view_state(governance.id()).await?.get(key) {
            let mut proposal: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
            if proposal.pending_vote_count == 0 {
                proposal.pending_vote_count = 1;
                let bytes = to_vec(&proposal)?;
                worker.patch_state(governance.id(), key, &bytes).await?;
            }
        }
    }
    for key in &keys {
        let raw = worker
            .view_state(governance.id())
            .await?
            .get(key)
            .cloned()
            .expect("missing proposal after patch");
        let patched: governance::Proposal = governance::Proposal::try_from_slice(&raw)?;
        assert_eq!(patched.pending_vote_count, 1);
    }
    let pending_after = pending_votes_count(&governance, proposal_id).await?;
    assert_eq!(pending_after, 1);
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert_failure_contains(&result, "ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES");
    Ok(())
}
