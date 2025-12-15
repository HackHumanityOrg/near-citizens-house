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
#[allure_test]
#[test]
fn test_initialization() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let contract = SputnikBridge::new(
        accounts(0), // backend_wallet
        accounts(1), // sputnik_dao
        accounts(2), // verified_accounts_contract
        "citizen".to_string(),
    );

    assert_eq!(contract.get_backend_wallet(), accounts(0));
    assert_eq!(contract.get_sputnik_dao(), accounts(1));
    assert_eq!(contract.get_verified_accounts_contract(), accounts(2));
    assert_eq!(contract.get_citizen_role(), "citizen");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "initialization", "validation")]
#[allure_test]
#[test]
fn test_initialization_empty_citizen_role_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    assert_panic_with(
        || {
            SputnikBridge::new(
                accounts(0),
                accounts(1),
                accounts(2),
                "".to_string(), // Empty citizen_role
            );
        },
        "citizen_role must be non-empty",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "initialization", "validation")]
#[allure_test]
#[test]
fn test_initialization_whitespace_only_citizen_role_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    assert_panic_with(
        || {
            SputnikBridge::new(
                accounts(0),
                accounts(1),
                accounts(2),
                "   ".to_string(), // Whitespace-only citizen_role (gets trimmed to empty)
            );
        },
        "citizen_role must be non-empty",
    );
}
