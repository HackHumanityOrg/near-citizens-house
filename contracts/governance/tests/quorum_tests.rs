//! Quorum calculation tests for governance contract
//!
//! This module tests the quorum calculation logic with both deterministic
//! edge cases and property-based fuzzing using proptest.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use proptest::prelude::*;

// ==================== DETERMINISTIC QUORUM EDGE CASES ====================

#[tokio::test]
async fn test_quorum_1_percent_of_1_citizen() -> anyhow::Result<()> {
    // 1% of 1 = 0 (floor division), so 1 vote should pass quorum
    let (env, proposal_id) = setup_with_proposal(1, 1).await?;

    // Vote yes
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    // Advance past voting period
    advance_past_voting_period(&env.worker).await?;

    // Finalize
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    // Check result - should pass (1 yes vote, quorum 0, yes > no)
    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_1_percent_of_100_citizens() -> anyhow::Result<()> {
    // 1% of 100 = 1 vote needed
    let env = setup_with_verified_users(100).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 1).await?;

    // Only 1 yes vote should satisfy quorum
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_50_percent_of_10_citizens() -> anyhow::Result<()> {
    // 50% of 10 = 5 votes needed
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 50).await?;

    // 5 yes votes should satisfy quorum
    for i in 0..5 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_50_percent_of_10_not_met() -> anyhow::Result<()> {
    // 50% of 10 = 5 votes needed, only 4 provided
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 50).await?;

    // Only 4 yes votes - should NOT satisfy quorum
    for i in 0..4 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::QuorumNotMet);

    Ok(())
}

#[tokio::test]
async fn test_quorum_100_percent_of_10_citizens() -> anyhow::Result<()> {
    // 100% of 10 = 10 votes needed (unanimous)
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 100).await?;

    // All 10 must vote (yes/no, abstain doesn't count)
    for i in 0..10 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_100_percent_not_met() -> anyhow::Result<()> {
    // 100% of 10 = 10 votes needed, only 9 provided
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 100).await?;

    // Only 9 yes votes - should NOT satisfy quorum
    for i in 0..9 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::QuorumNotMet);

    Ok(())
}

#[tokio::test]
async fn test_quorum_33_percent_of_3_floor_division() -> anyhow::Result<()> {
    // 33% of 3 = 0.99 → 0 (floor division)
    // So 0 votes needed for quorum, but we need at least 1 yes to pass
    let env = setup_with_verified_users(3).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 33).await?;

    // 1 yes vote should pass (quorum is 0, yes > no)
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_34_percent_of_3_floor_division() -> anyhow::Result<()> {
    // 34% of 3 = 1.02 → 1 (floor division)
    // So 1 vote needed for quorum
    let env = setup_with_verified_users(3).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 34).await?;

    // 1 yes vote should satisfy quorum and pass
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_51_percent_of_99_floor_division() -> anyhow::Result<()> {
    // 51% of 99 = 50.49 → 50 (floor division)
    let env = setup_with_verified_users(99).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 51).await?;

    // Exactly 50 yes votes should satisfy quorum
    for i in 0..50 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

#[tokio::test]
async fn test_quorum_51_percent_of_99_not_met() -> anyhow::Result<()> {
    // 51% of 99 = 50.49 → 50 (floor division)
    // 49 votes should NOT satisfy
    let env = setup_with_verified_users(99).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 51).await?;

    // Only 49 yes votes - should NOT satisfy quorum
    for i in 0..49 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::QuorumNotMet);

    Ok(())
}

// ==================== ABSTAIN VOTE TESTS ====================

#[tokio::test]
async fn test_abstain_votes_dont_count_toward_quorum() -> anyhow::Result<()> {
    // 50% of 10 = 5 votes needed
    // 10 abstain votes should NOT satisfy quorum
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 50).await?;

    // All abstain votes
    for i in 0..10 {
        vote_helper(
            &env.verified_users[i],
            &env.governance,
            proposal_id,
            "Abstain",
        )
        .await?
        .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::QuorumNotMet);

    Ok(())
}

#[tokio::test]
async fn test_mixed_votes_abstain_not_counted() -> anyhow::Result<()> {
    // 50% of 10 = 5 votes needed
    // 3 yes + 2 no + 5 abstain = only 5 quorum votes (yes + no)
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 50).await?;

    // 3 yes votes
    for i in 0..3 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }
    // 2 no votes
    for i in 3..5 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "No")
            .await?
            .into_result()?;
    }
    // 5 abstain votes
    for i in 5..10 {
        vote_helper(
            &env.verified_users[i],
            &env.governance,
            proposal_id,
            "Abstain",
        )
        .await?
        .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    // Quorum met (5 votes), yes (3) > no (2), so Passed
    assert_eq!(proposal.status, ProposalStatus::Passed);

    Ok(())
}

// ==================== TIE TESTS ====================

#[tokio::test]
async fn test_tie_results_in_failed() -> anyhow::Result<()> {
    // 40% of 10 = 4 votes needed
    // 2 yes + 2 no = tie → Failed
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 40).await?;

    // 2 yes votes
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;
    // 2 no votes
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "No")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[3], &env.governance, proposal_id, "No")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Failed);

    Ok(())
}

#[tokio::test]
async fn test_no_votes_win_results_in_failed() -> anyhow::Result<()> {
    // 30% of 10 = 3 votes needed
    // 1 yes + 3 no = Failed (no >= yes, quorum met)
    let env = setup_with_verified_users(10).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 30).await?;

    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "No")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "No")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[3], &env.governance, proposal_id, "No")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Failed);

    Ok(())
}

