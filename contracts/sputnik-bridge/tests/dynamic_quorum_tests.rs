//! Dynamic quorum tests for sputnik-bridge contract
//!
//! These tests verify the dynamic quorum update mechanism:
//! - After each member addition, quorum is updated to ceil(7% * citizen_count)
//! - Threshold remains at 50% (Ratio 1/2) of citizens
//! - effective_threshold = max(quorum, threshold_weight)
//!
//! Run with: cargo test --features integration-tests

#![cfg(feature = "integration-tests")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use serde_json::json;

// ==================== DYNAMIC QUORUM TESTS ====================

/// Test 1: Add multiple citizens and verify quorum + threshold are calculated correctly
#[tokio::test]
async fn test_dynamic_quorum_and_threshold_calculation() -> anyhow::Result<()> {
    // Use the policy with dynamic quorum support
    let env = setup_with_policy_and_users(15, create_policy_with_dynamic_quorum, true).await?;

    // Initial state: no citizens, quorum should be 0
    let initial_quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let initial_threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    println!("Initial: quorum={}, threshold={:?}", initial_quorum, initial_threshold);
    assert_eq!(initial_quorum, 0, "Initial quorum should be 0");
    assert_eq!(initial_threshold, (1, 2), "Threshold should be 50% (1/2)");

    // Add citizens and verify quorum updates
    // Expected quorum = ceil(citizen_count * 7 / 100)
    let expected_quorums = [
        (1, 1),   // ceil(1 * 0.07) = 1
        (5, 1),   // ceil(5 * 0.07) = 1
        (10, 1),  // ceil(10 * 0.07) = 1
        (15, 2),  // ceil(15 * 0.07) = 2
    ];

    let mut added_count = 0usize;
    for (target_count, expected_quorum) in expected_quorums {
        // Add citizens up to target_count
        while added_count < target_count {
            let user = env.user(added_count);
            verify_user(&env.backend, &env.verified_accounts, user, added_count).await?;
            let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
            assert!(
                result.is_success(),
                "Adding user {} should succeed. Failures: {:?}",
                added_count,
                result.failures()
            );
            added_count += 1;
        }

        // Verify citizen count
        let citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;
        assert_eq!(citizen_count, target_count, "Should have {} citizens", target_count);

        // Verify quorum was updated
        let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
        let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
        println!(
            "After {} citizens: quorum={}, threshold={:?}",
            target_count, quorum, threshold
        );
        assert_eq!(
            quorum, expected_quorum,
            "With {} citizens, quorum should be {}",
            target_count, expected_quorum
        );
        assert_eq!(threshold, (1, 2), "Threshold should remain 50% (1/2)");
    }

    Ok(())
}

/// Test 2: Quorum fails - not enough votes to reach effective threshold
#[tokio::test]
async fn test_vote_proposal_quorum_fails() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    // Verify setup
    let citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;
    assert_eq!(citizen_count, 10, "Should have 10 citizens");

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    println!("Setup: {} citizens, quorum={}, threshold={:?}", citizen_count, quorum, threshold);

    // Calculate effective threshold: max(quorum, ceil(10 * 1 / 2)) = max(1, 6) = 6
    let effective_threshold = calculate_effective_threshold(quorum, threshold, citizen_count as u64);
    println!("Effective threshold: {}", effective_threshold);
    assert_eq!(effective_threshold, 6, "Effective threshold should be 6 (50% of 10 + 1)");

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test quorum failure").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Only 2 citizens vote YES (less than effective_threshold of 6)
    for i in 0..2 {
        vote_on_proposal(env.user(i), &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
            .await?
            .into_result()?;
    }

    // Proposal should still be InProgress (not enough votes)
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::InProgress,
        "Proposal should be InProgress with only 2/10 YES votes (need {} for threshold)",
        effective_threshold
    );

    Ok(())
}

