//! Backend wallet management tests for sputnik-bridge contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "admin", "wallet")]
#[allure_description("Verifies backend wallet can successfully update to a new wallet address.")]
#[allure_test]
#[test]
fn test_update_backend_wallet() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    contract.update_backend_wallet(accounts(3));
    assert_eq!(contract.get_backend_wallet(), accounts(3));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description("Verifies unauthorized account cannot update backend wallet and receives appropriate error.")]
#[allure_test]
#[test]
fn test_update_backend_wallet_unauthorized() {
    let mut context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    // Switch to different account
    context.predecessor_account_id(accounts(4));
    testing_env!(context.build());

    assert_panic_with(
        || contract.update_backend_wallet(accounts(3)),
        "Only backend wallet can call this function",
    );
}
