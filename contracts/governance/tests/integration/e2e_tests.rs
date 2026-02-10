use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, setup_env, store_verification,
    DEFAULT_GRACE_PERIOD_SECS,
};

#[tokio::test]
async fn it_e2e_001_full_happy_path_yes_wins() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(4).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p1", None, NearToken::from_near(1)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);

    for user in users.iter().take(3) {
        let result = user
            .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
            .transact()
            .await?;
        assert!(result.is_success());
    }
    let result = crate::helpers::user(&users, 3)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "no" }))
        .transact()
        .await?;
    assert!(result.is_success());

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
    assert_eq!(proposal.yes_votes, 3);
    assert_eq!(proposal.no_votes, 1);
    Ok(())
}

#[tokio::test]
async fn it_e2e_002_full_happy_path_no_wins() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(4).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p2", None, NearToken::from_near(1)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Active);

    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    for user in users.iter().skip(1).take(3) {
        let result = user
            .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": proposal_id, "choice": "no" }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(governance::FailureKind::Rejected));
    Ok(())
}

#[tokio::test]
async fn it_e2e_003_quorum_not_met() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(4).await?;
    let result = admin
        .call(governance.id(), "update_quorum_bps")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "new_bps": 10_000 }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal_id =
        create_proposal(&admin, &governance, "p3", None, NearToken::from_near(1)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());

    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(governance::FailureKind::QuorumNotMet));
    Ok(())
}

#[tokio::test]
async fn it_e2e_004_start_delay_happy_path() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;
    let now = worker.view_block().await?.timestamp();
    let start_at = now + 5_000_000_000;
    let proposal_id =
        create_proposal(&admin, &governance, "p4", Some(start_at), NearToken::from_near(1)).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());

    fast_forward_to_timestamp(&worker, start_at).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
async fn it_e2e_005_non_admin_cannot_create_proposal() -> anyhow::Result<()> {
    let (_worker, governance, _verified, _admin, _backend, users) = setup_env(1).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "create_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_near(1))
        .args_json(json!({
            "title": "t",
            "author": "a",
            "description": "d",
            "start_at": null
        }))
        .transact()
        .await?;
    assert!(result.is_failure());
    Ok(())
}

#[tokio::test]
async fn it_e2e_006_non_admin_can_finalize() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p6", None, NearToken::from_near(1)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
async fn it_e2e_007_cancel_after_ends_at() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p7", None, NearToken::from_near(1)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    let proposal = get_proposal(&governance, proposal_id).await?;
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);
    Ok(())
}

#[tokio::test]
async fn it_e2e_008_concurrentproposals_independent() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(4).await?;
    let p1 = create_proposal(&admin, &governance, "p8a", None, NearToken::from_near(1)).await?;
    let p2 = create_proposal(&admin, &governance, "p8b", None, NearToken::from_near(1)).await?;

    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p1, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    let result = crate::helpers::user(&users, 1)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2, "choice": "no" }))
        .transact()
        .await?;
    assert!(result.is_success());

    let prop1 = get_proposal(&governance, p1).await?;
    let prop2 = get_proposal(&governance, p2).await?;
    fast_forward_to_timestamp(&worker, prop1.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p1 }))
        .transact()
        .await?;
    assert!(result.is_success());
    fast_forward_to_timestamp(&worker, prop2.ends_at.0 + 1).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": p2 }))
        .transact()
        .await?;
    assert!(result.is_success());

    let prop1 = get_proposal(&governance, p1).await?;
    let prop2 = get_proposal(&governance, p2).await?;
    assert_ne!(prop1.status, governance::ProposalStatus::Active);
    assert_ne!(prop2.status, governance::ProposalStatus::Active);
    Ok(())
}

#[tokio::test]
async fn it_e2e_009_verified_at_equals_created_at_boundary() -> anyhow::Result<()> {
    let (worker, governance, verified, admin, backend, mut users) = setup_env(0).await?;
    let user = worker.dev_create_account().await?;
    users.push(user);

    // Store verification and create proposal immediately after; sandbox often uses same timestamp.
    store_verification(
        &backend,
        &verified,
        crate::helpers::user(&users, 0),
        "Identify myself",
        [1u8; 32],
    )
    .await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p9", None, NearToken::from_near(1)).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
async fn it_e2e_010_lifecycle_continuity_after_cancel() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let p1 = create_proposal(&admin, &governance, "p10", None, NearToken::from_near(1)).await?;
    let result = admin
        .call(governance.id(), "cancel_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": p1 }))
        .transact()
        .await?;
    assert!(result.is_success());
    let p2 = create_proposal(&admin, &governance, "p10b", None, NearToken::from_near(1)).await?;
    assert_eq!(p2, p1 + 1);
    Ok(())
}

#[tokio::test]
async fn it_e2e_011_deferred_start_end_to_end() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let now = worker.view_block().await?.timestamp();
    let start_at = now + 5_000_000_000;
    let proposal_id =
        create_proposal(&admin, &governance, "p11", Some(start_at), NearToken::from_near(1)).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());

    fast_forward_to_timestamp(&worker, start_at).await?;
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
    Ok(())
}

#[tokio::test]
async fn it_e2e_012_concurrent_votes_sameproposal() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(4).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "p12", None, NearToken::from_near(1)).await?;
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
    assert_eq!(proposal.yes_votes, users.len() as u64);
    Ok(())
}

#[tokio::test]
async fn it_prop_id_001proposal_ids_sequential() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let p1 = create_proposal(&admin, &governance, "pid1", None, NearToken::from_near(1)).await?;
    let p2 = create_proposal(&admin, &governance, "pid2", None, NearToken::from_near(1)).await?;
    assert_eq!(p1, 0);
    assert_eq!(p2, 1);
    Ok(())
}

#[tokio::test]
async fn it_final_002_finalize_after_grace_proceeds() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id =
        create_proposal(&admin, &governance, "pg", None, NearToken::from_near(1)).await?;
    let proposal = get_proposal(&governance, proposal_id).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    let target = proposal.ends_at.0 + (DEFAULT_GRACE_PERIOD_SECS * 1_000_000_000) + 1;
    fast_forward_to_timestamp(&worker, target).await?;
    let result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(result.is_success());
    Ok(())
}
