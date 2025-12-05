//! Access control and callback security tests for sputnik-bridge contract

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== ACCESS CONTROL SECURITY TESTS ====================

#[tokio::test]
async fn test_update_backend_wallet_unauthorized() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let unauthorized = env.user(0);

    let result = unauthorized
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": unauthorized.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    assert!(result.is_failure(), "Unauthorized user should not be able to update backend wallet");
    assert!(contains_error(&result, "Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_update_citizen_role_unauthorized() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let unauthorized = env.user(0);

    let result = unauthorized
        .call(env.bridge.id(), "update_citizen_role")
        .args_json(json!({ "new_role": "hacker" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    assert!(result.is_failure(), "Unauthorized user should not be able to update citizen role");
    assert!(contains_error(&result, "Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_citizen_cannot_add_proposal_to_dao_directly() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Verify user is a citizen
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(is_citizen, "User should be a citizen");

    // Citizen tries to add a proposal directly to DAO (bypassing bridge)
    let result = user
        .call(env.sputnik_dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "Bypass attempt",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    // Should fail because citizens don't have AddProposal permission in production policy
    assert!(result.is_failure(), "Citizen should not be able to add proposals directly to DAO");

    Ok(())
}

#[tokio::test]
async fn test_random_account_cannot_add_proposal_to_dao() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let random_account = env.user(0);

    // Random account (not citizen, not bridge) tries to add a proposal
    let result = random_account
        .call(env.sputnik_dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "Random attack",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    // Should fail because only bridge role can add proposals
    assert!(result.is_failure(), "Random account should not be able to add proposals to DAO");

    Ok(())
}

#[tokio::test]
async fn test_citizen_cannot_vote_remove() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test proposal").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Citizen tries to VoteRemove (which they don't have permission for)
    let result = vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteRemove", json!("Vote")).await?;

    // Should fail because citizens only have VoteApprove and VoteReject
    assert!(result.is_failure(), "Citizen should not be able to VoteRemove");

    Ok(())
}

#[tokio::test]
async fn test_anyone_can_finalize_proposal() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let random_account = env.user(0);

    // Create a Vote proposal (will be InProgress initially)
    create_proposal_via_bridge(&env.backend, &env.bridge, "Finalize test").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Verify proposal is InProgress before finalization
    let proposal_before = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal_before.status,
        ProposalStatus::InProgress,
        "Proposal should be InProgress initially"
    );

    // Advance time past proposal period to make it finalizable
    env.worker.fast_forward(100).await?;

    // Random account (not citizen, not bridge) tries to finalize
    // Per production policy, "all" role has *:Finalize permission
    let result = random_account
        .call(env.sputnik_dao.id(), "act_proposal")
        .args_json(json!({
            "id": proposal_id,
            "action": "Finalize",
            "proposal": "Vote",
            "memo": null
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    // Finalize should succeed (per "all" role permissions)
    assert!(
        result.is_success(),
        "Random account should be able to finalize proposals. Failures: {:?}",
        result.failures()
    );

    // Proposal should now be Expired (finalized with no votes after period)
    let proposal_after = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal_after.status,
        ProposalStatus::Expired,
        "Proposal should be Expired after finalization with no votes"
    );

    Ok(())
}

// ==================== CALLBACK SECURITY TESTS ====================

#[tokio::test]
async fn test_callback_add_member_cannot_be_called_externally() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let attacker = env.user(0);

    // Attacker tries to call callback_add_member directly
    let result = attacker
        .call(env.bridge.id(), "callback_add_member")
        .args_json(json!({ "near_account_id": attacker.id() }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure(), "External call to callback_add_member should fail");

    // Verify it fails due to #[private] macro protection (predecessor != current_account)
    let error_indicates_private = contains_error(&result, "predecessor")
        || contains_error(&result, "Method callback_add_member is private");
    assert!(
        error_indicates_private,
        "Should fail due to #[private] macro protection. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_callback_proposal_created_cannot_be_called_externally() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let attacker = env.user(0);

    // Attacker tries to call callback_proposal_created directly
    let result = attacker
        .call(env.bridge.id(), "callback_proposal_created")
        .args_json(json!({ "near_account_id": attacker.id() }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure(), "External call to callback_proposal_created should fail");

    // Verify it fails due to #[private] macro protection
    let error_indicates_private = contains_error(&result, "predecessor")
        || contains_error(&result, "Method callback_proposal_created is private");
    assert!(
        error_indicates_private,
        "Should fail due to #[private] macro protection. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_callback_member_added_cannot_be_called_externally() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let attacker = env.user(0);

    // Attacker tries to call callback_member_added directly
    let result = attacker
        .call(env.bridge.id(), "callback_member_added")
        .args_json(json!({
            "near_account_id": attacker.id(),
            "proposal_id": 0
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure(), "External call to callback_member_added should fail");

    // Verify it fails due to #[private] macro protection
    let error_indicates_private = contains_error(&result, "predecessor")
        || contains_error(&result, "Method callback_member_added is private");
    assert!(
        error_indicates_private,
        "Should fail due to #[private] macro protection. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_callback_vote_proposal_created_cannot_be_called_externally() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let attacker = env.user(0);

    // Attacker tries to call callback_vote_proposal_created directly
    let result = attacker
        .call(env.bridge.id(), "callback_vote_proposal_created")
        .args_json(json!({ "description": "fake proposal" }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure(), "External call to callback_vote_proposal_created should fail");

    // Verify it fails due to #[private] macro protection
    let error_indicates_private = contains_error(&result, "predecessor")
        || contains_error(&result, "Method callback_vote_proposal_created is private");
    assert!(
        error_indicates_private,
        "Should fail due to #[private] macro protection. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}
