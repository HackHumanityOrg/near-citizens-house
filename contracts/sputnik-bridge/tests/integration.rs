//! Integration tests for sputnik-bridge contract
//!
//! These tests use real sputnik-dao, verified-accounts, and bridge contracts
//! to verify the full end-to-end flows.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== A. SETUP TESTS ====================

#[tokio::test]
async fn test_full_setup() -> anyhow::Result<()> {
    let env = setup().await?;

    // Verify all contracts are deployed
    assert!(!env.sputnik_dao.id().to_string().is_empty());
    assert!(!env.verified_accounts.id().to_string().is_empty());
    assert!(!env.bridge.id().to_string().is_empty());

    // Verify bridge initialization
    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;
    assert_eq!(info.backend_wallet, env.backend.id().to_string());
    assert_eq!(info.sputnik_dao, env.sputnik_dao.id().to_string());
    assert_eq!(
        info.verified_accounts_contract,
        env.verified_accounts.id().to_string()
    );
    assert_eq!(info.citizen_role, "citizen");

    Ok(())
}

#[tokio::test]
async fn test_bridge_connected_to_dao() -> anyhow::Result<()> {
    let env = setup().await?;

    // Verify DAO policy has bridge in bridge role (matches production dao-policy.json)
    let is_in_bridge_role = is_account_in_role(&env.sputnik_dao, env.bridge.id().as_str(), "bridge").await?;
    assert!(is_in_bridge_role, "Bridge should be in bridge role");

    Ok(())
}

#[tokio::test]
async fn test_dao_policy_configured_correctly() -> anyhow::Result<()> {
    let env = setup().await?;

    let policy = get_dao_policy(&env.sputnik_dao).await?;

    // Verify proposal period is short (10 seconds)
    let proposal_period = policy
        .get("proposal_period")
        .and_then(|p| p.as_str())
        .unwrap();
    assert_eq!(proposal_period, PROPOSAL_PERIOD_NS.to_string());

    // Verify citizen role exists
    let roles = policy.get("roles").and_then(|r| r.as_array()).unwrap();
    let citizen_role = roles.iter().find(|r| r.get("name").and_then(|n| n.as_str()) == Some("citizen"));
    assert!(citizen_role.is_some(), "Citizen role should exist");

    Ok(())
}

// ==================== B. MEMBER ADDITION FLOW TESTS ====================

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
        .gas(Gas::from_tgas(200))
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

// ==================== C. PROPOSAL CREATION TESTS ====================

#[tokio::test]
async fn test_create_vote_proposal_success() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "Test proposal description").await?;
    assert!(
        result.is_success(),
        "Create proposal should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_returns_id() -> anyhow::Result<()> {
    let env = setup().await?;

    let initial_id = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);

    create_proposal_via_bridge(&env.backend, &env.bridge, "Test proposal").await?.into_result()?;

    let new_id = get_last_proposal_id(&env.sputnik_dao).await?;
    assert!(new_id > initial_id, "Proposal ID should increase");

    // Verify proposal exists and is a Vote type
    let proposal = get_proposal(&env.sputnik_dao, new_id - 1).await?;
    assert!(
        proposal.kind.as_str() == Some("Vote") || proposal.kind.get("Vote").is_some(),
        "Proposal should be Vote type. Kind: {:?}",
        proposal.kind
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_unauthorized() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let unauthorized = env.user(0);

    let result = unauthorized
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({ "description": "Test proposal" }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "Only backend wallet"));

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_empty_description() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "").await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "cannot be empty"));

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_too_long() -> anyhow::Result<()> {
    let env = setup().await?;
    let long_description = "x".repeat(10_001);

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, &long_description).await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "exceeds maximum"));

    Ok(())
}

// ==================== D. VOTING FLOW TESTS ====================

#[tokio::test]
async fn test_citizen_can_vote_on_proposal() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Should we do X?").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Citizen votes on the proposal
    let result = vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    assert!(
        result.is_success(),
        "Citizen should be able to vote. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_citizen_vote_approve() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    create_proposal_via_bridge(&env.backend, &env.bridge, "Approve this?").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
        .await?
        .into_result()?;

    // Check proposal status - with only one citizen who approved, it should pass
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::Approved,
        "Proposal should be approved with majority yes"
    );

    Ok(())
}

#[tokio::test]
async fn test_citizen_vote_reject() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    create_proposal_via_bridge(&env.backend, &env.bridge, "Reject this?").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteReject", json!("Vote"))
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::Rejected,
        "Proposal should be rejected with majority no"
    );

    Ok(())
}

#[tokio::test]
async fn test_non_citizen_cannot_vote() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let non_citizen = env.user(0);

    // User is NOT a citizen (not verified and added)
    create_proposal_via_bridge(&env.backend, &env.bridge, "Can non-citizen vote?").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    let result = vote_on_proposal(
        non_citizen,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    assert!(result.is_failure(), "Non-citizen should not be able to vote");

    Ok(())
}

