use allure_rs::prelude::*;
use borsh::{to_vec, BorshDeserialize};
use near_sdk::IntoStorageKey;
use near_workspaces::types::NearToken;
use serde_json::json;
use tokio::time::{sleep, Duration};

use crate::helpers::{
    create_proposal, get_proposal, init_governance, init_verified_accounts, proposal_storage_keys,
    setup_env};

fn assert_failure_contains(result: &near_workspaces::result::ExecutionFinalResult, needle: &str) {
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains(needle),
        "Expected failure containing '{}', got {:?}",
        needle,
        failures
    );
}

async fn wait_for_active(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    governance: &near_workspaces::Contract,
    proposal_id: u32,
) -> anyhow::Result<()> {
    for _ in 0..40 {
        let proposal = get_proposal(governance, proposal_id).await?;
        if proposal.status == governance::ProposalStatus::Active {
            return Ok(());
        }
        worker.fast_forward(1).await?;
        sleep(Duration::from_millis(50)).await;
    }
    anyhow::bail!("proposal did not become Active");
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 001 update quorum while active.")]
#[allure_test]
async fn it_config_001_update_quorum_while_active() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let _proposal_id =
        create_proposal(&admin, &governance, "q", None, NearToken::from_millinear(10)).await?;
    let result = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 800 }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description(
    "Verifies config 002 update voting period during active affects only future proposals."
)]
#[allure_test]
async fn it_config_002_update_voting_period_during_active() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let existing_id =
        create_proposal(&admin, &governance, "vp", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, existing_id).await?;
    let existing_before = get_proposal(&governance, existing_id).await?;

    let result = admin
        .call(governance.id(), "update_voting_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 86_400 }))
        .transact()
        .await?;
    assert!(result.is_success());

    let existing_after = get_proposal(&governance, existing_id).await?;
    assert_eq!(existing_after.ends_at.0, existing_before.ends_at.0);

    let new_id =
        create_proposal(&admin, &governance, "vp-new", None, NearToken::from_millinear(10)).await?;
    let new_proposal = get_proposal(&governance, new_id).await?;
    assert_eq!(
        new_proposal.ends_at.0 - new_proposal.start_at.0,
        86_400u64 * 1_000_000_000
    );
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 003 update verified contract when idle.")]
#[allure_test]
async fn it_config_003_update_verified_contract_when_idle() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let (verified1, backend1) = init_verified_accounts(&worker).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &verified1, &admin).await?;

    let (verified2, _backend2) = init_verified_accounts(&worker).await?;
    let result = admin
        .call(governance.id(), "update_verified_accounts_contract")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_contract": verified2.id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal_id =
        create_proposal(&admin, &governance, "cfg", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    let _ = backend1;
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 004 quorum snapshots per proposal.")]
#[allure_test]
async fn it_config_004_quorum_snapshots_per_proposal() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let result = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 700 }))
        .transact()
        .await?;
    assert!(result.is_success());
    let p1 = create_proposal(&admin, &governance, "qa", None, NearToken::from_millinear(10)).await?;
    let result = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 5000 }))
        .transact()
        .await?;
    assert!(result.is_success());
    let p2 = create_proposal(&admin, &governance, "qb", None, NearToken::from_millinear(10)).await?;
    let p1v = get_proposal(&governance, p1).await?;
    let p2v = get_proposal(&governance, p2).await?;
    assert_eq!(p1v.quorum_bps, 700);
    assert_eq!(p2v.quorum_bps, 5000);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 005 grace period change affects existing.")]
#[allure_test]
async fn it_config_005_grace_period_change_affects_existing() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "g", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    let _tx = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact_async()
        .await?;
    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 10 }))
        .transact()
        .await?;
    assert!(result.is_success());
    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 10 * 1_000_000_000)
        .await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 010 increase grace blocks finalize.")]
