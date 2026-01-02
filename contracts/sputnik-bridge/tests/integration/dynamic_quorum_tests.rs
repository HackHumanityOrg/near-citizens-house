//! Dynamic quorum tests for sputnik-bridge contract
//!
//! These tests verify the dynamic quorum update mechanism:
//! - After each member addition, quorum is updated to ceil(7% * citizen_count)
//! - Threshold remains at 50% (Ratio 1/2) of citizens
//! - effective_threshold = max(quorum, threshold_weight)

use super::helpers::*;
use allure_rs::prelude::*;
use serde_json::json;

// ==================== DYNAMIC QUORUM TESTS ====================

/// Test 1: Add multiple citizens and verify quorum + threshold are calculated correctly
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "threshold")]
#[allure_description("Verifies that dynamic quorum is calculated correctly as ceil(7% * citizen_count) when adding multiple citizens.")]
#[allure_test]
#[tokio::test]
async fn test_dynamic_quorum_and_threshold_calculation() -> anyhow::Result<()> {
    // Use the policy with dynamic quorum support
    let env = setup_with_policy_and_users(15, create_policy_with_dynamic_quorum, true).await?;

    // Initial state: no citizens, quorum should be 0
    let initial_quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let initial_threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    println!(
        "Initial: quorum={}, threshold={:?}",
        initial_quorum, initial_threshold
    );

    step("Verify initial quorum and threshold", || {
        assert_eq!(initial_quorum, 0, "Initial quorum should be 0");
        assert_eq!(initial_threshold, (1, 2), "Threshold should be 50% (1/2)");
    });

    // Add citizens and verify quorum updates
    // Expected quorum = ceil(citizen_count * 7 / 100)
    let expected_quorums = [
        (1, 1),  // ceil(1 * 0.07) = 1
        (5, 1),  // ceil(5 * 0.07) = 1
        (10, 1), // ceil(10 * 0.07) = 1
        (15, 2), // ceil(15 * 0.07) = 2
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

        // Verify quorum was updated
        let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
        let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
        println!(
            "After {} citizens: quorum={}, threshold={:?}",
            target_count, quorum, threshold
        );

        let tc = target_count;
        let eq = expected_quorum;
        step(&format!("Verify quorum at {} citizens", tc), || {
            assert_eq!(citizen_count, tc, "Should have {} citizens", tc);
            assert_eq!(quorum, eq, "With {} citizens, quorum should be {}", tc, eq);
            assert_eq!(threshold, (1, 2), "Threshold should remain 50% (1/2)");
        });
    }

    Ok(())
}

/// Test 2: Quorum fails - not enough votes to reach effective threshold
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "voting")]
#[allure_description("Verifies that a proposal remains InProgress when not enough votes are cast to reach the effective threshold.")]
#[allure_test]
#[tokio::test]
async fn test_vote_proposal_quorum_fails() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // Verify setup
    let citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    println!(
        "Setup: {} citizens, quorum={}, threshold={:?}",
        citizen_count, quorum, threshold
    );

    // Calculate effective threshold: max(quorum, ceil(10 * 1 / 2)) = max(1, 6) = 6
    let effective_threshold =
        calculate_effective_threshold(quorum, threshold, citizen_count as u64);
    println!("Effective threshold: {}", effective_threshold);

    step(
        "Verify setup with 10 citizens and effective threshold",
        || {
            assert_eq!(citizen_count, 10, "Should have 10 citizens");
            assert_eq!(
                effective_threshold, 6,
                "Effective threshold should be 6 (50% of 10 + 1)"
            );
        },
    );

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test quorum failure")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao)
        .await?
        .checked_sub(1)
        .expect("expected at least one proposal");

    // Only 2 citizens vote YES (less than effective_threshold of 6)
    for i in 0..2 {
        vote_on_proposal(
            env.user(i),
            &env.sputnik_dao,
            proposal_id,
            "VoteApprove",
            json!("Vote"),
        )
        .await?
        .into_result()?;
    }

    // Proposal should still be InProgress (not enough votes)
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal InProgress with insufficient votes", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::InProgress,
            "Proposal should be InProgress with only 2/10 YES votes (need {} for threshold)",
            effective_threshold
        );
    });

    Ok(())
}

