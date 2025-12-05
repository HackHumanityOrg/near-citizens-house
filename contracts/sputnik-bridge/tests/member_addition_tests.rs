//! Member addition flow tests for sputnik-bridge contract

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== MEMBER ADDITION FLOW TESTS ====================

#[tokio::test]
async fn test_add_verified_member_success() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // First verify the user
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Confirm user is verified
    let is_verified = is_user_verified(&env.verified_accounts, user).await?;
    assert!(is_verified, "User should be verified");

    // Add member via bridge
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
    assert!(
        result.is_success(),
        "Add member should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_add_member_creates_proposal() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify user first
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Get initial proposal count
    let initial_id = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);

    // Add member via bridge
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Verify proposal was created
    let new_id = get_last_proposal_id(&env.sputnik_dao).await?;
    assert!(new_id > initial_id, "A proposal should have been created");

    Ok(())
}

#[tokio::test]
async fn test_add_member_auto_approves() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Get the proposal that was created
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    // Bridge should have auto-approved, so proposal should be Approved
    assert_eq!(
        proposal.status,
        ProposalStatus::Approved,
        "Proposal should be auto-approved by bridge. Status: {:?}",
        proposal.status
    );

    Ok(())
}

#[tokio::test]
async fn test_member_appears_in_citizen_role() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Verify user is now in citizen role
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(is_citizen, "User should be in citizen role after being added");

    Ok(())
}

#[tokio::test]
async fn test_add_member_unauthorized() -> anyhow::Result<()> {
    let env = setup_with_users(2).await?;
    let user = env.user(0);
    let unauthorized = env.user(1);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Try to add member from unauthorized account
    let result = unauthorized
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user.id() }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(300))
        .transact()
        .await?;

    assert!(result.is_failure(), "Should fail from unauthorized account");
    assert!(contains_error(&result, "Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_add_unverified_member_fails() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // User is NOT verified - try to add directly
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    assert!(result.is_failure(), "Should fail for unverified user");
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains("not verified") || failures.contains("Account is not verified"),
        "Expected 'not verified' error, got: {}",
        failures
    );

    Ok(())
}

#[tokio::test]
async fn test_add_multiple_members() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    // Verify and add all users
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    // Verify all users are in citizen role
    for user in &env.users {
        let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
        assert!(is_citizen, "User {} should be in citizen role", user.id());
    }

    Ok(())
}

#[tokio::test]
async fn test_add_member_already_citizen() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Verify user is a citizen
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(is_citizen, "User should be a citizen");

    // Get proposal count before re-adding
    let initial_proposal_count = get_last_proposal_id(&env.sputnik_dao).await?;

    // Try to add the same user again - this tests idempotency
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    // SputnikDAO allows idempotent member additions (adding existing member is a no-op)
    // The bridge should succeed because verification passes and DAO accepts the proposal
    assert!(
        result.is_success(),
        "Re-adding existing citizen should succeed (idempotent). Failures: {:?}",
        result.failures()
    );

    // New proposals should be created (even if the member already exists)
    // Each add_member creates 2 proposals: AddMemberToRole + ChangePolicyAddOrUpdateRole (quorum update)
    let final_proposal_count = get_last_proposal_id(&env.sputnik_dao).await?;
    assert_eq!(
        final_proposal_count,
        initial_proposal_count + 2,
        "Two new proposals should be created even for existing citizen (member + quorum update)"
    );

    // User should still be a citizen (no state corruption)
    let is_still_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(is_still_citizen, "User should still be a citizen after duplicate add");

    Ok(())
}
