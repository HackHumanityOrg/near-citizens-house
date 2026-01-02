//! Invariant tests for verified-accounts contract
//!
//! Per OpenZeppelin best practices: verify system-wide invariants

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use near_sdk::NearToken;
use verified_accounts::Contract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant")]
#[allure_description(
    "Verifies that backend_wallet is always valid and non-empty after contract initialization."
)]
#[allure_test]
#[test]
fn test_invariant_backend_wallet_always_valid() {
    let (contract, backend) = step("Initialize contract with backend wallet", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend.clone());
        (contract, backend)
    });

    step("Verify backend wallet is not empty", || {
        assert!(!contract.get_backend_wallet().as_str().is_empty());
    });

    step("Verify backend wallet matches initialization value", || {
        assert_eq!(contract.get_backend_wallet(), backend);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant")]
#[allure_description(
    "Verifies that newly initialized contract starts with zero verified accounts."
)]
#[allure_test]
#[test]
fn test_invariant_verified_count_starts_at_zero() {
    let contract = step("Initialize new contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Verify count is zero", || {
        assert_eq!(contract.get_verified_count(), 0);
    });

    step("Verify get_verified_accounts returns empty list", || {
        assert!(contract.get_verified_accounts(0, 100).is_empty());
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Invariants")]
#[allure_severity("critical")]
#[allure_tags("unit", "invariant")]
#[allure_description("Verifies that is_paused() correctly reflects the actual contract state after pause and unpause operations.")]
#[allure_test]
#[test]
fn test_invariant_paused_state_consistent() {
    let (mut contract, backend) = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend.clone());
        (contract, backend)
    });

    step("Verify contract starts unpaused", || {
        assert!(!contract.is_paused(), "Should start unpaused");
    });

    step("Pause contract and verify state", || {
        let mut pause_context = get_context(backend.clone());
        pause_context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(pause_context.build());
        contract.pause();
        assert!(contract.is_paused(), "Should be paused after pause()");
    });

    step("Unpause contract and verify state", || {
        let mut unpause_context = get_context(backend);
        unpause_context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(unpause_context.build());
        contract.unpause();
        assert!(!contract.is_paused(), "Should be unpaused after unpause()");
    });
}