/// Test 3: Quorum passes but threshold fails - enough participation but not enough YES
/// In SputnikDAO, this means: total participation >= quorum, but YES votes < effective_threshold
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "threshold")]
#[allure_description("Verifies that a proposal remains InProgress when participation meets quorum but YES votes don't reach the threshold.")]
#[allure_test]
#[tokio::test]
async fn test_vote_proposal_quorum_passes_threshold_fails() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(20, create_policy_with_dynamic_quorum, true).await?;

    // Add 20 citizens
    for i in 0..20 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // Verify setup
    let citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;
    assert_eq!(citizen_count, 20, "Should have 20 citizens");

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    println!(
        "Setup: {} citizens, quorum={}, threshold={:?}",
        citizen_count, quorum, threshold
    );

    // quorum = ceil(20 * 7 / 100) = 2
    // threshold_weight = ceil(20 * 1 / 2) = 11 (actually (20/2)+1 = 11 per SputnikDAO)
    // effective_threshold = max(2, 11) = 11
    let effective_threshold =
        calculate_effective_threshold(quorum, threshold, citizen_count as u64);
    println!("Effective threshold: {}", effective_threshold);

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test threshold failure")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao)
        .await?
        .checked_sub(1)
        .expect("expected at least one proposal");

    // 5 citizens vote YES, 5 vote NO
    // Total participation: 10 (50%) > quorum (2) - quorum passes
    // YES votes: 5 < effective_threshold (11) - threshold fails
    // NO votes: 5 < effective_threshold (11) - rejection threshold also not met
    for i in 0..5 {
        vote_on_proposal(
            env.user(i),
            &env.sputnik_dao,
            proposal_id,
            "VoteApprove",
            json!("Vote"),
        )
        .await?
        .into_result()?;
    }
    for i in 5..10 {
        vote_on_proposal(
            env.user(i),
            &env.sputnik_dao,
            proposal_id,
            "VoteReject",
            json!("Vote"),
        )
        .await?
        .into_result()?;
    }

    // Proposal should be InProgress (neither YES nor NO reached threshold)
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step(
        "Verify proposal InProgress when neither threshold met",
        || {
            assert_eq!(
                proposal.status,
                ProposalStatus::InProgress,
                "Proposal should be InProgress: 5 YES and 5 NO, but need {} for threshold",
                effective_threshold
            );
        },
    );

    Ok(())
}

/// Test 4: Quorum fails but threshold passes
/// NOTE: In SputnikDAO's model, this scenario is impossible because
/// effective_threshold = max(quorum, threshold_weight). If threshold_weight
/// votes are cast, the quorum floor is necessarily met.
/// This test documents this behavior.
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("normal")]
#[allure_tags("integration", "quorum", "edge-case")]
#[allure_description("Documents that quorum failing while threshold passes is impossible due to effective_threshold = max(quorum, threshold_weight).")]
#[allure_test]
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
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 10);
    println!(
        "With 10 citizens: quorum={}, threshold={:?}, effective={}",
        quorum, threshold, effective_threshold
    );

    step(
        "Verify effective_threshold always >= quorum (invariant)",
        || {
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
        },
    );

    Ok(())
}

