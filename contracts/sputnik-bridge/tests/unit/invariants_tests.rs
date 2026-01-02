//! Invariant tests for sputnik-bridge contract
//!
//! Per OpenZeppelin best practices: verify system-wide invariants

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::{calculate_quorum, SputnikBridge, MAX_DESCRIPTION_LEN, QUORUM_PERCENT};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant", "quorum")]
#[allure_description("Verifies QUORUM_PERCENT is within valid range (0 < value <= 100).")]
#[allure_test]
#[test]
fn test_invariant_quorum_percent_valid_range() {
    step("Verify QUORUM_PERCENT is positive", || {
        assert!(QUORUM_PERCENT > 0, "QUORUM_PERCENT must be positive");
    });

    step("Verify QUORUM_PERCENT does not exceed 100%", || {
        assert!(QUORUM_PERCENT <= 100, "QUORUM_PERCENT must not exceed 100%");
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant", "quorum")]
#[allure_description("Verifies that calculated quorum never exceeds the total citizen count.")]
#[allure_test]
#[test]
fn test_invariant_quorum_never_exceeds_citizen_count() {
    step(
        "Verify quorum never exceeds citizen count for 0..1000",
        || {
            for n in 0..1000 {
                let quorum = calculate_quorum(n);
                assert!(
                    quorum <= n,
                    "Quorum {} exceeded citizen count {} (invalid invariant)",
                    quorum,
                    n
                );
            }
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant", "quorum")]
#[allure_description("Verifies that quorum is monotonically increasing as citizen count grows.")]
#[allure_test]
#[test]
fn test_invariant_quorum_monotonic_increasing() {
    step(
        "Verify quorum is monotonically increasing for 0..1000",
        || {
            let mut prev_quorum = 0u64;
            for n in 0..1000 {
                let quorum = calculate_quorum(n);
                assert!(
                    quorum >= prev_quorum,
                    "Quorum decreased from {} to {} at citizen count {} (non-monotonic)",
                    prev_quorum,
                    quorum,
                    n
                );
                prev_quorum = quorum;
            }
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant", "initialization")]
#[allure_description(
    "Verifies all configured account IDs are valid and non-empty after contract initialization."
)]
#[allure_test]
#[test]
fn test_invariant_all_config_accounts_valid_after_init() {
    let contract = step("Initialize contract", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Verify backend wallet is non-empty", || {
        assert!(
            !contract.get_backend_wallet().as_str().is_empty(),
            "Backend wallet should not be empty"
        );
    });

    step("Verify verified_accounts_contract is non-empty", || {
        assert!(
            !contract
                .get_verified_accounts_contract()
                .as_str()
                .is_empty(),
            "Verified accounts contract should not be empty"
        );
    });

    step("Verify sputnik_dao is non-empty", || {
        assert!(
            !contract.get_sputnik_dao().as_str().is_empty(),
            "SputnikDAO contract should not be empty"
        );
    });

    step("Verify citizen_role is non-empty", || {
        assert!(
            !contract.get_citizen_role().is_empty(),
            "Citizen role should not be empty"
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("minor")]
#[allure_tags("unit", "invariant", "constants")]
#[allure_description("Verifies MAX_DESCRIPTION_LEN constant is positive.")]
#[allure_test]
#[test]
fn test_invariant_max_description_length_positive() {
    step("Verify MAX_DESCRIPTION_LEN is positive", || {
        assert!(
            MAX_DESCRIPTION_LEN > 0,
            "MAX_DESCRIPTION_LEN must be positive"
        );
    });
}
