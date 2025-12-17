//! Voting flow tests for sputnik-bridge contract

use super::helpers::*;
use allure_rs::prelude::*;
use serde_json::json;

// ==================== VOTING FLOW TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Voting")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "happy-path")]
#[allure_description(r#"
## Purpose
Verifies that a verified citizen can successfully vote on a proposal.

## Flow
1. User gets verified through verified-accounts
2. User is added as citizen through bridge
3. Backend creates a proposal
4. Citizen votes on the proposal

## Expected
Vote transaction succeeds.
"#)]

#[allure_test]
#[tokio::test]
async fn test_citizen_can_vote_on_proposal() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Should we do X?")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    // Citizen votes on the proposal
    let result = vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    step("Verify citizen can vote on proposal", || {
        assert!(
            result.is_success(),
            "Citizen should be able to vote. Failures: {:?}",
            result.failures()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Voting")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "approve")]
#[allure_description(r#"
## Purpose
Verifies that VoteApprove from a single citizen results in Approved status.

## Expected
With only 1 citizen voting approve, proposal status becomes Approved.
"#)]

#[allure_test]
#[tokio::test]
async fn test_citizen_vote_approve() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    create_proposal_via_bridge(&env.backend, &env.bridge, "Approve this?")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    // Check proposal status - with only one citizen who approved, it should pass
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal is approved with single citizen vote", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Approved,
            "Proposal should be approved with majority yes"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Voting")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "reject")]
#[allure_description(r#"
## Purpose
Verifies that VoteReject from a single citizen results in Rejected status.

## Expected
With only 1 citizen voting reject, proposal status becomes Rejected.
"#)]

#[allure_test]
#[tokio::test]
async fn test_citizen_vote_reject() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    create_proposal_via_bridge(&env.backend, &env.bridge, "Reject this?")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteReject",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal is rejected with single citizen reject vote", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Rejected,
            "Proposal should be rejected with majority no"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Voting")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "security")]
#[allure_description(r#"
## Purpose
Verifies that non-citizens (users not in the citizen role) cannot vote on proposals.

## Security
Critical access control test - only verified citizens should participate in governance.
"#)]

#[allure_test]
#[tokio::test]
async fn test_non_citizen_cannot_vote() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let non_citizen = env.user(0);

    // User is NOT a citizen (not verified and added)
    create_proposal_via_bridge(&env.backend, &env.bridge, "Can non-citizen vote?")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    let result = vote_on_proposal(
        non_citizen,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    step("Verify non-citizen cannot vote", || {
        assert!(
            result.is_failure(),
            "Non-citizen should not be able to vote: {:?}",
            result.failures()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Outcomes")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "majority")]
#[allure_description(r#"
## Purpose
Verifies proposal passes when majority (>50%) votes approve.

## Scenario
3 citizens: 1st vote → InProgress, 2nd vote → Approved (2/3 ≥ 50%)
"#)]

#[allure_test]
#[tokio::test]
async fn test_proposal_passes_with_majority() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    // Add all users as citizens
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    create_proposal_via_bridge(&env.backend, &env.bridge, "Majority vote")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    // First vote - proposal still in progress (1/3 approve, threshold is 1/2)
    vote_on_proposal(
        env.user(0),
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal still InProgress after 1/3 votes", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::InProgress,
            "After 1/3 votes, proposal should still be in progress"
        );
    });

    // Second vote - this should pass the proposal (2/3 >= 1/2 threshold)
    vote_on_proposal(
        env.user(1),
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal approved with 2/3 majority", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Approved,
            "Proposal should pass with 2/3 approval majority"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Outcomes")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "majority")]
#[allure_description(r#"
## Purpose
Verifies proposal is rejected when majority (>50%) votes reject.

## Scenario
3 citizens: 1st reject → InProgress, 2nd reject → Rejected (2/3 ≥ 50%)
"#)]

#[allure_test]
#[tokio::test]
async fn test_proposal_fails_with_majority_no() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    create_proposal_via_bridge(&env.backend, &env.bridge, "Reject majority")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    // First reject vote - still in progress
    vote_on_proposal(
        env.user(0),
        &env.sputnik_dao,
        proposal_id,
        "VoteReject",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal still InProgress after 1/3 reject votes", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::InProgress,
            "After 1/3 reject votes, proposal should still be in progress"
        );
    });

    // Second reject vote - this should reject the proposal (2/3 >= 1/2 threshold)
    vote_on_proposal(
        env.user(1),
        &env.sputnik_dao,
        proposal_id,
        "VoteReject",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal rejected with 2/3 majority", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Rejected,
            "Proposal should fail with 2/3 rejection"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Voting")]
#[allure_severity("critical")]
#[allure_tags("integration", "voting", "duplicate")]
#[allure_description(r#"
## Purpose
Verifies that a citizen cannot vote twice on the same proposal.

## Security
Prevents vote manipulation by ensuring one-vote-per-citizen per proposal.
"#)]

#[allure_test]
#[tokio::test]
async fn test_cannot_vote_twice_on_same_proposal() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Double vote test")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    // First vote should succeed
    vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    // Second vote on same proposal should fail
    let result = vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    step("Verify double voting is rejected", || {
        // Should fail because user already voted
        assert!(
            result.is_failure(),
            "User should not be able to vote twice on same proposal: {:?}",
            result.failures()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Voting")]
#[allure_severity("normal")]
#[allure_tags("integration", "voting", "validation")]
#[allure_description(r#"
## Purpose
Verifies that voting on a nonexistent proposal ID fails gracefully.

## Input Validation
Proposal ID 999999 should not exist and vote should fail.
"#)]

#[allure_test]
#[tokio::test]
async fn test_vote_on_nonexistent_proposal_fails() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Verify and add user as citizen
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    // Try to vote on a proposal that doesn't exist (very high ID)
    let result =
        vote_on_proposal(user, &env.sputnik_dao, 999999, "VoteApprove", json!("Vote")).await?;

    step("Verify voting on nonexistent proposal fails", || {
        assert!(
            result.is_failure(),
            "Voting on nonexistent proposal should fail: {:?}",
            result.failures()
        );
    });

    Ok(())
}

// ==================== TIME-BASED TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Lifecycle")]
#[allure_severity("normal")]
#[allure_tags("integration", "voting", "expiry")]
#[allure_description(r#"
## Purpose
Verifies that proposals expire after the voting period ends.

## Time-Based Test
Uses fast_forward(100 blocks) to simulate passage of time.
Vote triggers status update → Expired.
"#)]

#[allure_test]
#[tokio::test]
async fn test_proposal_expires_after_period() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Add user as citizen first
    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Will expire")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    // Proposal should be InProgress initially
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal is InProgress initially", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::InProgress,
            "Proposal should be InProgress initially"
        );
    });

    // Advance time way past proposal period (100 blocks for 10s period)
    env.worker.fast_forward(100).await?;

    // Try to vote after expiration - this should fail or mark as expired
    let vote_result = vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    // The proposal should now be expired (vote triggers status update)
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal is expired after time period", || {
        // Note: In sputnik-dao, voting on an expired proposal marks it as Expired
        assert_eq!(
            proposal.status,
            ProposalStatus::Expired,
            "Proposal should be expired after period. Vote result: {:?}",
            vote_result.is_success()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Lifecycle")]
#[allure_severity("normal")]
#[allure_tags("integration", "voting", "expiry")]
#[allure_description(r#"
## Purpose
Verifies that voting within the valid period succeeds (baseline for expiry test).

## Expected
Immediate vote after proposal creation should succeed.
"#)]

#[allure_test]
#[tokio::test]
async fn test_vote_before_expiry_succeeds() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    add_member_via_bridge(&env.backend, &env.bridge, user)
        .await?
        .into_result()?;

    create_proposal_via_bridge(&env.backend, &env.bridge, "Vote quickly")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await?.checked_sub(1).expect("expected at least one proposal");

    // Vote immediately (within period)
    let result = vote_on_proposal(
        user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?;

    step("Verify vote before expiry succeeds", || {
        assert!(result.is_success(), "Vote before expiry should succeed");
    });

    Ok(())
}