/// Test 5: Both quorum and threshold pass - proposal approved
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "voting")]
#[allure_description("Verifies that a proposal is approved when YES votes reach the effective threshold (max of quorum and 50%).")]
#[allure_test]
#[tokio::test]
async fn test_vote_proposal_quorum_and_threshold_pass() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 10);
    println!(
        "Effective threshold: {} (quorum={}, threshold={:?})",
        effective_threshold, quorum, threshold
    );

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test both pass")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao)
        .await?
        .checked_sub(1)
        .expect("expected at least one proposal");

    // Have exactly effective_threshold citizens vote YES
    // effective_threshold = 6 for 10 citizens
    let votes_needed = effective_threshold as usize;
    println!("Casting {} YES votes", votes_needed);

    for i in 0..votes_needed {
        let result = vote_on_proposal(
            env.user(i),
            &env.sputnik_dao,
            proposal_id,
            "VoteApprove",
            json!("Vote"),
        )
        .await?;

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

    step("Verify proposal approved at threshold", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Approved,
            "Proposal should be Approved after {} YES votes",
            votes_needed
        );
    });

    Ok(())
}

/// Test 6: Proposal rejected when NO votes reach threshold
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("normal")]
#[allure_tags("integration", "quorum", "voting")]
#[allure_description(
    "Verifies that a proposal is rejected when NO votes reach the effective threshold."
)]
#[allure_test]
#[tokio::test]
async fn test_vote_proposal_rejected_at_threshold() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(10, create_policy_with_dynamic_quorum, true).await?;

    // Add 10 citizens
    for i in 0..10 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 10);

    // Create a Vote proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test rejection")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao)
        .await?
        .checked_sub(1)
        .expect("expected at least one proposal");

    // Have effective_threshold citizens vote NO
    let votes_needed = effective_threshold as usize;
    println!(
        "Casting {} NO votes (effective_threshold={})",
        votes_needed, effective_threshold
    );

    for i in 0..votes_needed {
        vote_on_proposal(
            env.user(i),
            &env.sputnik_dao,
            proposal_id,
            "VoteReject",
            json!("Vote"),
        )
        .await?
        .into_result()?;
    }

    // Proposal should be Rejected
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify proposal rejected at threshold", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Rejected,
            "Proposal should be Rejected after {} NO votes",
            votes_needed
        );
    });

    Ok(())
}

// ==================== QUORUM EDGE CASE TESTS ====================

/// Test 7: 0→1 citizen transition - first citizen addition
/// This is a critical edge case where the DAO goes from having no citizens to one.
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "edge-case")]
#[allure_description("Verifies the critical 0-to-1 citizen transition, where quorum updates from 0 to 1 and the first citizen can approve proposals.")]
#[allure_test]
#[tokio::test]
async fn test_zero_to_one_citizen_quorum_transition() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(1, create_policy_with_dynamic_quorum, true).await?;

    // Initial state: no citizens
    let initial_citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;
    let initial_quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;

    step("Verify initial state with 0 citizens", || {
        assert_eq!(initial_citizen_count, 0, "Should start with 0 citizens");
        assert_eq!(
            initial_quorum, 0,
            "Initial quorum should be 0 with no citizens"
        );
    });

    // Add the first citizen
    let first_user = env.user(0);
    verify_user(&env.backend, &env.verified_accounts, first_user, 0).await?;
    let result = add_member_via_bridge(&env.backend, &env.bridge, first_user).await?;
    assert!(
        result.is_success(),
        "Adding first citizen should succeed. Failures: {:?}",
        result.failures()
    );

    // After first citizen: quorum should be ceil(1 * 7 / 100) = 1
    let new_citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;
    let new_quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;

    // Verify the first citizen is actually in the role
    let is_citizen =
        is_account_in_role(&env.sputnik_dao, first_user.id().as_str(), "citizen").await?;

    step("Verify first citizen added and quorum updated to 1", || {
        assert_eq!(new_citizen_count, 1, "Should have 1 citizen after addition");
        assert_eq!(
            new_quorum, 1,
            "Quorum should be 1 after first citizen (ceil(1 * 0.07) = 1)"
        );
        assert!(is_citizen, "First user should be in citizen role");
    });

    // Create a vote proposal and verify single citizen can approve it
    create_proposal_via_bridge(&env.backend, &env.bridge, "First citizen vote test")
        .await?
        .into_result()?;
    let proposal_id = get_last_proposal_id(&env.sputnik_dao)
        .await?
        .checked_sub(1)
        .expect("expected at least one proposal");

    // With 1 citizen, effective_threshold = max(1, (1*1/2)+1) = max(1, 1) = 1
    // Single vote should approve
    vote_on_proposal(
        first_user,
        &env.sputnik_dao,
        proposal_id,
        "VoteApprove",
        json!("Vote"),
    )
    .await?
    .into_result()?;

    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;

    step("Verify single citizen can approve proposal", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::Approved,
            "Single citizen vote should approve proposal when there's only 1 citizen"
        );
    });

    Ok(())
}

