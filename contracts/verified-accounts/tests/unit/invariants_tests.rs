//! Invariant tests for verified-accounts contract
//!
//! Per OpenZeppelin best practices: verify system-wide invariants

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use near_sdk::NearToken;
use verified_accounts::Contract;

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant")]
#[allure_test]
#[test]
fn test_invariant_backend_wallet_always_valid() {
    // Invariant: backend_wallet should never be empty after initialization
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend.clone());

    // Backend wallet should never be empty
    assert!(!contract.get_backend_wallet().as_str().is_empty());
    assert_eq!(contract.get_backend_wallet(), backend);
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant")]
#[allure_test]
#[test]
fn test_invariant_verified_count_starts_at_zero() {
    // Invariant: new contract should have zero verified accounts
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    assert_eq!(contract.get_verified_count(), 0);
    assert!(contract.get_verified_accounts(0, 100).is_empty());
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant")]
#[allure_test]
#[test]
fn test_invariant_paused_state_consistent() {
    // Invariant: is_paused should reflect actual state after pause/unpause
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());
    assert!(!contract.is_paused(), "Should start unpaused");

    // Pause
    let mut pause_context = get_context(backend.clone());
    pause_context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(pause_context.build());
    contract.pause();
    assert!(contract.is_paused(), "Should be paused after pause()");

    // Unpause
    let mut unpause_context = get_context(backend);
    unpause_context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(unpause_context.build());
    contract.unpause();
    assert!(!contract.is_paused(), "Should be unpaused after unpause()");
}
