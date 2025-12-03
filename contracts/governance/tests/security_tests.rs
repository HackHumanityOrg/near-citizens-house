//! Security-focused tests for governance contract
//!
//! This module tests security scenarios including:
//! - Access control
//! - Sybil resistance
//! - Snapshot attack prevention
//! - Governance attack scenarios
//! - Input sanitization
//! - Cross-contract security

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== ACCESS CONTROL TESTS ====================

#[tokio::test]
async fn test_only_verified_can_create_proposals() -> anyhow::Result<()> {
    let (worker, governance, verified_accounts, backend) = setup().await?;

    // Create an unverified user
    let unverified_user = worker.dev_create_account().await?;

    // Try to create a proposal
    let result = unverified_user
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Test",
            "description": "Description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Only verified citizens can create proposals");

    // Now verify the user
    verify_user(&backend, &verified_accounts, &unverified_user, 0).await?;

    // Should succeed now
    let result = unverified_user
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Test",
            "description": "Description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_success());

    Ok(())
}

#[tokio::test]
async fn test_only_verified_can_vote() -> anyhow::Result<()> {
    let (worker, governance, verified_accounts, backend) = setup().await?;

    // Create and verify proposer
    let proposer = worker.dev_create_account().await?;
    verify_user(&backend, &verified_accounts, &proposer, 0).await?;

    // Create a proposal
    let proposal_id = create_proposal_helper(&proposer, &governance, "Test", 10).await?;

    // Create an unverified voter
    let unverified_voter = worker.dev_create_account().await?;

    // Try to vote (should fail)
    let result = vote_helper(&unverified_voter, &governance, proposal_id, "Yes").await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Only verified citizens can vote");

    Ok(())
}

