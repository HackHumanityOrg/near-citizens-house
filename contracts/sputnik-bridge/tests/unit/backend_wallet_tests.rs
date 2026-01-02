//! Backend wallet management tests for sputnik-bridge contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use near_sdk::NearToken;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "admin", "wallet")]
#[allure_description(
    "Verifies backend wallet can successfully update to a new wallet address with 1 yocto deposit."
)]
#[allure_test]
#[test]
fn test_update_backend_wallet() {
    let mut contract = step("Initialize contract with 1 yocto deposit", || {
        let mut context = get_context(accounts(0));
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Update backend wallet to new account", || {
        contract.update_backend_wallet(accounts(3));
    });

    step("Verify backend wallet was updated", || {
        assert_eq!(contract.get_backend_wallet(), accounts(3));
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description(
    "Verifies unauthorized account cannot update backend wallet and receives appropriate error."
)]
#[allure_test]
#[test]
fn test_update_backend_wallet_unauthorized() {
    let (mut contract, mut context) = step("Initialize contract", || {
        let mut context = get_context(accounts(0));
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        let contract =
            SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());
        (contract, context)
    });

    step(
        "Switch to unauthorized account with 1 yocto deposit",
        || {
            context.predecessor_account_id(accounts(4));
            context.attached_deposit(NearToken::from_yoctonear(1));
            testing_env!(context.build());
        },
    );

    step("Verify unauthorized update is rejected", || {
        assert_panic_with(
            || contract.update_backend_wallet(accounts(3)),
            "Only backend wallet can call this function",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "deposit")]
#[allure_description("Verifies that update_backend_wallet requires exactly 1 yoctoNEAR deposit.")]
#[allure_test]
#[test]
fn test_update_backend_wallet_requires_one_yocto() {
    let mut contract = step("Initialize contract without deposit", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Verify update without deposit is rejected", || {
        assert_panic_with(
            || contract.update_backend_wallet(accounts(3)),
            "Requires attached deposit of exactly 1 yoctoNEAR",
        );
    });
}