/// Test 8: Quorum boundary test at 14→15 citizens
/// At 14 citizens: quorum = ceil(14 * 0.07) = ceil(0.98) = 1
/// At 15 citizens: quorum = ceil(15 * 0.07) = ceil(1.05) = 2
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "boundary")]
#[allure_description("Verifies the quorum boundary transition from 14 to 15 citizens where quorum increases from 1 to 2.")]
#[allure_test]
#[tokio::test]
async fn test_quorum_boundary_14_to_15_citizens() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(15, create_policy_with_dynamic_quorum, true).await?;

    // Add 14 citizens
    for i in 0..14 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // With 14 citizens, quorum should be 1
    let quorum_at_14 = get_vote_quorum(&env.sputnik_dao, "citizen").await?;

    step("Verify quorum is 1 at 14 citizens", || {
        assert_eq!(
            quorum_at_14, 1,
            "At 14 citizens, quorum should be 1 (ceil(14 * 0.07) = ceil(0.98) = 1)"
        );
    });

    // Add the 15th citizen
    let fifteenth_user = env.user(14);
    verify_user(&env.backend, &env.verified_accounts, fifteenth_user, 14).await?;
    add_member_via_bridge(&env.backend, &env.bridge, fifteenth_user)
        .await?
        .into_result()?;

    // With 15 citizens, quorum should be 2
    let quorum_at_15 = get_vote_quorum(&env.sputnik_dao, "citizen").await?;

    step("Verify quorum boundary transition at 15 citizens", || {
        assert_eq!(
            quorum_at_15, 2,
            "At 15 citizens, quorum should be 2 (ceil(15 * 0.07) = ceil(1.05) = 2)"
        );

        // Verify the boundary transition
        assert!(
            quorum_at_15 > quorum_at_14,
            "Quorum should increase from {} to {} when going from 14 to 15 citizens",
            quorum_at_14,
            quorum_at_15
        );
    });

    Ok(())
}

/// Test 9: Large citizen count - test quorum calculation doesn't overflow
/// Uses saturating arithmetic: citizen_count.saturating_mul(7) / 100
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "overflow")]
#[allure_description("Verifies that quorum calculation handles large citizen counts (100+) correctly without overflow using saturating arithmetic.")]
#[allure_test]
#[tokio::test]
async fn test_quorum_calculation_with_many_citizens() -> anyhow::Result<()> {
    // This test verifies the quorum calculation handles larger numbers correctly
    // We can't actually add u64::MAX citizens, but we can verify the calculation
    // is correct for a reasonably large number (100 citizens)
    let env = setup_with_policy_and_users(100, create_policy_with_dynamic_quorum, true).await?;

    // Fund the backend with additional NEAR since each add_member needs ~2 NEAR
    // (1 NEAR for AddMemberToRole + 1 NEAR for quorum update proposal)
    // 100 members * 2 NEAR = 200 NEAR, but backend starts with ~200 NEAR,
    // so we need additional funds
    fund_account(&env, &env.backend, 300).await?;

    // Add 100 citizens
    for i in 0..100 {
        let user = env.user(i);
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
        assert!(
            result.is_success(),
            "Adding citizen {} should succeed. Failures: {:?}",
            i,
            result.failures()
        );
    }

    let citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;

    // With 100 citizens, quorum = ceil(100 * 0.07) = 7
    let quorum = get_vote_quorum(&env.sputnik_dao, "citizen").await?;

    // Threshold = (100 * 1 / 2) + 1 = 51
    // effective_threshold = max(7, 51) = 51
    let threshold = get_vote_threshold(&env.sputnik_dao, "citizen").await?;
    let effective_threshold = calculate_effective_threshold(quorum, threshold, 100);

    step("Verify quorum calculation at 100 citizens", || {
        assert_eq!(citizen_count, 100, "Should have 100 citizens");
        assert_eq!(
            quorum, 7,
            "At 100 citizens, quorum should be 7 (ceil(100 * 0.07) = 7)"
        );
        assert_eq!(
            effective_threshold, 51,
            "Effective threshold should be 51 for 100 citizens"
        );
    });

    Ok(())
}

