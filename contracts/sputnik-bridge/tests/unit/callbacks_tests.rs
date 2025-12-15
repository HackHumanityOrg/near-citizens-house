//! Callback tests for sputnik-bridge contract
//!
//! Tests both successful and failed promise results to ensure proper error handling

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::testing_env;
use near_sdk::PromiseResult;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "verification")]
#[allure_description("Verifies callback successfully processes verified account and schedules add_proposal.")]
#[allure_test]
#[test]
fn test_callback_add_member_verified() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&true).unwrap()
        )]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should succeed and schedule next promise (add_proposal)
    let _ = contract.callback_add_member(accounts(3));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "verification")]
#[allure_description("Verifies callback rejects unverified account with appropriate error message.")]
#[allure_test]
#[test]
fn test_callback_add_member_not_verified() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&false).unwrap()
        )]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.callback_add_member(accounts(3));
        },
        "Account is not verified",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "proposal")]
#[allure_description("Verifies callback successfully processes proposal creation and schedules act_proposal.")]
#[allure_test]
#[test]
fn test_callback_proposal_created() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&1u64).unwrap()
        )]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should succeed and schedule next promise (act_proposal)
    let _ = contract.callback_proposal_created(accounts(3));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "member")]
#[allure_description("Verifies callback emits member_added event and schedules get_policy when member is successfully added.")]
#[allure_test]
#[test]
fn test_callback_member_added() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(vec![])]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should succeed and emit event + schedule get_policy
    let _ = contract.callback_member_added(accounts(3), 1);

    // Check for event emission
    let logs = get_logs();
    assert!(!logs.is_empty(), "Expected logs to be emitted");
    assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
    assert!(
        logs[0].contains("member_added"),
        "Expected member_added event"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "policy")]
#[allure_description("Verifies callback calculates quorum from policy and schedules quorum update proposal.")]
#[allure_test]
#[test]
fn test_callback_policy_received_for_quorum() {
    let builder = get_context(accounts(0));

    // Mock Policy JSON
    let policy_json = near_sdk::serde_json::json!({
        "roles": [
            {
                "name": "citizen",
                "kind": { "Group": ["member1.near", "member2.near"] },
                "permissions": []
            }
        ],
        "proposal_bond": "100"
    });

    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&policy_json).unwrap()
        )]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // 2 members -> quorum ceil(2 * 0.07) = 1
    // Should succeed and schedule add_proposal (quorum update)
    let _ = contract.callback_policy_received_for_quorum();
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "quorum")]
#[allure_description("Verifies callback successfully processes quorum proposal creation and schedules get_proposal.")]
#[allure_test]
#[test]
fn test_callback_quorum_proposal_created() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&2u64).unwrap()
        )]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should succeed and schedule get_proposal
    let _ = contract.callback_quorum_proposal_created(2, 1);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "quorum")]
#[allure_description("Verifies callback extracts proposal kind and schedules act_proposal for quorum update.")]
#[allure_test]
#[test]
fn test_callback_got_quorum_proposal() {
    let builder = get_context(accounts(0));

    // Mock Proposal JSON (ProposalKind::ChangePolicyAddOrUpdateRole)
    // We just need the "kind" field structure
    let proposal_json = near_sdk::serde_json::json!({
        "kind": {
            "ChangePolicyAddOrUpdateRole": {
                "role": {
                    "name": "citizen",
                    "kind": { "Group": ["member1.near"] },
                    "permissions": [],
                    "vote_policy": {}
                }
            }
        }
    });

    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&proposal_json).unwrap()
        )]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should extract kind and schedule act_proposal
    let _ = contract.callback_got_quorum_proposal(2, 1, 2);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "quorum")]
#[allure_description("Verifies callback emits quorum_updated event when quorum update is successfully approved.")]
#[allure_test]
#[test]
fn test_callback_quorum_updated() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(vec![])]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should succeed and emit event
    contract.callback_quorum_updated(2, 1, 2);

    // Check for event emission
    let logs = get_logs();
    assert!(!logs.is_empty(), "Expected logs to be emitted");
    assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
    assert!(
        logs[0].contains("quorum_updated"),
        "Expected quorum_updated event"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "proposal")]
#[allure_description("Verifies callback emits proposal_created event when vote proposal is successfully created.")]
#[allure_test]
#[test]
fn test_callback_vote_proposal_created() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Successful(
            near_sdk::serde_json::to_vec(&3u64).unwrap()
        )]
    );

    let contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Should succeed and emit event
    let _ = contract.callback_vote_proposal_created("desc".to_string());

    // Check for event emission
    let logs = get_logs();
    assert!(!logs.is_empty(), "Expected logs to be emitted");
    assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
    assert!(
        logs[0].contains("proposal_created"),
        "Expected proposal_created event"
    );
}

// ==================== PROMISE FAILURE TESTS ====================
// These tests verify that callbacks properly handle PromiseResult::Failed
// which occurs when a cross-contract call fails entirely (network error, out of gas, etc.)

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description("Verifies callback handles promise failure during verification check with appropriate error.")]
#[allure_test]
#[test]
fn test_callback_add_member_promise_failed() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed] // Actual promise failure, not Successful(false)
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.callback_add_member(accounts(3));
        },
        "Verification check failed",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description("Verifies callback handles promise failure during proposal creation with appropriate error.")]
#[allure_test]
#[test]
fn test_callback_proposal_created_promise_failed() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.callback_proposal_created(accounts(3));
        },
        "Failed to create proposal",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description("Verifies callback handles promise failure when approving member addition with appropriate error.")]
#[allure_test]
#[test]
fn test_callback_member_added_promise_failed() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.callback_member_added(accounts(3), 1);
        },
        "Failed to approve member addition proposal",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description("Verifies callback handles promise failure when retrieving policy with appropriate error.")]
#[allure_test]
#[test]
fn test_callback_policy_received_for_quorum_promise_failed() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.callback_policy_received_for_quorum();
        },
        "Failed to get policy",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description("Verifies callback handles promise failure when approving quorum update with appropriate error.")]
#[allure_test]
#[test]
fn test_callback_quorum_updated_promise_failed() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            contract.callback_quorum_updated(2, 1, 2);
        },
        "Failed to approve quorum update proposal",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description("Verifies callback handles promise failure when creating vote proposal with appropriate error.")]
#[allure_test]
#[test]
fn test_callback_vote_proposal_created_promise_failed() {
    let builder = get_context(accounts(0));
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        near_sdk::RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed]
    );

    let contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.callback_vote_proposal_created("desc".to_string());
        },
        "Failed to create proposal",
    );
}
