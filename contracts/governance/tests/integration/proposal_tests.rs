use borsh::{to_vec, BorshDeserialize};
use near_sdk::IntoStorageKey;
use near_workspaces::types::NearToken;
use serde_json::json;
use tokio::time::{sleep, Duration};

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, init_governance,
    init_mock_verified_accounts, proposal_storage_keys, seed_mock_verified_accounts, setup_env,
    DEFAULT_PENDING_EXPIRY_SECS, GAS_HEAVY,
};

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

async fn set_pending_blocklist_op(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    governance: &near_workspaces::Contract,
    account_id: &str,
    initiated_by: &str,
) -> anyhow::Result<()> {
    let state = worker.view_state(governance.id()).await?;
    let key = state
        .iter()
        .find_map(|(k, v)| if k == b"STATE" { Some((k.clone(), v.clone())) } else { None })
        .ok_or_else(|| anyhow::anyhow!("STATE key not found"))?;
    let mut contract: governance::VersionedContract =
        governance::VersionedContract::try_from_slice(&key.1)?;
    let account_id: near_sdk::AccountId = account_id.parse()?;
    let initiated_by: near_sdk::AccountId = initiated_by.parse()?;
    let governance::VersionedContract::V1(ref mut c) = contract;
    c.pending_blocklist_op = Some(governance::PendingBlocklistOp {
        account_id,
        submitted_at: 0,
        initiated_by,
    });
    let bytes = to_vec(&contract)?;
    worker.patch_state(governance.id(), &key.0, &bytes).await?;
    Ok(())
}

#[tokio::test]
async fn it_prop_err_001_description_too_long() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;
    let desc = "d".repeat(10_001);
    let result = admin
        .call(governance.id(), "create_proposal")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_millinear(10))
        .args_json(json!({
            "title": "t",
            "author": "a",
            "description": desc,
            "start_at": null
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_DESCRIPTION_TOO_LONG");
    Ok(())
}

async fn wait_for_blocklist_locked(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    governance: &near_workspaces::Contract,
    expected: bool,
) -> anyhow::Result<()> {
    for _ in 0..40 {
        let locked: bool = governance.view("is_blocklist_locked").await?.json()?;
        if locked == expected {
            return Ok(());
        }
        worker.fast_forward(1).await?;
        sleep(Duration::from_millis(50)).await;
    }
    anyhow::bail!("blocklist_locked did not reach expected value");
}
#[tokio::test]
async fn it_prop_err_002_insufficient_bond() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;
    let bond = NearToken::from_yoctonear(NearToken::from_millinear(10).as_yoctonear() - 1);
    let result = admin
        .call(governance.id(), "create_proposal")
        .gas(GAS_HEAVY)
        .deposit(bond)
        .args_json(json!({
            "title": "t",
            "author": "a",
            "description": "d",
            "start_at": null
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_INSUFFICIENT_BOND");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_003_blocklist_op_pending() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, false).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let user = worker.dev_create_account().await?;
    set_pending_blocklist_op(
        &worker,
        &governance,
        user.id().as_str(),
        admin.id().as_str(),
    )
    .await?;

    let result = admin
        .call(governance.id(), "create_proposal")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_millinear(10))
        .args_json(json!({
            "title": "t",
            "author": "a",
            "description": "d",
            "start_at": null
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_BLOCKLIST_OP_PENDING");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_004_start_at_before_created() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;
    let now = worker.view_block().await?.timestamp();
    let result = admin
        .call(governance.id(), "create_proposal")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_millinear(10))
        .args_json(json!({
            "title": "t",
            "author": "a",
            "description": "d",
            "start_at": (now - 1).to_string()
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_START_AT_BEFORE_CREATED");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_005_expire_pending_not_pending() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p-exp", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, proposal_id).await?;

    let result = admin
        .call(governance.id(), "expire_pending_proposal")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_PROPOSAL_NOT_PENDING");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_006_finalize_not_active() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;

    let proposal_id =
        create_proposal(&admin, &governance, "p-final", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;

    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_PROPOSAL_NOT_ACTIVE");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_007_cast_vote_not_active() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let user = worker.dev_create_account().await?;

    let proposal_id =
        create_proposal(&admin, &governance, "p-vote", None, NearToken::from_millinear(10)).await?;
    let result = user
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_PROPOSAL_NOT_ACTIVE");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_008_cast_vote_already_pending() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, false).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let user = worker.dev_create_account().await?;
    seed_mock_verified_accounts(&mock_verified, &[user.clone()], 0).await?;

    let proposal_id =
        create_proposal(&admin, &governance, "p-pending", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, proposal_id).await?;

    // Inject a pending vote directly to ensure the pending lock exists.
    let pending_key = (proposal_id, user.id().clone());
    let key_prefix = governance::StorageKey::PendingVotes.into_storage_key();
    let mut key = key_prefix.clone();
    key.extend_from_slice(&to_vec(&pending_key)?);
    let pending_vote = governance::PendingVote {
        submitted_at: 0,
        choice: governance::VoteChoice::Yes,
        voter_deposit: NearToken::from_near(0),
    };
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

    let result = user
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_VOTE_ALREADY_PENDING");
    Ok(())
}

#[tokio::test]
async fn it_prop_err_009_unblocklist_locked_by_active() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p-block", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, proposal_id).await?;

    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_BLOCKLIST_LOCKED");

    // Clear pending proposal and try a valid blocklist op so we can then hit unlock path.
    fast_forward_to_timestamp(&worker, get_proposal(&governance, proposal_id).await?.ends_at.0 + 1)
        .await?;
    let _ = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;

    // Ensure blocklist works when idle so we can test unlock lock.
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());
    wait_for_blocklist_locked(&worker, &governance, false).await?;

    // Create a new active proposal to lock blocklist, then try to unblock.
    let proposal_id =
        create_proposal(&admin, &governance, "p-block-2", None, NearToken::from_millinear(10)).await?;
    wait_for_active(&worker, &governance, proposal_id).await?;
    let result = admin
        .call(governance.id(), "unblocklist_account")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_BLOCKLIST_LOCKED");

    // Avoid unused variables
    Ok(())
}

#[tokio::test]
async fn it_prop_err_010_config_updates_out_of_range() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;
    let result = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 0 }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_QUORUM_BPS_OUT_OF_RANGE");

    let result = admin
        .call(governance.id(), "update_voting_period_secs")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 59 }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_VOTING_PERIOD_OUT_OF_RANGE");

    let result = admin
        .call(governance.id(), "update_pending_expiry_secs")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": DEFAULT_PENDING_EXPIRY_SECS - 1 }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_PENDING_EXPIRY_OUT_OF_RANGE");

    let result = admin
        .call(governance.id(), "update_min_proposal_bond")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "new_min": NearToken::from_near(0).as_yoctonear().to_string()
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_MIN_BOND_OUT_OF_RANGE");

    let result = admin
        .call(governance.id(), "update_finalize_grace_period_secs")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 5 }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_GRACE_PERIOD_OUT_OF_RANGE");

    let result = admin
        .call(governance.id(), "update_max_start_delay_secs")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_period_secs": 7_776_001 }))
        .transact()
        .await?;
    assert!(result.is_failure());
    assert_failure_contains(&result, "ERR_MAX_START_DELAY_OUT_OF_RANGE");
    Ok(())
}
