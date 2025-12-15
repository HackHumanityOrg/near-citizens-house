//! Composability interface tests for verified-accounts contract

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::Contract;

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "composability")]
#[allure_test]
#[test]
fn test_interface_version() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);
    assert_eq!(contract.interface_version(), "1.0.0");
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "query")]
#[allure_test]
#[test]
fn test_get_account_empty() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Should return None for non-existent account
    let info = contract.get_account(accounts(2));
    assert!(info.is_none());
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "batch")]
#[allure_test]
#[test]
fn test_are_accounts_verified_empty() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Batch check with empty contract
    let results = contract.are_accounts_verified(vec![accounts(2), accounts(3), accounts(4)]);
    assert_eq!(results.len(), 3);
    assert!(!results[0]);
    assert!(!results[1]);
    assert!(!results[2]);
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Composability Interface")]
#[allure_severity("normal")]
#[allure_tags("unit", "interface", "batch")]
#[allure_test]
#[test]
fn test_get_accounts_empty() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Batch status check with empty contract
    let results = contract.get_accounts(vec![accounts(2), accounts(3), accounts(4)]);
    assert_eq!(results.len(), 3);
    assert!(results[0].is_none());
    assert!(results[1].is_none());
    assert!(results[2].is_none());
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Composability Interface")]
#[allure_severity("minor")]
#[allure_tags("unit", "interface", "edge-case")]
#[allure_test]
#[test]
fn test_are_accounts_verified_empty_input() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Empty input should return empty result
    let results = contract.are_accounts_verified(vec![]);
    assert!(results.is_empty());
}
