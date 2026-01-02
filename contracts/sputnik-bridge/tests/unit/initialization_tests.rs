//! Initialization tests for sputnik-bridge contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "initialization")]
#[allure_description(
    "Verifies contract initializes correctly with all config values stored properly."
)]
#[allure_test]
#[test]
fn test_initialization() {
    let contract = step("Initialize contract", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
        SputnikBridge::new(
            accounts(0), // backend_wallet
            accounts(1), // sputnik_dao
            accounts(2), // verified_accounts_contract
            "citizen".to_string(),
        )
    });

    step("Verify backend_wallet is set correctly", || {
        assert_eq!(contract.get_backend_wallet(), accounts(0));
    });

    step("Verify sputnik_dao is set correctly", || {
        assert_eq!(contract.get_sputnik_dao(), accounts(1));
    });

    step("Verify verified_accounts_contract is set correctly", || {
        assert_eq!(contract.get_verified_accounts_contract(), accounts(2));
    });

    step("Verify citizen_role is set correctly", || {
        assert_eq!(contract.get_citizen_role(), "citizen");
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "initialization", "validation")]
#[allure_description("Verifies that empty citizen_role is rejected during initialization.")]
#[allure_test]
#[test]
fn test_initialization_empty_citizen_role_fails() {
    step("Set up test context", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
    });

    step("Attempt initialization with empty citizen_role", || {
        assert_panic_with(
            || {
                SputnikBridge::new(accounts(0), accounts(1), accounts(2), "".to_string());
            },
            "citizen_role must be non-empty",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "initialization", "validation")]
#[allure_description(
    "Verifies that whitespace-only citizen_role is trimmed and rejected as empty."
)]
#[allure_test]
#[test]
fn test_initialization_whitespace_only_citizen_role_fails() {
    step("Set up test context", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
    });

    step(
        "Attempt initialization with whitespace-only citizen_role",
        || {
            assert_panic_with(
                || {
                    SputnikBridge::new(accounts(0), accounts(1), accounts(2), "   ".to_string());
                },
                "citizen_role must be non-empty",
            );
        },
    );
}
