//! Backend wallet management tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context, parse_event, BackendWalletUpdatedEvent};
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
    let (mut contract, backend, new_backend) = step("Initialize contract", || {
        let backend = accounts(1);
        let new_backend = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend.clone());
        (contract, backend, new_backend)
    });

    step("Verify initial backend wallet", || {
        assert_eq!(contract.get_backend_wallet(), backend);
    });

    let backend_str = step("Update backend wallet", || {
        let backend_str = backend.to_string();
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.update_backend_wallet(new_backend.clone());
        backend_str
    });

    step("Verify new backend wallet and event", || {
        assert_eq!(contract.get_backend_wallet(), new_backend);

        let logs = get_logs();
        let event: BackendWalletUpdatedEvent = parse_event(&logs, "backend_wallet_updated")
            .expect("backend_wallet_updated event not found");
        assert_eq!(event.old_wallet, backend_str);
        assert_eq!(event.new_wallet, new_backend.to_string());
    });
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
    let mut contract = step("Initialize contract with unauthorized caller", || {
        let backend = accounts(1);
        let unauthorized = accounts(0);
        let mut context = get_context(unauthorized);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Attempt update_backend_wallet from unauthorized account", || {
        assert_panic_with(
            || contract.update_backend_wallet(accounts(3)),
            "Only backend wallet can update backend wallet",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "yocto")]
#[allure_description("Verifies that update_backend_wallet requires exactly 1 yoctoNEAR attached deposit.")]
#[allure_test]
#[test]
fn test_update_backend_wallet_requires_one_yocto() {
    let (mut contract, backend) = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend.clone());
        (contract, backend)
    });

    step("Attempt update_backend_wallet without yoctoNEAR", || {
        // Create context with zero deposit
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(context.build());

        assert_panic_with(
            || contract.update_backend_wallet(accounts(2)),
            "Requires attached deposit of exactly 1 yoctoNEAR",
        );
    });
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
    let (mut contract, new_backend) = step("Initialize contract with yocto deposit", || {
        let backend = accounts(1);
        let new_backend = accounts(2);
        let mut context = get_context(backend.clone());
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, new_backend)
    });

    step("Update backend wallet and verify", || {
        contract.update_backend_wallet(new_backend.clone());
        assert_eq!(contract.get_backend_wallet(), new_backend);
    });
}