#[allure_test]
async fn it_config_010_increase_grace_blocks_finalize() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "grace", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, proposal_id).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    // Update grace period to a longer window.
    let result = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 20 }))
        .transact()
        .await?;
    assert!(result.is_success());

    // Inject a pending vote lock to force grace-period blocking.
    let pending_key = (proposal_id, crate::helpers::user(&users, 0).id().clone());
    let key_prefix = governance::StorageKey::PendingVotes.into_storage_key();
    let mut key = key_prefix.clone();
    key.extend_from_slice(&to_vec(&pending_key)?);
    let pending_vote = governance::PendingVote {
        submitted_at: proposal.start_at.0 + 1,
        choice: governance::VoteChoice::Yes,
        voter_deposit: NearToken::from_near(0)};
    worker
        .patch_state(governance.id(), &key, &to_vec(&pending_vote)?)
        .await?;
    let proposal_keys = proposal_storage_keys(&worker, &governance, proposal_id).await?;
    for proposal_key in &proposal_keys {
        if let Some(raw) = worker.view_state(governance.id()).await?.get(proposal_key) {
            let mut stored: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
            stored.pending_vote_count = 1;
            let bytes = to_vec(&stored)?;
            worker.patch_state(governance.id(), proposal_key, &bytes).await?;
        }
    }

    // At old grace deadline (10s), finalize should be blocked by pending votes.
    let old_grace = 10u64 * 1_000_000_000;
    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + old_grace).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES");

    // After new grace deadline (20s), finalize should succeed.
    let new_grace = 20u64 * 1_000_000_000;
    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + new_grace).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 011 reduce grace allows finalize sooner.")]
#[allure_test]
async fn it_config_011_reduce_grace_allows_finalize_sooner() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "grace-short", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, proposal_id).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    // Inject a pending vote lock to force grace-period blocking.
    let pending_key = (proposal_id, crate::helpers::user(&users, 0).id().clone());
    let key_prefix = governance::StorageKey::PendingVotes.into_storage_key();
    let mut key = key_prefix.clone();
    key.extend_from_slice(&to_vec(&pending_key)?);
    let pending_vote = governance::PendingVote {
        submitted_at: proposal.start_at.0 + 1,
        choice: governance::VoteChoice::Yes,
        voter_deposit: NearToken::from_near(0)};
    worker
        .patch_state(governance.id(), &key, &to_vec(&pending_vote)?)
        .await?;
    let proposal_keys = proposal_storage_keys(&worker, &governance, proposal_id).await?;
    for proposal_key in &proposal_keys {
        if let Some(raw) = worker.view_state(governance.id()).await?.get(proposal_key) {
            let mut stored: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
            stored.pending_vote_count = 1;
            let bytes = to_vec(&stored)?;
            worker.patch_state(governance.id(), proposal_key, &bytes).await?;
        }
    }

    // Increase grace period to 20s so we can later reduce it.
    let result = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 20 }))
        .transact()
        .await?;
    assert!(result.is_success());

    // Fast-forward past ends_at but before the 20s grace deadline.
    crate::helpers::fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 11 * 1_000_000_000)
        .await?;

    // Finalize should be blocked with the longer grace.
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES");

    // Reduce grace period to 10s (min in testing) and finalize should now succeed.
    let result = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 10 }))
        .transact()
        .await?;
    assert!(result.is_success());

    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 006 update pending expiry during active.")]
#[allure_test]
async fn it_config_006_update_pending_expiry_during_active() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let _proposal_id =
        create_proposal(&admin, &governance, "pe", None, NearToken::from_millinear(10)).await?;
    let result = admin
        .call(governance.id(), "update_pending_expiry_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 600 }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 007 update min bond during active.")]
#[allure_test]
async fn it_config_007_update_min_bond_during_active() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let _proposal_id =
        create_proposal(&admin, &governance, "mb", None, NearToken::from_millinear(10)).await?;
    let result = admin
        .call(governance.id(), "update_min_proposal_bond")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_min": NearToken::from_near(2).as_yoctonear().to_string() }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 008 update grace during active.")]
#[allure_test]
async fn it_config_008_update_grace_during_active() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let _proposal_id =
        create_proposal(&admin, &governance, "gr", None, NearToken::from_millinear(10)).await?;
    let result = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 600 }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "config")]
#[allure_description("Verifies config 009 update max start delay during active.")]
#[allure_test]
async fn it_config_009_update_max_start_delay_during_active() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let _proposal_id =
        create_proposal(&admin, &governance, "ms", None, NearToken::from_millinear(10)).await?;
    let result = admin
        .call(governance.id(), "update_max_start_delay_secs")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 1000 }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}