#[tokio::test]
async fn test_proposal_passes_with_majority() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    // Add all users as citizens
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    create_proposal_via_bridge(&env.backend, &env.bridge, "Majority vote").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // First vote - proposal still in progress (1/3 approve, threshold is 1/2)
    vote_on_proposal(env.user(0), &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::InProgress,
        "After 1/3 votes, proposal should still be in progress"
    );

    // Second vote - this should pass the proposal (2/3 >= 1/2 threshold)
    vote_on_proposal(env.user(1), &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::Approved,
        "Proposal should pass with 2/3 approval majority"
    );

    Ok(())
}

#[tokio::test]
async fn test_proposal_fails_with_majority_no() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    create_proposal_via_bridge(&env.backend, &env.bridge, "Reject majority").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // First reject vote - still in progress
    vote_on_proposal(env.user(0), &env.sputnik_dao, proposal_id, "VoteReject", json!("Vote"))
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::InProgress,
        "After 1/3 reject votes, proposal should still be in progress"
    );

    // Second reject vote - this should reject the proposal (2/3 >= 1/2 threshold)
    vote_on_proposal(env.user(1), &env.sputnik_dao, proposal_id, "VoteReject", json!("Vote"))
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::Rejected,
        "Proposal should fail with 2/3 rejection"
    );

    Ok(())
}

// ==================== E. TIME-BASED TESTS ====================

#[tokio::test]
async fn test_proposal_expires_after_period() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Add user as citizen first
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Will expire").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Proposal should be InProgress initially
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::InProgress,
        "Proposal should be InProgress initially"
    );

    // Advance time way past proposal period (100 blocks for 10s period)
    env.worker.fast_forward(100).await?;

    // Try to vote after expiration - this should fail or mark as expired
    let vote_result = vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote")).await?;

    // The proposal should now be expired (vote triggers status update)
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    // Note: In sputnik-dao, voting on an expired proposal marks it as Expired
    assert_eq!(
        proposal.status,
        ProposalStatus::Expired,
        "Proposal should be expired after period. Vote result: {:?}",
        vote_result.is_success()
    );

    Ok(())
}

#[tokio::test]
async fn test_vote_before_expiry_succeeds() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    create_proposal_via_bridge(&env.backend, &env.bridge, "Vote quickly").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Vote immediately (within period)
    let result = vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote")).await?;
    assert!(result.is_success(), "Vote before expiry should succeed");

    Ok(())
}

// ==================== F. EVENT TESTS ====================

#[tokio::test]
async fn test_member_added_event_emitted() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    // Extract logs before consuming result
    let logs = extract_event_logs(&result);
    result.into_result()?;

    let events = parse_events(&logs);

    let member_added = events.iter().find(|e| e.event == "member_added");
    assert!(
        member_added.is_some(),
        "member_added event should be emitted. Events: {:?}",
        events
    );

    Ok(())
}

#[tokio::test]
async fn test_proposal_created_event_emitted() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "Event test").await?;

    // Extract logs before consuming result
    let logs = extract_event_logs(&result);
    result.into_result()?;

    let events = parse_events(&logs);

    let proposal_created = events.iter().find(|e| e.event == "proposal_created");
    assert!(
        proposal_created.is_some(),
        "proposal_created event should be emitted. Events: {:?}",
        events
    );

    Ok(())
}

// ==================== G. ADMIN TESTS ====================

#[tokio::test]
async fn test_update_backend_wallet() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let new_backend = env.user(0);

    env.backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    let backend_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;
    assert_eq!(backend_wallet, new_backend.id().to_string());

    Ok(())
}

