//! Access control tests for sputnik-bridge contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description("Verifies unauthorized account cannot create proposal and receives appropriate error.")]
#[allure_test]
#[test]
fn test_create_proposal_unauthorized_fails() {
    let (mut contract, mut context) = step("Initialize contract", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());
        (contract, context)
    });

    step("Switch to unauthorized account", || {
        context.predecessor_account_id(accounts(4));
        testing_env!(context.build());
    });

    step("Attempt create_proposal from unauthorized account", || {
        assert_panic_with(
            || {
                let _ = contract.create_proposal("Valid proposal".to_string());
            },
            "Only backend wallet can call this function",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description("Verifies unauthorized account cannot add member and receives appropriate error.")]
#[allure_test]
#[test]
fn test_add_member_unauthorized_fails() {
    let (mut contract, mut context) = step("Initialize contract", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
        let contract = SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());
        (contract, context)
    });

    step("Switch to unauthorized account", || {
        context.predecessor_account_id(accounts(4));
        testing_env!(context.build());
    });

    step("Attempt add_member from unauthorized account", || {
        assert_panic_with(
            || {
                let _ = contract.add_member(accounts(5));
            },
            "Only backend wallet can call this function",
        );
    });
}
