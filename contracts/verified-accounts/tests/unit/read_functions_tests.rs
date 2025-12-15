//! Read functions tests for verified-accounts contract

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::Contract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("unit", "query", "view")]
#[allure_test]
#[test]
fn test_read_functions() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend.clone());

    // Test backend wallet getter
    assert_eq!(contract.get_backend_wallet(), backend);

    // Test count
    assert_eq!(contract.get_verified_count(), 0);

    // Test account verification check
    assert!(!contract.is_account_verified(accounts(2)));

    // Test get verified account
    assert!(contract.get_account_with_proof(accounts(2)).is_none());

    // Test pagination with empty data
    let accounts_list = contract.get_verified_accounts(0, 10);
    assert_eq!(accounts_list.len(), 0);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("minor")]
#[allure_tags("unit", "pagination", "edge-case")]
#[allure_test]
#[test]
fn test_pagination_with_large_limit_on_empty() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Test pagination with a limit larger than max (100) on empty data
    // Note: This only verifies the function doesn't panic with large limit values.
    // The actual limit capping (max 100) is enforced in get_verified_accounts
    // but cannot be verified without 100+ verified accounts.
    let accounts_list = contract.get_verified_accounts(0, 200);
    assert_eq!(accounts_list.len(), 0);
}