#[tokio::test]
async fn test_update_citizen_role() -> anyhow::Result<()> {
    let env = setup().await?;

    env.backend
        .call(env.bridge.id(), "update_citizen_role")
        .args_json(json!({ "new_role": "voter" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    let citizen_role: String = env.bridge.view("get_citizen_role").await?.json()?;
    assert_eq!(citizen_role, "voter");

    Ok(())
}

#[tokio::test]
async fn test_get_info() -> anyhow::Result<()> {
    let env = setup().await?;

    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    assert_eq!(info.backend_wallet, env.backend.id().to_string());
    assert_eq!(info.sputnik_dao, env.sputnik_dao.id().to_string());
    assert_eq!(info.verified_accounts_contract, env.verified_accounts.id().to_string());
    assert_eq!(info.citizen_role, "citizen");

    Ok(())
}

// ==================== H. ACCESS CONTROL SECURITY TESTS ====================

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

// ==================== I. CALLBACK SECURITY TESTS ====================

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

// ==================== J. EDGE CASE TESTS ====================

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

    // A new proposal should be created (even if the member already exists)
    let final_proposal_count = get_last_proposal_id(&env.sputnik_dao).await?;
    assert_eq!(
        final_proposal_count,
        initial_proposal_count + 1,
        "A new proposal should be created even for existing citizen"
    );

    // User should still be a citizen (no state corruption)
    let is_still_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(is_still_citizen, "User should still be a citizen after duplicate add");

    Ok(())
}

#[tokio::test]
async fn test_cannot_vote_twice_on_same_proposal() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Double vote test").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // First vote should succeed
    vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
        .await?
        .into_result()?;

    // Second vote on same proposal should fail
    let result = vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote")).await?;

    // Should fail because user already voted
    assert!(result.is_failure(), "User should not be able to vote twice on same proposal");

    Ok(())
}

#[tokio::test]
async fn test_vote_on_nonexistent_proposal_fails() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;

    // Try to vote on a proposal that doesn't exist (very high ID)
    let result = vote_on_proposal(user, &env.sputnik_dao, 999999, "VoteApprove", json!("Vote")).await?;

    assert!(result.is_failure(), "Voting on nonexistent proposal should fail");

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_exactly_max_length() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create description with exactly 10,000 characters (the max)
    let max_description = "x".repeat(10_000);

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, &max_description).await?;

    // Should succeed at exactly the boundary
    assert!(
        result.is_success(),
        "Proposal with exactly max length should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_single_char_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with minimum valid description (1 character)
    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "x").await?;

    // Should succeed - single character is valid
    assert!(
        result.is_success(),
        "Proposal with single char description should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_whitespace_only_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with only whitespace (spaces, tabs, newlines)
    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "   \t\n   ").await?;

    // Contract should reject whitespace-only descriptions as effectively empty
    assert!(result.is_failure(), "Whitespace-only description should be rejected");
    assert!(
        contains_error(&result, "cannot be empty"),
        "Should fail with 'cannot be empty' error. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_unicode_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with unicode characters (emoji, CJK, etc.)
    let unicode_description = "Vote on 🗳️ proposal 提案 مقترح";

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, unicode_description).await?;

    // Should succeed - unicode is valid text
    assert!(
        result.is_success(),
        "Proposal with unicode description should succeed. Failures: {:?}",
        result.failures()
    );

    // Verify the proposal was created with correct description
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert!(
        proposal.description.contains("🗳️") && proposal.description.contains("提案"),
        "Description should preserve unicode characters"
    );

    Ok(())
}

// ==================== K. DEPOSIT/BOND TESTS ====================

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
        .gas(Gas::from_tgas(200))
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
async fn test_create_proposal_insufficient_deposit() -> anyhow::Result<()> {
    let env = setup().await?;

    // Try to create proposal with insufficient deposit
    let result = env
        .backend
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({ "description": "Underfunded proposal" }))
        .deposit(NearToken::from_millinear(100)) // 0.1 NEAR instead of 1 NEAR
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail due to insufficient proposal bond
    assert!(result.is_failure(), "Create proposal with insufficient deposit should fail");

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
        .gas(Gas::from_tgas(200))
        .transact()
        .await?;

    // Should fail due to zero deposit
    assert!(result.is_failure(), "Add member with zero deposit should fail");

    Ok(())
}

// ==================== L. CROSS-CONTRACT CALL FAILURE TESTS ====================
//
// These tests verify that the bridge handles cross-contract call failures correctly.
// Per the NEAR security guide, state should remain consistent when callbacks fail,
// and the system should handle partial failures gracefully.

#[tokio::test]
async fn test_add_member_verification_fails_no_state_change() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // User is NOT verified - the verification cross-contract call will return false
    // which triggers a panic in callback_add_member

    // Get initial state
    let initial_proposal_count = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);

    // Try to add unverified member
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    // Should fail
    assert!(result.is_failure(), "Should fail for unverified user");

    // Verify NO proposal was created in DAO (state unchanged)
    let final_proposal_count = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);
    assert_eq!(
        initial_proposal_count, final_proposal_count,
        "No proposal should be created when verification fails"
    );

    // Verify user is NOT in citizen role
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(!is_citizen, "User should not be added when verification fails");

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_dao_failure_no_event() -> anyhow::Result<()> {
    let env = setup().await?;

    // Try to create proposal with insufficient deposit - DAO will reject
    let result = env
        .backend
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({ "description": "Will fail at DAO" }))
        .deposit(NearToken::from_millinear(100)) // Insufficient
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail
    assert!(result.is_failure(), "Should fail with insufficient deposit");

    // Verify no proposal_created event was emitted (callback didn't complete)
    let logs = extract_event_logs(&result);
    let events = parse_events(&logs);

    let proposal_created = events.iter().find(|e| e.event == "proposal_created");
    assert!(
        proposal_created.is_none(),
        "No proposal_created event should be emitted on failure"
    );

    Ok(())
}

