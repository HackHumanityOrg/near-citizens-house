use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use borsh::{to_vec, BorshDeserialize};
use near_sdk::IntoStorageKey;
use serde_json::json;
use crate::helpers::{
    create_proposal, get_proposal, init_governance, init_mock_verified_accounts,
    init_verified_accounts, proposal_storage_key, setup_env};

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Snapshots")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "snapshot")]
#[allure_description("Verifies snap 001 snapshot callback failure.")]
#[allure_test]
async fn it_snap_001_snapshot_callback_failure() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let (verified_contract, backend) = init_verified_accounts(&worker).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &verified_contract, &admin).await?;

    // Update to a non-existent verified-accounts contract to force callback failure.
    let bad_contract = worker.dev_create_account().await?;
    let result = admin
        .call(governance.id(), "update_verified_accounts_contract")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_contract": bad_contract.id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal_id =
        create_proposal(&admin, &governance, "snapfail", None, NearToken::from_millinear(10)).await?;
    let proposal: Option<governance::ProposalView> = governance
        .view("get_proposal")
        .args_json(json!({ "proposal_id": proposal_id }))
        .await?
        .json()?;
    let proposal = proposal.ok_or_else(|| anyhow::anyhow!("proposal not found"))?;

    // Force pending state to ensure expiry path.
    let state = worker.view_state(governance.id()).await?;
    let prefix = governance::StorageKey::Proposals.into_storage_key();
    let mut key = prefix.clone();
    key.extend_from_slice(&(proposal_id as u64).to_le_bytes());
    if let Some(raw) = state.get(&key) {
        let mut stored: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
        stored.status = governance::ProposalStatus::Pending;
        stored.pending_expires_at = proposal.pending_expires_at.0;
        stored.failure_kind = None;
        let bytes = to_vec(&stored)?;
        worker.patch_state(governance.id(), &key, &bytes).await?;
    }
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(
        proposal.failure_kind,
        Some(governance::FailureKind::SnapshotCallbackFailed)
    );

    // keep backend in scope
    let _ = backend;
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Snapshots")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "snapshot")]
#[allure_description("Verifies snap 002 zero snapshot rejection.")]
#[allure_test]
async fn it_snap_002_zero_snapshot_rejection() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(0).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "zerosnap", None, NearToken::from_millinear(10)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(
        proposal.failure_kind,
        Some(governance::FailureKind::ZeroSnapshot)
    );
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Snapshots")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "snapshot")]
#[allure_description("Verifies pending 001 pending expiry.")]
#[allure_test]
async fn it_pending_001_pending_expiry() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "pending", None, NearToken::from_millinear(10)).await?;
    let _proposal = get_proposal(&governance, proposal_id).await?;
    let block = worker.view_block().await?;
    let forced_expiry = block.timestamp();

    // Force pending state + expiry to avoid race with snapshot callback.
    let key = proposal_storage_key(&worker, &governance, proposal_id).await?;
    if let Some(raw) = worker.view_state(governance.id()).await?.get(&key) {
        let mut stored: governance::Proposal = governance::Proposal::try_from_slice(raw)?;
        stored.status = governance::ProposalStatus::Pending;
        stored.pending_expires_at = forced_expiry;
        stored.failure_kind = None;
        let bytes = to_vec(&stored)?;
        worker.patch_state(governance.id(), &key, &bytes).await?;
    }
    let patched = get_proposal(&governance, proposal_id).await?;
    assert_eq!(patched.status, governance::ProposalStatus::Pending);
    assert_eq!(patched.pending_expires_at.0, forced_expiry);

    // Avoid advancing blocks to prevent the delayed snapshot callback from completing.
    let result = admin
        .call(governance.id(), "expire_pending_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(
        proposal.failure_kind,
        Some(governance::FailureKind::PendingExpired)
    );
    Ok(())
}
