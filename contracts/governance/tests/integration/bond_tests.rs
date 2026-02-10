use near_workspaces::types::NearToken;
use borsh::{to_vec, BorshDeserialize};
use serde_json::json;

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, init_governance,
    init_verified_accounts, proposal_storage_key, setup_env,
};

async fn contract_balance(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    governance: &near_workspaces::Contract,
) -> anyhow::Result<u128> {
    Ok(worker
        .view_account(governance.id())
        .await?
        .balance
        .as_yoctonear())
}

#[tokio::test]
async fn it_bond_001_retained_after_succeeded() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;
    let before = contract_balance(&worker, &governance).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "bond1", None, NearToken::from_near(1)).await?;
    let after_create = contract_balance(&worker, &governance).await?;
    assert!(after_create > before);

    for user in &users {
        let result = user
            .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    let proposal = get_proposal(&governance, proposal_id).await?;
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let after = contract_balance(&worker, &governance).await?;
    assert!(after >= after_create);
    Ok(())
}

#[tokio::test]
async fn it_bond_002_retained_after_quorum_not_met() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;
    let result = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 10_000 }))
        .transact()
        .await?;
    assert!(result.is_success());

    let _before = contract_balance(&worker, &governance).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "bond2", None, NearToken::from_near(1)).await?;
    let after_create = contract_balance(&worker, &governance).await?;

    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal = get_proposal(&governance, proposal_id).await?;
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let after = contract_balance(&worker, &governance).await?;
    assert!(after >= after_create);
    Ok(())
}

#[tokio::test]
async fn it_bond_003_retained_after_cancelled() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let _before = contract_balance(&worker, &governance).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "bond3", None, NearToken::from_near(1)).await?;
    let after_create = contract_balance(&worker, &governance).await?;

    let result = admin
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let after = contract_balance(&worker, &governance).await?;
    assert!(after >= after_create);
    Ok(())
}

#[tokio::test]
async fn it_bond_004_retained_after_pending_expired() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "bond4", None, NearToken::from_near(1)).await?;
    let after_create = contract_balance(&worker, &governance).await?;
    let _proposal = get_proposal(&governance, proposal_id).await?;
    let block = worker.view_block().await?;
    let forced_expiry = block.timestamp().saturating_add(1_000_000_000);

    // Force pending state to ensure expiry path.
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
    fast_forward_to_timestamp(&worker, forced_expiry).await?;
    let result = admin
        .call(governance.id(), "expire_pending_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let after = contract_balance(&worker, &governance).await?;
    assert!(after >= after_create);
    Ok(())
}

#[tokio::test]
async fn it_bond_005_retained_after_snapshot_callback_failed() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let (verified_contract, _backend) = init_verified_accounts(&worker).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &verified_contract, &admin).await?;

    let bad_contract = worker.dev_create_account().await?;
    let result = admin
        .call(governance.id(), "update_verified_accounts_contract")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_contract": bad_contract.id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    let _before = contract_balance(&worker, &governance).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "bond5", None, NearToken::from_near(1)).await?;
    let after_create = contract_balance(&worker, &governance).await?;

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);

    let after = contract_balance(&worker, &governance).await?;
    assert!(after >= after_create);
    Ok(())
}

#[tokio::test]
async fn it_bond_006_bond_exceeds_minimum() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let before = contract_balance(&worker, &governance).await?;
    let _proposal_id =
        create_proposal(&admin, &governance, "bond6", None, NearToken::from_near(5)).await?;
    let after = contract_balance(&worker, &governance).await?;
    assert!(after >= before + NearToken::from_near(5).as_yoctonear());
    Ok(())
}