/// Test 3: Quorum passes but threshold fails - enough participation but not enough YES
/// In SputnikDAO, this means: total participation >= quorum, but YES votes < effective_threshold
#[tokio::test]
async fn test_vote_proposal_quorum_passes_threshold_fails() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(20, create_policy_with_dynamic_quorum, true).await?;

    // Add 20 citizens
    for i in 0..20 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    // Verify setup
    let citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;
    assert_eq!(citizen_count, 20, "Should have 20 citizens");

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    println!("Setup: {} citizens, quorum={}, threshold={:?}", citizen_count, quorum, threshold);

    // quorum = ceil(20 * 7 / 100) = 2
    // threshold_weight = ceil(20 * 1 / 2) = 11 (actually (20/2)+1 = 11 per SputnikDAO)
    // effective_threshold = max(2, 11) = 11
    let effective_threshold = calculate_effective_threshold(quorum, threshold, citizen_count as u64);
    println!("Effective threshold: {}", effective_threshold);

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test threshold failure").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // 5 citizens vote YES, 5 vote NO
    // Total participation: 10 (50%) > quorum (2) - quorum passes
    // YES votes: 5 < effective_threshold (11) - threshold fails
    // NO votes: 5 < effective_threshold (11) - rejection threshold also not met
    for i in 0..5 {
        vote_on_proposal(env.user(i), &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote"))
            .await?
            .into_result()?;
    }
    for i in 5..10 {
        vote_on_proposal(env.user(i), &env.sputnik_dao, proposal_id, "VoteReject", json!("Vote"))
            .await?
            .into_result()?;
    }

    // Proposal should be InProgress (neither YES nor NO reached threshold)
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::InProgress,
        "Proposal should be InProgress: 5 YES and 5 NO, but need {} for threshold",
        effective_threshold
    );

    Ok(())
}

/// Test 4: Quorum fails but threshold passes
/// NOTE: In SputnikDAO's model, this scenario is impossible because
/// effective_threshold = max(quorum, threshold_weight). If threshold_weight
/// votes are cast, the quorum floor is necessarily met.
/// This test documents this behavior.
#[tokio::test]
async fn test_vote_proposal_quorum_fails_threshold_passes_impossible() -> anyhow::Result<()> {
    // This test demonstrates that quorum failing while threshold passes is impossible.
    // If YES votes >= threshold_weight, then effective_threshold is met.
    // The quorum is just a floor - if threshold_weight > quorum, meeting threshold
    // automatically satisfies the quorum requirement.

    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 10);
    println!("With 10 citizens: quorum={}, threshold={:?}, effective={}", quorum, threshold, effective_threshold);

    // quorum = ceil(10 * 7 / 100) = 1
    // threshold_weight = (10 * 1 / 2) + 1 = 6
    // effective_threshold = max(1, 6) = 6
    assert!(
        effective_threshold >= quorum,
        "Effective threshold ({}) should always >= quorum ({})",
        effective_threshold,
        quorum
    );

    // If we have 6 YES votes to meet threshold, we also have >= 1 vote (quorum)
    // Therefore, quorum_fails && threshold_passes is logically impossible
    // The test passes by documenting this invariant

    Ok(())
}

/// Test 5: Both quorum and threshold pass - proposal approved
#[tokio::test]
async fn test_vote_proposal_quorum_and_threshold_pass() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 10);
    println!("Effective threshold: {} (quorum={}, threshold={:?})", effective_threshold, quorum, threshold);

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test both pass").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Have exactly effective_threshold citizens vote YES
    // effective_threshold = 6 for 10 citizens
    let votes_needed = effective_threshold as usize;
    println!("Casting {} YES votes", votes_needed);

    for i in 0..votes_needed {
        let result = vote_on_proposal(env.user(i), &env.sputnik_dao, proposal_id, "VoteApprove", json!("Vote")).await?;

        if i < votes_needed - 1 {
            // Before reaching threshold, proposal should be InProgress
            let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
            assert_eq!(
                proposal.status,
                ProposalStatus::InProgress,
                "After {} votes, proposal should still be InProgress (need {})",
                i + 1,
                votes_needed
            );
        }

        assert!(result.is_success(), "Vote {} should succeed", i);
    }

    // After reaching threshold, proposal should be Approved
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::Approved,
        "Proposal should be Approved after {} YES votes",
        votes_needed
    );

    Ok(())
}

/// Test 6: Proposal rejected when NO votes reach threshold
#[tokio::test]
async fn test_vote_proposal_rejected_at_threshold() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user).await?.into_result()?;
    }

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 10);

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test rejection").await?.into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;

    // Have effective_threshold citizens vote NO
    let votes_needed = effective_threshold as usize;
    println!("Casting {} NO votes (effective_threshold={})", votes_needed, effective_threshold);

    for i in 0..votes_needed {
        vote_on_proposal(env.user(i), &env.sputnik_dao, proposal_id, "VoteReject", json!("Vote"))
            .await?
            .into_result()?;
    }

    // Proposal should be Rejected
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert_eq!(
        proposal.status,
        ProposalStatus::Rejected,
        "Proposal should be Rejected after {} NO votes",
        votes_needed
    );

    Ok(())
}