// ==================== QUORUM VALIDATION TESTS ====================

#[tokio::test]
async fn test_quorum_0_percent_rejected() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Test",
        "Description",
        None,
        0, // Invalid: 0%
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Quorum percentage must be between 1 and 100");

    Ok(())
}

#[tokio::test]
async fn test_quorum_101_percent_rejected() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Test",
        "Description",
        None,
        101, // Invalid: 101%
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Quorum percentage must be between 1 and 100");

    Ok(())
}

#[tokio::test]
async fn test_quorum_1_percent_accepted() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Test",
        "Description",
        None,
        1, // Valid minimum
    )
    .await?;

    assert!(result.is_success());
    Ok(())
}

#[tokio::test]
async fn test_quorum_100_percent_accepted() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Test",
        "Description",
        None,
        100, // Valid maximum
    )
    .await?;

    assert!(result.is_success());
    Ok(())
}

// ==================== PROPERTY-BASED FUZZING TESTS ====================

// Pure function tests that don't require async/NEAR runtime
proptest! {
    /// Property 1: Quorum calculation is monotonic in citizens
    /// More citizens with same percentage → same or higher quorum requirement
    #[test]
    fn quorum_monotonic_in_citizens(
        pct in 1u8..=100,
        c1 in 1u64..10000,
        c2 in 1u64..10000
    ) {
        let q1 = calculate_quorum(c1, pct);
        let q2 = calculate_quorum(c2, pct);
        if c1 <= c2 {
            prop_assert!(q1 <= q2, "Quorum should be monotonic: {} citizens -> {}, {} citizens -> {}", c1, q1, c2, q2);
        }
    }

    /// Property 2: Quorum never exceeds total citizens
    #[test]
    fn quorum_never_exceeds_total(
        pct in 1u8..=100,
        citizens in 1u64..100000
    ) {
        let quorum = calculate_quorum(citizens, pct);
        prop_assert!(
            quorum <= citizens,
            "Quorum {} should not exceed citizens {}", quorum, citizens
        );
    }

    /// Property 3: 100% quorum requires all citizens
    #[test]
    fn full_quorum_requires_all(citizens in 1u64..10000) {
        let quorum = calculate_quorum(citizens, 100);
        prop_assert_eq!(
            quorum, citizens,
            "100% quorum should require all citizens"
        );
    }

    /// Property 4: Vote outcome is deterministic
    /// Same inputs always produce same result
    #[test]
    fn vote_outcome_deterministic(
        yes in 0u64..1000,
        no in 0u64..1000,
        abstain in 0u64..1000,
        quorum_pct in 1u8..=100,
        total_citizens in 1u64..10000
    ) {
        let result1 = compute_outcome(yes, no, abstain, quorum_pct, total_citizens);
        let result2 = compute_outcome(yes, no, abstain, quorum_pct, total_citizens);
        prop_assert_eq!(result1, result2, "Outcome should be deterministic");
    }

    /// Property 5: Abstain votes don't affect quorum satisfaction
    /// The quorum check only depends on yes + no votes
    #[test]
    fn abstain_doesnt_affect_quorum_check(
        yes in 0u64..100,
        no in 0u64..100,
        abstain1 in 0u64..1000,
        abstain2 in 0u64..1000,
        quorum_pct in 1u8..=100,
        total_citizens in 1u64..10000
    ) {
        let result1 = compute_outcome(yes, no, abstain1, quorum_pct, total_citizens);
        let result2 = compute_outcome(yes, no, abstain2, quorum_pct, total_citizens);
        // Both should have same outcome (abstain doesn't affect quorum)
        prop_assert_eq!(
            result1, result2,
            "Abstain votes should not affect outcome: {} vs {}", abstain1, abstain2
        );
    }

    /// Property 6: Quorum calculation uses floor division
    /// (citizens * pct) / 100 with integer division
    #[test]
    fn quorum_uses_floor_division(
        pct in 1u8..=100,
        citizens in 1u64..10000
    ) {
        let quorum = calculate_quorum(citizens, pct);
        let expected = (citizens * pct as u64) / 100;
        prop_assert_eq!(
            quorum, expected,
            "Quorum should use floor division"
        );
    }

    /// Property 7: Passed requires yes > no (strict majority)
    #[test]
    fn passed_requires_strict_majority(
        yes in 1u64..1000,
        no in 0u64..1000,
        abstain in 0u64..100,
        total_citizens in 1000u64..10000
    ) {
        // Use 1% quorum so it's always met
        let result = compute_outcome(yes, no, abstain, 1, total_citizens);
        if yes > no {
            prop_assert_eq!(result, ProposalOutcome::Passed, "yes > no should pass");
        } else {
            prop_assert_eq!(result, ProposalOutcome::Failed, "yes <= no should fail");
        }
    }

    /// Property 8: QuorumNotMet when insufficient yes+no votes
    #[test]
    fn quorum_not_met_when_insufficient(
        yes in 0u64..50,
        no in 0u64..50,
        abstain in 0u64..1000,
        total_citizens in 1000u64..10000
    ) {
        // Use 50% quorum, so 500+ votes needed
        // With yes+no < 100, quorum can't be met
        let quorum_required = calculate_quorum(total_citizens, 50);
        if yes + no < quorum_required {
            let result = compute_outcome(yes, no, abstain, 50, total_citizens);
            prop_assert_eq!(
                result, ProposalOutcome::QuorumNotMet,
                "Should be QuorumNotMet with {} yes + {} no < {} required",
                yes, no, quorum_required
            );
        }
    }
}
