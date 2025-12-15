//! Cross-contract call failure tests for sputnik-bridge contract
//!
//! These tests verify that the bridge handles cross-contract call failures correctly.
//! Per the NEAR security guide, state should remain consistent when callbacks fail,
//! and the system should handle partial failures gracefully.

use super::helpers::*;
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== CROSS-CONTRACT CALL FAILURE TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "state")]
#[allure_description("Verifies that when user verification fails, no state changes occur and no proposals are created in the DAO.")]
#[allure_test]
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
    assert!(
        !is_citizen,
        "User should not be added when verification fails"
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "events")]
#[allure_description("Verifies that when auto-approve fails (due to missing permissions), no member_added event is emitted and the user is not added.")]
#[allure_test]
#[tokio::test]
async fn test_add_member_auto_approve_failure_no_event() -> anyhow::Result<()> {
    // Bridge lacks VoteApprove permission, so auto-approval should fail
    let env = setup_with_policy_and_users(1, create_policy_without_autoapprove, true).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;

    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
    assert!(
        result.is_failure(),
        "Auto-approve should fail without permission"
    );

    let logs = extract_event_logs(&result);
    let events = parse_events(&logs);
    assert!(
        events.iter().all(|e| e.event != "member_added"),
        "member_added event must not be emitted on auto-approve failure"
    );

    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(
        !is_citizen,
        "User should not be added when auto-approve fails"
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "promise")]
#[allure_description("Verifies that when the verification contract promise fails, the entire flow is aborted with no events or state changes.")]
#[allure_test]
#[tokio::test]
async fn test_verification_promise_failure_no_event() -> anyhow::Result<()> {
    // Verification contract is uninitialized; promise should return Failure
    let env = setup_uninitialized_verified_with_users(1).await?;
    let user = env.user(0);

    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
    assert!(
        result.is_failure(),
        "Verification promise failure should abort flow"
    );

    let logs = extract_event_logs(&result);
    let events = parse_events(&logs);
    assert!(
        events.iter().all(|e| e.event != "member_added"),
        "No events should be emitted when verification promise fails"
    );

    let proposal_count = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);
    assert_eq!(
        proposal_count, 0,
        "No proposals should be created after promise failure"
    );

    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
    assert!(
        !is_citizen,
        "User must not be added when verification promise fails"
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "proposal")]
#[allure_description("Verifies that when proposal creation fails at the DAO level (e.g., insufficient deposit), no proposal_created event is emitted.")]
#[allure_test]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "member")]
#[allure_description("Verifies that when DAO rejects a member addition (e.g., insufficient deposit), no member_added event is emitted and user is not added.")]
#[allure_test]
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
        .gas(Gas::from_tgas(300))
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
    assert!(
        !is_citizen,
        "User should not be added when DAO rejects proposal"
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "state")]
#[allure_description("Verifies that multiple consecutive failures don't corrupt state and successful operations continue to work correctly.")]
#[allure_test]
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
        .gas(Gas::from_tgas(300))
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
    let is_citizen =
        is_account_in_role(&env.sputnik_dao, env.user(2).id().as_str(), "citizen").await?;
    assert!(is_citizen, "Successfully added user should be a citizen");

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("critical")]
#[allure_tags("integration", "failure", "gas")]
#[allure_description("Verifies that gas exhaustion during cross-contract calls doesn't cause partial state corruption and user is not added.")]
#[allure_test]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Failure Handling")]
#[allure_severity("normal")]
#[allure_tags("integration", "failure", "recovery")]
#[allure_description("Verifies that successful operations work correctly after a failed callback, demonstrating proper error recovery.")]
#[allure_test]
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
    let is_user1_citizen =
        is_account_in_role(&env.sputnik_dao, user1.id().as_str(), "citizen").await?;
    let is_user2_citizen =
        is_account_in_role(&env.sputnik_dao, user2.id().as_str(), "citizen").await?;

    assert!(!is_user1_citizen, "User1 should NOT be a citizen (failed)");
    assert!(is_user2_citizen, "User2 should be a citizen (succeeded)");

    Ok(())
}