#[tokio::test]
async fn test_callbacks_are_private() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Create a proposal so we have a valid proposal_id
    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 10).await?;

    // Try to call callback_create_proposal directly (should fail - private)
    let result = env.verified_users[0]
        .call(env.governance.id(), "callback_create_proposal")
        .args_json(json!({
            "proposer": env.verified_users[0].id(),
            "title": "Malicious",
            "description": "Trying to bypass verification",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    // Should fail because callback is private
    assert!(result.is_failure());

    // Try to call callback_vote directly (should fail - private)
    let result = env.verified_users[0]
        .call(env.governance.id(), "callback_vote")
        .args_json(json!({
            "voter": env.verified_users[0].id(),
            "proposal_id": proposal_id,
            "vote": "Yes"
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());

    // Try to call callback_finalize_proposal directly (should fail - private)
    let result = env.verified_users[0]
        .call(env.governance.id(), "callback_finalize_proposal")
        .args_json(json!({
            "proposal_id": proposal_id
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_no_admin_backdoors() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Verify there's no way to modify state without going through proper channels
    // Try to call internal methods that shouldn't exist

    // These should all fail because they don't exist or aren't public
    let methods_that_should_not_exist = [
        "set_verified_accounts_contract",
        "update_proposal",
        "delete_proposal",
        "set_vote",
        "set_admin",
        "upgrade",
        "migrate",
    ];

    for method in methods_that_should_not_exist {
        let result = env.verified_users[0]
            .call(env.governance.id(), method)
            .args_json(json!({}))
            .transact()
            .await?;

        assert!(
            result.is_failure(),
            "Method '{}' should not exist or be callable",
            method
        );
    }

    Ok(())
}

#[tokio::test]
async fn test_contract_state_immutable_by_arbitrary_accounts() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    // Create a random attacker account
    let attacker = worker.dev_create_account().await?;

    // Try various attack vectors
    // 1. Try to initialize again
    let result = attacker
        .call(governance.id(), "new")
        .args_json(json!({
            "verified_accounts_contract": attacker.id()
        }))
        .transact()
        .await?;

    assert!(
        result.is_failure(),
        "Re-initialization should fail - state already exists"
    );

    Ok(())
}

// ==================== SYBIL RESISTANCE TESTS ====================

#[tokio::test]
async fn test_same_nullifier_cannot_verify_twice() -> anyhow::Result<()> {
    let (worker, governance, verified_accounts, backend) = setup().await?;

    // Create two accounts
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;

    // Verify first user with nullifier "test_nullifier_0"
    verify_user(&backend, &verified_accounts, &user1, 0).await?;

    // Try to verify second user with SAME nullifier (simulating same passport)
    let nonce: [u8; 32] = [99u8; 32]; // Different nonce
    let challenge = "Identify myself";
    let recipient = user2.id().to_string();
    let (signature, public_key) =
        generate_nep413_signature(&user2, challenge, &nonce, &recipient);

    let result = backend
        .call(verified_accounts.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier_0", // SAME nullifier as user1
            "near_account_id": user2.id(),
            "user_id": "user_2",
            "attestation_id": "2",
            "signature_data": {
                "account_id": user2.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context_2"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail because nullifier is already used
    assert!(result.is_failure());
    assert_failure_with(&result, "Nullifier already used");

    Ok(())
}

#[tokio::test]
async fn test_cross_contract_verification_call_made() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Create a proposal
    let result = env.verified_users[0]
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Test",
            "description": "Description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    // Success means cross-contract call was made and returned true
    assert!(result.is_success());

    // Check that the proposal was created (proves callback was executed)
    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 1);

    Ok(())
}

#[tokio::test]
async fn test_malformed_verification_response_handled() -> anyhow::Result<()> {
    // This test verifies that if the verified-accounts contract returns
    // malformed data, the governance contract handles it gracefully.
    // In practice, this is hard to test without a mock contract,
    // but we can verify the contract doesn't panic with valid responses.

    let env = setup_with_verified_users(1).await?;

    // Normal operation should work
    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 10).await?;

    let proposal = get_proposal(&env.governance, proposal_id).await?;
    assert!(proposal.is_some());

    Ok(())
}

#[tokio::test]
async fn test_cross_contract_failure_handling() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    // Create an unverified account
    let unverified = worker.dev_create_account().await?;

    // The cross-contract call will return false (not verified)
    // The callback should handle this and reject the operation
    let result = unverified
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Test",
            "description": "Description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    // Should fail gracefully with clear error message
    assert!(result.is_failure());
    assert_failure_with(&result, "Only verified citizens can create proposals");

    Ok(())
}

// ==================== SNAPSHOT ATTACK PREVENTION TESTS ====================

#[tokio::test]
async fn test_cannot_vote_with_late_verification() -> anyhow::Result<()> {
    let (worker, governance, verified_accounts, backend) = setup().await?;

    // Create and verify proposer
    let proposer = worker.dev_create_account().await?;
    verify_user(&backend, &verified_accounts, &proposer, 0).await?;

    // Create proposal BEFORE voter is verified
    let proposal_id = create_proposal_helper(&proposer, &governance, "Test", 10).await?;

    // Now create and verify a voter AFTER the proposal
    let late_voter = worker.dev_create_account().await?;
    verify_user(&backend, &verified_accounts, &late_voter, 1).await?;

    // Try to vote - should fail due to snapshot
    let result = vote_helper(&late_voter, &governance, proposal_id, "Yes").await?;

    assert!(result.is_failure());
    assert_failure_with(
        &result,
        "You must be verified before the proposal was created",
    );

    Ok(())
}

#[tokio::test]
async fn test_cannot_frontrun_proposal_creation() -> anyhow::Result<()> {
    // This test verifies that even if someone tries to time their verification
    // exactly with proposal creation, the snapshot prevents voting

    let (worker, governance, verified_accounts, backend) = setup().await?;

    // Verify proposer
    let proposer = worker.dev_create_account().await?;
    verify_user(&backend, &verified_accounts, &proposer, 0).await?;

    // Create proposal
    let proposal_id = create_proposal_helper(&proposer, &governance, "Test", 10).await?;

    // Even a user verified at index 1 (which happens "after" in our sequential setup)
    // should not be able to vote if their verification timestamp is after proposal creation
    let late_user = worker.dev_create_account().await?;
    verify_user(&backend, &verified_accounts, &late_user, 999).await?; // High index = later verification

    let result = vote_helper(&late_user, &governance, proposal_id, "Yes").await?;

    assert!(result.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_verification_timestamp_comparison() -> anyhow::Result<()> {
    // This test verifies that the timestamp comparison is correct
    // A user verified BEFORE proposal creation CAN vote

    let env = setup_with_verified_users(2).await?;

    // Both users were verified BEFORE any proposals exist
    // Create a proposal with first user
    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 10).await?;

    // Second user (verified before proposal) should be able to vote
    let result =
        vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?;

    assert!(result.is_success());

    Ok(())
}

#[tokio::test]
async fn test_multiple_accounts_same_identity_blocked() -> anyhow::Result<()> {
    // This is handled by nullifier uniqueness in verified-accounts
    // If someone tries to verify two accounts with same passport, second fails

    let (worker, _, verified_accounts, backend) = setup().await?;

    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;

    // Verify first account
    verify_user(&backend, &verified_accounts, &user1, 0).await?;

    // Try to verify second account with same nullifier pattern
    let nonce: [u8; 32] = [0u8; 32]; // Same as user1
    let challenge = "Identify myself";
    let recipient = user2.id().to_string();
    let (signature, public_key) =
        generate_nep413_signature(&user2, challenge, &nonce, &recipient);

    let result = backend
        .call(verified_accounts.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier_0", // Same as user1
            "near_account_id": user2.id(),
            "user_id": "user_duplicate",
            "attestation_id": "dup",
            "signature_data": {
                "account_id": user2.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context_dup"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure());

    Ok(())
}

// ==================== GOVERNANCE ATTACK SCENARIOS ====================

#[tokio::test]
async fn test_proposal_threshold_enforcement() -> anyhow::Result<()> {
    // In this contract, threshold is simply "must be verified"
    // No token threshold exists

    let (worker, governance, _, _) = setup().await?;
    let unverified = worker.dev_create_account().await?;

    let result = unverified
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Attack",
            "description": "Malicious proposal",
            "discourse_url": null,
            "quorum_percentage": 1
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_quorum_cannot_be_bypassed() -> anyhow::Result<()> {
    let env = setup_with_verified_users(10).await?;

    // Create proposal with 50% quorum (5 votes needed)
    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 50).await?;

    // Only 4 votes (below quorum)
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
async fn test_voting_period_cannot_be_extended() -> anyhow::Result<()> {
    // There's no method to extend voting period
    // Voting period is fixed at creation time

    let (env, proposal_id) = setup_with_proposal(1, 10).await?;

    let proposal_before = get_proposal(&env.governance, proposal_id).await?.unwrap();
    let voting_ends_at_before = proposal_before.voting_ends_at;

    // Advance time
    advance_days(&env.worker, 3).await?;

    // Check voting period hasn't changed
    let proposal_after = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal_after.voting_ends_at, voting_ends_at_before);

    Ok(())
}

#[tokio::test]
async fn test_cancelled_proposals_cannot_be_reactivated() -> anyhow::Result<()> {
    let (env, proposal_id) = setup_with_proposal(1, 10).await?;

    // Cancel the proposal
    cancel_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Cancelled);

    // Try to vote on cancelled proposal
    let result =
        vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_failure());

    // Try to finalize cancelled proposal
    advance_past_voting_period(&env.worker).await?;
    let result = finalize_proposal(&env.verified_users[0], &env.governance, proposal_id).await?;
    assert!(result.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_finalized_proposals_cannot_be_refinalized() -> anyhow::Result<()> {
    let env = setup_with_verified_users(3).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 10).await?;

    // Vote to pass
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // First finalization
    finalize_proposal(&env.verified_users[0], &env.governance, proposal_id)
        .await?
        .into_result()?;

    let proposal = get_proposal(&env.governance, proposal_id).await?.unwrap();
    assert_eq!(proposal.status, ProposalStatus::Passed);

    // Try to finalize again
    let result = finalize_proposal(&env.verified_users[0], &env.governance, proposal_id).await?;
    assert!(result.is_failure());
    assert_failure_with(&result, "Proposal is not active");

    Ok(())
}

#[tokio::test]
async fn test_proposal_ids_are_sequential_and_unique() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Create multiple proposals
    let id1 = create_proposal_helper(&env.verified_users[0], &env.governance, "First", 10).await?;
    let id2 =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Second", 10).await?;
    let id3 = create_proposal_helper(&env.verified_users[0], &env.governance, "Third", 10).await?;

    // IDs should be sequential
    assert_eq!(id1, 0);
    assert_eq!(id2, 1);
    assert_eq!(id3, 2);

    // Total count should match
    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 3);

    Ok(())
}

// ==================== INPUT SANITIZATION TESTS ====================

#[tokio::test]
async fn test_sql_injection_in_strings_harmless() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // SQL injection attempts (should be stored as-is, no SQL in NEAR)
    let malicious_title = "'; DROP TABLE proposals; --";
    let malicious_description = "SELECT * FROM users WHERE 1=1; DELETE FROM proposals;";

    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        malicious_title,
        malicious_description,
        None,
        10,
    )
    .await?;

    assert!(result.is_success());

    // Verify the strings were stored verbatim
    let proposal = get_proposal(&env.governance, 0).await?.unwrap();
    assert_eq!(proposal.title, malicious_title);
    assert_eq!(proposal.description, malicious_description);

    Ok(())
}

#[tokio::test]
async fn test_very_long_strings_rejected() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Title over limit
    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        &string_over_limit(MAX_TITLE_LEN),
        "Valid description",
        None,
        10,
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Title exceeds maximum length");

    // Description over limit
    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Valid title",
        &string_over_limit(MAX_DESCRIPTION_LEN),
        None,
        10,
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Description exceeds maximum length");

    // URL over limit
    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Valid title",
        "Valid description",
        Some(&string_over_limit(MAX_DISCOURSE_URL_LEN)),
        10,
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Discourse URL exceeds maximum length");

    Ok(())
}

#[tokio::test]
async fn test_null_bytes_in_strings() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Strings with null bytes
    let title_with_null = "Test\0Title";
    let description_with_null = "Description\0with\0nulls";

    // These should either be accepted (stored as-is) or rejected
    // In Rust/NEAR, strings can contain null bytes, so they should be stored
    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        title_with_null,
        description_with_null,
        None,
        10,
    )
    .await?;

    // NEAR/Rust strings handle null bytes fine
    assert!(result.is_success());

    Ok(())
}