#[tokio::test]
async fn test_add_member_dao_failure_no_event() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify user first (so verification passes)
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Try to add member with insufficient deposit - DAO will reject the proposal
    let result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user.id() }))
        .deposit(NearToken::from_millinear(100)) // Insufficient for DAO bond
        .gas(Gas::from_tgas(200))
        .transact()
        .await?;

    // Should fail at DAO level
    assert!(result.is_failure(), "Should fail with insufficient deposit");

    // Verify no member_added event was emitted
    let logs = extract_event_logs(&result);
    let events = parse_events(&logs);

    let member_added = events.iter().find(|e| e.event == "member_added");
    assert!(
        member_added.is_none(),
        "No member_added event should be emitted on DAO failure"
    );

    // Verify user was NOT added to citizen role
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(!is_citizen, "User should not be added when DAO rejects proposal");

    Ok(())
}

#[tokio::test]
async fn test_multiple_failures_dont_corrupt_state() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    // Get initial state
    let initial_proposal_count = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);

    // Attempt multiple operations that will fail

    // 1. Unverified user
    let _result1 = add_member_via_bridge(&env.backend, &env.bridge, env.user(0)).await?;

    // 2. Insufficient deposit
    let _result2 = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": env.user(1).id() }))
        .deposit(NearToken::from_millinear(10))
        .gas(Gas::from_tgas(200))
        .transact()
        .await?;

    // 3. Empty description proposal
    let _result3 = create_proposal_via_bridge(&env.backend, &env.bridge, "").await?;

    // Verify state is still consistent
    let final_proposal_count = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);
    assert_eq!(
        initial_proposal_count, final_proposal_count,
        "No proposals should be created after multiple failures"
    );

    // Now do a successful operation to verify the system still works
    verify_user(&env.backend, &env.verified_accounts, env.user(2), 2).await?;
    let success_result = add_member_via_bridge(&env.backend, &env.bridge, env.user(2)).await?;
    assert!(
        success_result.is_success(),
        "System should still work after failures. Failures: {:?}",
        success_result.failures()
    );

    // Verify the successful user is a citizen
    let is_citizen = is_account_in_role(&env.sputnik_dao, env.user(2).id().as_str(), "citizen").await?;
    assert!(is_citizen, "Successfully added user should be a citizen");

    Ok(())
}

#[tokio::test]
async fn test_gas_exhaustion_partial_operation() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify user first
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    // Try to add member with very low gas (should fail during cross-contract calls)
    let result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user.id() }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(10)) // Very low gas - not enough for cross-contract calls
        .transact()
        .await?;

    // Should fail due to gas exhaustion
    assert!(result.is_failure(), "Should fail with insufficient gas");

    // Verify the failure is gas-related (prepaid gas exceeded, not enough gas, etc.)
    let has_gas_error = contains_error(&result, "gas")
        || contains_error(&result, "Gas")
        || contains_error(&result, "Exceeded")
        || contains_error(&result, "prepaid");
    assert!(
        has_gas_error,
        "Error should mention gas exhaustion. Failures: {:?}",
        result.failures()
    );

    // Verify user was NOT added (no partial state corruption)
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(
        !is_citizen,
        "User should not be in citizen role after gas exhaustion failure"
    );

    Ok(())
}

#[tokio::test]
async fn test_successful_operation_after_failed_callback() -> anyhow::Result<()> {
    let env = setup_with_users(2).await?;
    let user1 = env.user(0);
    let user2 = env.user(1);

    // First operation: try to add unverified user (fails in callback)
    let _fail_result = add_member_via_bridge(&env.backend, &env.bridge, user1).await?;

    // Second operation: verify and add a different user (should succeed)
    verify_user(&env.backend, &env.verified_accounts, user2, 1).await?;
    let success_result = add_member_via_bridge(&env.backend, &env.bridge, user2).await?;

    assert!(
        success_result.is_success(),
        "Should succeed after previous failure. Failures: {:?}",
        success_result.failures()
    );

    // Verify user2 is a citizen but user1 is not
    let is_user1_citizen = is_account_in_role(&env.sputnik_dao, user1.id().as_str(), "citizen").await?;
    let is_user2_citizen = is_account_in_role(&env.sputnik_dao, user2.id().as_str(), "citizen").await?;

    assert!(!is_user1_citizen, "User1 should NOT be a citizen (failed)");
    assert!(is_user2_citizen, "User2 should be a citizen (succeeded)");

    Ok(())
}

// ==================== M. CONCURRENT OPERATIONS TESTS ====================
//
// These tests verify that the contract handles multiple operations correctly
// when executed in sequence (simulating concurrent load).

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