/// Test 10: Verify quorum updates are atomic with member addition
/// The member should be added AND quorum updated in the same transaction chain
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Dynamic Quorum")]
#[allure_severity("critical")]
#[allure_tags("integration", "quorum", "atomicity")]
#[allure_description("Verifies that quorum updates are atomic with member addition, with both member_added and quorum_updated events emitted.")]
#[allure_test]
#[tokio::test]
async fn test_quorum_update_atomic_with_member_addition() -> anyhow::Result<()> {
    let env = setup_with_policy_and_users(2, create_policy_with_dynamic_quorum, true).await?;

    // Verify first user and add them
    let first_user = env.user(0);
    verify_user(&env.backend, &env.verified_accounts, first_user, 0).await?;

    // Before adding first member
    let quorum_before = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let citizen_count_before = get_citizen_count(&env.sputnik_dao, "citizen").await?;

    // Add first member - this should atomically add member and update quorum
    let result = add_member_via_bridge(&env.backend, &env.bridge, first_user).await?;
    assert!(result.is_success(), "Adding member should succeed");

    // After adding - both should be updated
    let quorum_after = get_vote_quorum(&env.sputnik_dao, "citizen").await?;
    let citizen_count_after = get_citizen_count(&env.sputnik_dao, "citizen").await?;

    step("Verify citizen count and quorum updated atomically", || {
        // Verify both changed together
        assert_eq!(
            citizen_count_after,
            citizen_count_before + 1,
            "Citizen count should increase by 1"
        );
        assert!(
            quorum_after >= quorum_before,
            "Quorum should increase or stay same (was {}, now {})",
            quorum_before,
            quorum_after
        );
    });

    // Check events show both operations occurred
    let logs = extract_event_logs(&result);
    let events = parse_events(&logs);

    let member_added = events.iter().any(|e| e.event == "member_added");
    let quorum_updated = events.iter().any(|e| e.event == "quorum_updated");

    step("Verify both events emitted atomically", || {
        assert!(member_added, "member_added event should be emitted");
        assert!(quorum_updated, "quorum_updated event should be emitted");
    });

    // Parse and validate the quorum_updated event data
    let quorum_event: QuorumUpdatedEvent =
        parse_typed_event(&events, "quorum_updated").expect("quorum_updated event data not found");

    // Expected quorum = ceil(citizen_count * 7 / 100)
    let expected_quorum = if citizen_count_after == 0 {
        0
    } else {
        ((citizen_count_after as u64) * 7).div_ceil(100)
    };

    step("Verify quorum_updated event data matches state", || {
        // Validate event data matches expected values
        assert_eq!(
            quorum_event.citizen_count, citizen_count_after as u64,
            "Event citizen_count should match actual count"
        );

        assert_eq!(
            quorum_event.new_quorum, expected_quorum,
            "Event new_quorum should match calculated ceil(7% * citizen_count)"
        );

        // Proposal ID should be valid (non-zero since it's for the policy update proposal)
        assert!(
            quorum_event.proposal_id > 0,
            "Event proposal_id should be a valid proposal ID"
        );

        // Verify the quorum in the DAO matches the event
        assert_eq!(
            quorum_after, expected_quorum,
            "DAO quorum should match event's new_quorum"
        );
    });

    Ok(())
}
