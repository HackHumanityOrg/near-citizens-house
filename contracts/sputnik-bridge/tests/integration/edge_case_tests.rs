//! Edge case and deposit/bond tests for sputnik-bridge contract

use super::helpers::*;
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== DEPOSIT/BOND TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("normal")]
#[allure_tags("integration", "edge-case", "deposit")]
#[allure_description("Verifies that adding a member with insufficient deposit (below DAO proposal bond) fails with appropriate error.")]
#[allure_test]
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
    assert!(
        result.is_failure(),
        "Add member with insufficient deposit should fail"
    );

    // Verify error message mentions insufficient deposit/bond
    // Note: SputnikDAO may return different error messages in different versions,
    // so we accept multiple possible messages for external contract errors
    assert!(
        contains_any_error(
            &result,
            &["Not enough deposit", "ERR_MIN_BOND"],
            "insufficient deposit"
        ),
        "Error should mention insufficient deposit. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("normal")]
#[allure_tags("integration", "edge-case", "deposit")]
#[allure_description("Verifies that adding a member with zero deposit fails as expected.")]
#[allure_test]
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
    assert!(
        result.is_failure(),
        "Add member with zero deposit should fail"
    );

    Ok(())
}

// ==================== CONCURRENT OPERATIONS TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("critical")]
#[allure_tags("integration", "edge-case", "concurrency")]
#[allure_description("Verifies that multiple members can be added in rapid succession without state corruption or race conditions.")]
#[allure_test]
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
        let is_citizen =
            is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Edge Cases")]
#[allure_severity("critical")]
#[allure_tags("integration", "edge-case", "voting")]
#[allure_description("Verifies that sequential voting correctly auto-approves when threshold is reached and rejects late votes on approved proposals.")]
#[allure_test]
#[tokio::test]
async fn test_sequential_voting_reaches_threshold() -> anyhow::Result<()> {
    // This test verifies sequential voting behavior when threshold is reached mid-voting.
    // With 5 citizens and 50% threshold, 3 approve votes (60%) triggers auto-approval.
    // Subsequent votes on an approved proposal should fail gracefully.
    let env = setup_with_users(5).await?;

    // Setup: Verify and add all users as citizens
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Sequential voting test")
        .await?
        .into_result()?;
    let last_id = get_last_proposal_id(&env.sputnik_dao).await?;
    let proposal_id = last_id
        .checked_sub(1)
        .expect("expected last proposal id > 0");

    // Vote sequentially - first 3 approve, then check status before remaining votes
    // With 5 citizens and >50% threshold: need >2.5 votes, so 3 votes (60%) is sufficient
    for i in 0..3 {
        let user = env.user(i);
        let result =
            vote_on_proposal(user, &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
                .await?;
        assert!(
            result.is_success(),
            "Vote {} should succeed. Failures: {:?}",
            i,
            result.failures()
        );
    }

    // After 3 approve votes, proposal should be approved
    let proposal_after_approvals = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal_after_approvals.status,
        ProposalStatus::Approved,
        "Proposal should be approved after 3/5 (60%) approval votes"
    );

    // Verify that voting on an already-approved proposal fails
    let late_vote_result = vote_on_proposal(
        env.user(3),
        &env.sputnik_dao,
        proposal_id,
        "VoteReject",
        json!("Vote"),
    )
    .await?;

    // Late votes on approved proposals should fail
    assert!(
        late_vote_result.is_failure(),
        "Voting on an already-approved proposal should fail"
    );

    // Final verification - proposal is still approved
    let final_proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        final_proposal.status,
        ProposalStatus::Approved,
        "Proposal should remain approved"
    );

    Ok(())
}
