//! Composability interface tests for verified-accounts contract

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::Contract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "composability")]
#[allure_description("Verifies that the contract returns the correct interface version string.")]
#[allure_test]
#[test]
fn test_interface_version() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Verify interface version returns expected value", || {
        assert_eq!(contract.interface_version(), "1.0.0");
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "query")]
#[allure_description("Verifies that get_account returns None for non-existent accounts.")]
#[allure_test]
#[test]
fn test_get_account_empty() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Query non-existent account and verify None returned", || {
        let info = contract.get_account(accounts(2));
        assert!(info.is_none());
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "batch")]
#[allure_description("Verifies that batch verification returns false for all non-verified accounts.")]
#[allure_test]
#[test]
fn test_are_accounts_verified_empty() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Batch check verification status for non-verified accounts", || {
        let results = contract.are_accounts_verified(vec![accounts(2), accounts(3), accounts(4)]);
        assert_eq!(results.len(), 3);
        assert!(!results[0]);
        assert!(!results[1]);
        assert!(!results[2]);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "batch")]
#[allure_description("Verifies that batch get_accounts returns None for all non-existent accounts.")]
#[allure_test]
#[test]
fn test_get_accounts_empty() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Batch get accounts and verify all return None", || {
        let results = contract.get_accounts(vec![accounts(2), accounts(3), accounts(4)]);
        assert_eq!(results.len(), 3);
        assert!(results[0].is_none());
        assert!(results[1].is_none());
        assert!(results[2].is_none());
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Composability Interface")]
#[allure_severity("minor")]
#[allure_tags("unit", "interface", "edge-case")]
#[allure_description("Verifies that batch verification handles empty input array correctly.")]
#[allure_test]
#[test]
fn test_are_accounts_verified_empty_input() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Call are_accounts_verified with empty array", || {
        let results = contract.are_accounts_verified(vec![]);
        assert!(results.is_empty());
    });
}
