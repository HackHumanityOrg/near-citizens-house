//! Read functions tests for verified-accounts contract

use super::helpers::{
    create_signer, create_valid_signature, get_context, test_self_proof,
};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::Contract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("unit", "query", "view")]
#[allure_description("Verifies all read-only view functions return correct values for empty contract state.")]
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
#[allure_severity("normal")]
#[allure_tags("unit", "query", "pagination", "batch")]
#[allure_description("Verifies pagination and batch queries return correct data when contract has verified accounts.")]
#[allure_test]
#[test]
fn test_read_functions_with_verified_accounts() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());

    // Insert two verified accounts
    let user_a = accounts(2);
    let signer_a = create_signer(&user_a);
    let sig_a = create_valid_signature(&signer_a, &user_a, "Identify myself", &[9; 32], &user_a);
    contract.store_verification(
        "nullifier_a".to_string(),
        user_a,
        "1".to_string(),
        sig_a,
        test_self_proof(),
        "ctx".to_string(),
    );

    let user_b = accounts(3);
    let signer_b = create_signer(&user_b);
    let sig_b = create_valid_signature(&signer_b, &user_b, "Identify myself", &[10; 32], &user_b);
    contract.store_verification(
        "nullifier_b".to_string(),
        user_b,
        "1".to_string(),
        sig_b,
        test_self_proof(),
        "ctx".to_string(),
    );

    assert_eq!(contract.get_verified_count(), 2);

    // Pagination should return slices without panicking
    let first_page = contract.get_verified_accounts(0, 1);
    assert_eq!(first_page.len(), 1);
    let second_page = contract.get_verified_accounts(1, 10);
    assert_eq!(second_page.len(), 1);
    // Limit should cap at 100 even if requested higher
    let capped = contract.get_verified_accounts(0, 200);
    assert_eq!(capped.len(), 2);
    // From index beyond length returns empty
    let empty_page = contract.get_verified_accounts(5, 10);
    assert!(empty_page.is_empty());

    // Batch verification flags should align with stored accounts
    let statuses =
        contract.are_accounts_verified(vec![accounts(2), accounts(3), accounts(4)]);
    assert_eq!(statuses, vec![true, true, false]);

    // Batch account retrieval returns Some/None as expected
    let accounts_data = contract.get_accounts(vec![accounts(2), accounts(4)]);
    assert!(accounts_data[0].is_some());
    assert!(accounts_data[1].is_none());
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("minor")]
#[allure_tags("unit", "pagination", "edge-case")]
#[allure_description("Verifies that pagination handles large limit values gracefully on empty data without panicking.")]
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
