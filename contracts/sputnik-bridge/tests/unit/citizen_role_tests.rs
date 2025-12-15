//! Citizen role management tests for sputnik-bridge contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Citizen Role Management")]
#[allure_severity("normal")]
#[allure_tags("unit", "admin", "role")]
#[allure_test]
#[test]
fn test_update_citizen_role() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    contract.update_citizen_role("voter".to_string());
    assert_eq!(contract.get_citizen_role(), "voter");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Citizen Role Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_test]
#[test]
fn test_update_citizen_role_unauthorized() {
    let mut context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Switch to different account
    context.predecessor_account_id(accounts(4));
    testing_env!(context.build());

    assert_panic_with(
        || contract.update_citizen_role("voter".to_string()),
        "Only backend wallet can call this function",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Citizen Role Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "admin", "role", "validation")]
#[allure_test]
#[test]
fn test_update_citizen_role_empty_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || contract.update_citizen_role("".to_string()),
        "new_role must be non-empty",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Citizen Role Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "admin", "role", "validation")]
#[allure_test]
#[test]
fn test_update_citizen_role_whitespace_only_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || contract.update_citizen_role("   ".to_string()), // Whitespace-only (gets trimmed to empty)
        "new_role must be non-empty",
    );
}
