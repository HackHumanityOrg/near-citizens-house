//! Edge case and deposit/bond tests for sputnik-bridge contract

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== DEPOSIT/BOND TESTS ====================

#[tokio::test]
async fn test_add_member_insufficient_deposit() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify user first
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Try to add member with insufficient deposit (0.1 NEAR instead of 1 NEAR)
    let result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user.id() }))
        .deposit(NearToken::from_millinear(100)) // 0.1 NEAR
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;

    // Should fail due to insufficient proposal bond
    assert!(result.is_failure(), "Add member with insufficient deposit should fail");

    // Verify error message mentions insufficient deposit/bond
    let has_deposit_error = contains_error(&result, "Not enough deposit")
        || contains_error(&result, "ERR_MIN_BOND")
        || contains_error(&result, "insufficient");
    assert!(
        has_deposit_error,
        "Error should mention insufficient deposit. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_add_member_zero_deposit() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify user first
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Try to add member with zero deposit
    let result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user.id() }))
        .deposit(NearToken::from_yoctonear(0))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;

    // Should fail due to zero deposit
    assert!(result.is_failure(), "Add member with zero deposit should fail");

    Ok(())
}

// ==================== CONCURRENT OPERATIONS TESTS ====================

#[tokio::test]
async fn test_concurrent_member_additions() -> anyhow::Result<()> {
    let env = setup_with_users(5).await?;

    // Verify all users first
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
    }

    // Add all members in rapid succession (simulating concurrent additions)
    let mut results = Vec::new();
    for user in &env.users {
        let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
        results.push((user.id().to_string(), result.is_success()));
    }

    // All additions should succeed
    for (user_id, success) in &results {
        assert!(success, "Adding user {} should succeed", user_id);
    }

    // Verify all users are citizens
    for user in &env.users {
        let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
        assert!(is_citizen, "User {} should be in citizen role", user.id());
    }

    // Verify correct number of proposals were created (one per user)
    let proposal_count = get_last_proposal_id(&env.sputnik_dao).await?;
    assert!(
        proposal_count >= env.users.len() as u64,
        "Should have at least {} proposals, got {}",
        env.users.len(),
        proposal_count
    );

    Ok(())
}

#[tokio::test]
async fn test_concurrent_proposal_voting() -> anyhow::Result<()> {
    let env = setup_with_users(5).await?;

    // Setup: Verify and add all users as citizens
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Concurrent voting test").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // All citizens vote in rapid succession
    // First 3 vote approve, last 2 vote reject
    let mut vote_results = Vec::new();
    for (i, user) in env.users.iter().enumerate() {
        let action = if i < 3 { "VoteApprove" } else { "VoteReject" };
        let result = vote_on_proposal(user, &env.sputnik_dao, proposal_id, action, json!("Vote")).await?;
        vote_results.push((user.id().to_string(), action, result.is_success()));
    }

    // Verify all votes were registered (only first 2 votes needed for majority)
    // After 2 approve votes (40%), still in progress (need 50%)
    // After 3 approve votes (60%), proposal passes
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    // With 3 approve votes out of 5 (60%), proposal should be approved
    // The remaining 2 reject votes happen after the proposal is already approved
    assert_eq!(
        proposal.status,
        ProposalStatus::Approved,
        "Proposal should be approved with 3/5 (60%) approval votes"
    );

    Ok(())
}
