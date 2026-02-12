use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use borsh::{to_vec, BorshDeserialize};
use near_sdk::IntoStorageKey;
use serde_json::json;
use tokio::time::{sleep, Duration};

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, init_mock_verified_accounts,
    proposal_storage_key, setup_env};

fn extract_event(logs: &[&str], event_name: &str) -> serde_json::Value {
    let entry = logs
        .iter()
        .find(|l| l.contains("\"event\":\"") && l.contains(event_name))
        .expect("event not found");
    let json = entry
        .strip_prefix("EVENT_JSON:")
        .unwrap_or(entry)
        .trim();
    serde_json::from_str(json).expect("invalid event json")
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

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "events")]
#[allure_description("Verifies event 001 all mutating actions emit events.")]
#[allure_test]
async fn it_event_001_all_mutating_actions_emit_events() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;

    // admin_added
    let res = admin
        .call(governance.id(), "add_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id().as_str() }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "admin_added");

    // admin_removed
    let res = admin
        .call(governance.id(), "remove_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id().as_str() }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "admin_removed");

    // proposal_created
    let res = admin
        .call(governance.id(), "create_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_millinear(10))
        .args_json(json!({
            "title": "event",
            "author": "a",
            "description": "d",
            "start_at": null
        }))
        .transact()
        .await?;
    let proposal_id: u32 = res.clone().json()?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "proposal_created");

    // vote_cast
    let res = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "vote_cast");

    // proposal_cancelled
    let res = admin
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "proposal_cancelled");

    // blocklist_added
    let res = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id().as_str() }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "blocklist_added");

    // blocklist_removed
    let res = admin
        .call(governance.id(), "unblocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id().as_str() }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "blocklist_removed");

    // proposal_finalized
    let proposal_id =
        create_proposal(&admin, &governance, "event2", None, NearToken::from_millinear(10)).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    let proposal = get_proposal(&governance, proposal_id).await?;
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let res = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "proposal_finalized");

    // pending_vote_cleared
    let proposal_id =
        create_proposal(&admin, &governance, "event3", None, NearToken::from_millinear(10)).await?;
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
    let proposal_key = proposal_storage_key(&worker, &governance, proposal_id).await?;
    if let Some(raw) = worker.view_state(governance.id()).await?.get(&proposal_key) {
        let mut proposal: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
        proposal.pending_vote_count = 1;
        let bytes = to_vec(&proposal)?;
        worker.patch_state(governance.id(), &proposal_key, &bytes).await?;
    }
    let res = admin
        .call(governance.id(), "clear_stale_pending_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id, "account_id": crate::helpers::user(&users, 0).id().as_str() }))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "pending_vote_cleared");

    // Ensure no active proposals before updating verified accounts contract
    let res = admin
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(res.is_success());

    // pending_blocklist_op_cleared
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let res = admin
        .call(governance.id(), "update_verified_accounts_contract")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_contract": mock_verified.id() }))
        .transact()
        .await?;
    assert!(res.is_success());
    let _tx = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id().as_str() }))
        .transact_async()
        .await?;
    let _ = wait_for_blocklist_locked(&governance, true).await?;
    let res = admin
        .call(governance.id(), "clear_stale_blocklist_op")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({}))
        .transact()
        .await?;
    let success = res.unwrap();
    let logs = success.logs();
    extract_event(&logs, "pending_blocklist_op_cleared");

    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("critical")]
#[allure_tags("integration", "governance", "events")]
#[allure_description("Verifies event 002 admin wallet still requires verification to vote.")]
#[allure_test]
async fn it_event_002_admin_wallet_still_requires_verification_to_vote() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;

    let proposal_id =
        create_proposal(&admin, &governance, "admin-not-verified", None, NearToken::from_millinear(10)).await?;

    // Sanity check: this account is an admin but intentionally not verified in setup_env().
    let is_admin: bool = governance
        .view("is_admin")
        .args_json(json!({ "account_id": admin.id().as_str() }))
        .await?
        .json()?;
    assert!(is_admin);

    let had_voted_before: bool = governance
        .view("has_voted")
        .args_json(json!({ "proposal_id": proposal_id, "account_id": admin.id().as_str() }))
        .await?
        .json()?;
    assert!(!had_voted_before);

    let res = admin
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(res.is_success());

    let success = res.unwrap();
    let logs = success.logs();
    let event = extract_event(&logs, "vote_rejected");
    let data = if event["data"].is_array() {
        &event["data"][0]
    } else {
        &event["data"]
    };
    assert_eq!(data["proposal_id"], json!(proposal_id));
    assert_eq!(data["voter"], json!(admin.id().as_str()));
    assert_eq!(data["reason"], json!("not_verified"));

    let has_voted: bool = governance
        .view("has_voted")
        .args_json(json!({ "proposal_id": proposal_id, "account_id": admin.id().as_str() }))
        .await?
        .json()?;
    assert!(!has_voted);

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);
    assert_eq!(proposal.pending_vote_count, 0);

    // Control: verified user can still vote on the same proposal.
    let control = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(control.is_success());

    let proposal_after_control = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal_after_control.yes_votes, 1);

    Ok(())
}