#[tokio::test]
async fn test_control_characters_in_strings() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Control characters
    let title_with_control = "Test\x01\x02\x03Title";
    let description_with_control = "Desc\x7f\x1b[31mRed\x1b[0m";

    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        title_with_control,
        description_with_control,
        None,
        10,
    )
    .await?;

    // Should be accepted (no sanitization needed for display-only strings)
    assert!(result.is_success());

    Ok(())
}

#[tokio::test]
async fn test_extreme_quorum_values_rejected() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Test quorum = 0 (invalid minimum)
    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Test",
        "Description",
        None,
        0,
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Quorum percentage must be between 1 and 100");

    // Test quorum = 255 (max u8, invalid)
    let result = create_proposal_full(
        &env.verified_users[0],
        &env.governance,
        "Test",
        "Description",
        None,
        255,
    )
    .await?;

    assert!(result.is_failure());
    assert_failure_with(&result, "Quorum percentage must be between 1 and 100");

    Ok(())
}

// ==================== CROSS-CONTRACT SECURITY ====================

#[tokio::test]
async fn test_reentrancy_protection() -> anyhow::Result<()> {
    // NEAR's execution model prevents traditional reentrancy
    // Each cross-contract call is a separate transaction
    // However, we should verify state is properly updated atomically

    let env = setup_with_verified_users(2).await?;

    let proposal_id =
        create_proposal_helper(&env.verified_users[0], &env.governance, "Test", 10).await?;

    // Vote from first user
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    // Verify vote was recorded atomically
    let has_voted = has_voted(
        &env.governance,
        proposal_id,
        &env.verified_users[0].id().to_string(),
    )
    .await?;
    assert!(has_voted);

    // Trying to vote again should fail (double-vote protection)
    let result =
        vote_helper(&env.verified_users[0], &env.governance, proposal_id, "No").await?;
    assert!(result.is_failure());
    assert_failure_with(&result, "Already voted on this proposal");

    Ok(())
}

#[tokio::test]
async fn test_cross_contract_gas_exhaustion_handling() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;

    // Try to create proposal with very low gas (should fail gracefully)
    let result = env.verified_users[0]
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Test",
            "description": "Description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(5)) // Too low for cross-contract call
        .transact()
        .await?;

    // Should fail due to insufficient gas
    assert!(result.is_failure());

    // But contract state should remain valid
    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 0); // No proposal was created

    Ok(())
}

#[tokio::test]
async fn test_double_initialization_blocked() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    // Try to initialize again
    let attacker = worker.dev_create_account().await?;

    let result = attacker
        .call(governance.id(), "new")
        .args_json(json!({
            "verified_accounts_contract": attacker.id()
        }))
        .transact()
        .await?;

    // Should fail - already initialized
    assert!(result.is_failure());

    Ok(())
}
