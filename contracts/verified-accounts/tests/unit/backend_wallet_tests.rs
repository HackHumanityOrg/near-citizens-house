//! Backend wallet management tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::testing_env;
use near_sdk::NearToken;
use verified_accounts::Contract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "admin", "wallet")]
#[allure_description("Verifies that backend wallet can be updated by the current backend wallet, emitting proper events.")]
#[allure_test]
#[test]
fn test_update_backend_wallet() {
    let backend = accounts(1);
    let new_backend = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());
    assert_eq!(contract.get_backend_wallet(), backend);

    // Update backend wallet (requires 1 yocto)
    let mut context = get_context(backend);
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());
    contract.update_backend_wallet(new_backend.clone());
    assert_eq!(contract.get_backend_wallet(), new_backend);

    let logs = get_logs();
    assert!(!logs.is_empty(), "Expected backend wallet update event");
    assert!(
        logs.iter().any(|l| l.contains("EVENT_JSON")),
        "Expected JSON event"
    );
    assert!(
        logs.iter().any(|l| l.contains("backend_wallet_updated")),
        "Expected backend_wallet_updated event"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description("Verifies that only the current backend wallet can update the backend wallet and unauthorized accounts are rejected.")]
#[allure_test]
#[test]
fn test_unauthorized_update_backend_wallet() {
    let backend = accounts(1);
    let unauthorized = accounts(0);
    let mut context = get_context(unauthorized);
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    assert_panic_with(
        || contract.update_backend_wallet(accounts(3)),
        "Only current backend wallet can update backend wallet",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("minor")]
#[allure_tags("unit", "admin", "wallet", "alias")]
#[allure_description("Alias test to align documentation naming; asserts backend wallet update succeeds and persists.")]
#[allure_test]
#[test]
fn test_update() {
    let backend = accounts(1);
    let new_backend = accounts(2);
    let mut context = get_context(backend.clone());
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());
    contract.update_backend_wallet(new_backend.clone());
    assert_eq!(contract.get_backend_wallet(), new_backend);
}
