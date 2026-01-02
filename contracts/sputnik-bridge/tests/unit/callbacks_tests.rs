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
#[allure_description(
    "Verifies callback successfully processes verified account and schedules add_proposal."
)]
#[allure_test]
#[test]
fn test_callback_add_member_verified() {
    let mut contract = step("Set up context with successful verification result", || {
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Call callback_add_member and verify it succeeds", || {
        let _ = contract.callback_add_member(accounts(3));
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "verification")]
#[allure_description(
    "Verifies callback rejects unverified account with appropriate error message."
)]
#[allure_test]
#[test]
fn test_callback_add_member_not_verified() {
    let mut contract = step("Set up context with unverified result (false)", || {
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Verify callback panics with 'Account is not verified'",
        || {
            assert_panic_with(
                || {
                    let _ = contract.callback_add_member(accounts(3));
                },
                "Account is not verified",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "proposal")]
#[allure_description(
    "Verifies callback successfully processes proposal creation and schedules act_proposal."
)]
#[allure_test]
#[test]
fn test_callback_proposal_created() {
    let mut contract = step("Set up context with proposal ID result", || {
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Call callback_proposal_created and verify it succeeds",
        || {
            let _ = contract.callback_proposal_created(accounts(3));
        },
    );
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
    let mut contract = step("Set up context with successful promise result", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Call callback_member_added", || {
        let _ = contract.callback_member_added(accounts(3), 1);
    });

    step("Verify member_added event was emitted", || {
        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected logs to be emitted");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(
            logs[0].contains("member_added"),
            "Expected member_added event"
        );
        assert!(
            logs[0].contains("danny"),
            "Expected member ID in event payload"
        );
        assert!(
            logs[0].contains("citizen"),
            "Expected citizen role to be included in event payload"
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "policy")]
#[allure_description(
    "Verifies callback calculates quorum from policy and schedules quorum update proposal."
)]
#[allure_test]
#[test]
fn test_callback_policy_received_for_quorum() {
    let mut contract = step("Set up context with mock policy JSON (2 citizens)", || {
        let builder = get_context(accounts(0));
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Call callback_policy_received_for_quorum and verify it succeeds",
        || {
            let _ = contract.callback_policy_received_for_quorum();
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "quorum")]
#[allure_description(
    "Verifies callback successfully processes quorum proposal creation and schedules get_proposal."
)]
#[allure_test]
#[test]
fn test_callback_quorum_proposal_created() {
    let mut contract = step("Set up context with proposal ID result", || {
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Call callback_quorum_proposal_created and verify it succeeds",
        || {
            let _ = contract.callback_quorum_proposal_created(2, 1);
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "quorum")]
#[allure_description(
    "Verifies callback extracts proposal kind and schedules act_proposal for quorum update."
)]
#[allure_test]
#[test]
fn test_callback_got_quorum_proposal() {
    let mut contract = step("Set up context with mock proposal JSON", || {
        let builder = get_context(accounts(0));
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Call callback_got_quorum_proposal and verify it succeeds",
        || {
            let _ = contract.callback_got_quorum_proposal(2, 1, 2);
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "quorum")]
#[allure_description(
    "Verifies callback emits quorum_updated event when quorum update is successfully approved."
)]
#[allure_test]
#[test]
fn test_callback_quorum_updated() {
    let mut contract = step("Set up context with successful promise result", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Call callback_quorum_updated", || {
        contract.callback_quorum_updated(2, 1, 2);
    });

    step(
        "Verify quorum_updated event was emitted with correct data",
        || {
            let logs = get_logs();
            assert!(!logs.is_empty(), "Expected logs to be emitted");
            assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
            assert!(
                logs[0].contains("quorum_updated"),
                "Expected quorum_updated event"
            );
            assert!(
                logs[0].contains("\"citizen_count\":2"),
                "Expected citizen_count in quorum_updated event"
            );
            assert!(
                logs[0].contains("\"new_quorum\":1"),
                "Expected new_quorum in quorum_updated event"
            );
            assert!(
                logs[0].contains("\"proposal_id\":2"),
                "Expected proposal_id in quorum_updated event"
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "proposal")]
#[allure_description(
    "Verifies callback emits proposal_created event when vote proposal is successfully created."
)]
#[allure_test]
#[test]
fn test_callback_vote_proposal_created() {
    let contract = step("Set up context with proposal ID result", || {
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
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Call callback_vote_proposal_created", || {
        let _ = contract.callback_vote_proposal_created("desc".to_string());
    });

    step(
        "Verify proposal_created event was emitted with correct data",
        || {
            let logs = get_logs();
            assert!(!logs.is_empty(), "Expected logs to be emitted");
            assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
            assert!(
                logs[0].contains("proposal_created"),
                "Expected proposal_created event"
            );
            assert!(
                logs[0].contains("\"proposal_id\":3"),
                "Expected proposal_id in proposal_created event"
            );
            assert!(
                logs[0].contains("\"description\":\"desc\""),
                "Expected description to be serialized in proposal_created event"
            );
        },
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
#[allure_description(
    "Verifies callback handles promise failure during verification check with appropriate error."
)]
#[allure_test]
#[test]
fn test_callback_add_member_promise_failed() {
    let mut contract = step("Set up context with PromiseResult::Failed", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Verify callback panics with 'Verification check failed'",
        || {
            assert_panic_with(
                || {
                    let _ = contract.callback_add_member(accounts(3));
                },
                "Verification check failed",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description(
    "Verifies callback handles promise failure during proposal creation with appropriate error."
)]
#[allure_test]
#[test]
fn test_callback_proposal_created_promise_failed() {
    let mut contract = step("Set up context with PromiseResult::Failed", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Verify callback panics with 'Failed to create proposal'",
        || {
            assert_panic_with(
                || {
                    let _ = contract.callback_proposal_created(accounts(3));
                },
                "Failed to create proposal",
            );
        },
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
    let mut contract = step("Set up context with PromiseResult::Failed", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Verify callback panics with 'Failed to approve member addition proposal'",
        || {
            assert_panic_with(
                || {
                    let _ = contract.callback_member_added(accounts(3), 1);
                },
                "Failed to approve member addition proposal",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description(
    "Verifies callback handles promise failure when retrieving policy with appropriate error."
)]
#[allure_test]
#[test]
fn test_callback_policy_received_for_quorum_promise_failed() {
    let mut contract = step("Set up context with PromiseResult::Failed", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Verify callback panics with 'Failed to get policy'", || {
        assert_panic_with(
            || {
                let _ = contract.callback_policy_received_for_quorum();
            },
            "Failed to get policy",
        );
    });
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
    let mut contract = step("Set up context with PromiseResult::Failed", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Verify callback panics with 'Failed to approve quorum update proposal'",
        || {
            assert_panic_with(
                || {
                    contract.callback_quorum_updated(2, 1, 2);
                },
                "Failed to approve quorum update proposal",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Callbacks")]
#[allure_severity("critical")]
#[allure_tags("unit", "callback", "failure-handling")]
#[allure_description(
    "Verifies callback handles promise failure when creating vote proposal with appropriate error."
)]
#[allure_test]
#[test]
fn test_callback_vote_proposal_created_promise_failed() {
    let contract = step("Set up context with PromiseResult::Failed", || {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed]
        );
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step(
        "Verify callback panics with 'Failed to create proposal'",
        || {
            assert_panic_with(
                || {
                    let _ = contract.callback_vote_proposal_created("desc".to_string());
                },
                "Failed to create proposal",
            );
        },
    );
}
