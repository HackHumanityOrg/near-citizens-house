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
    let (contract, backend) = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend.clone());
        (contract, backend)
    });

    step("Verify get_backend_wallet returns correct value", || {
        assert_eq!(contract.get_backend_wallet(), backend);
    });

    step("Verify get_verified_count returns zero", || {
        assert_eq!(contract.get_verified_count(), 0);
    });

    step("Verify is_account_verified returns false for unknown account", || {
        assert!(!contract.is_account_verified(accounts(2)));
    });

    step("Verify get_account_with_proof returns None for unknown account", || {
        assert!(contract.get_account_with_proof(accounts(2)).is_none());
    });

    step("Verify get_verified_accounts returns empty list", || {
        let accounts_list = contract.get_verified_accounts(0, 10);
        assert_eq!(accounts_list.len(), 0);
    });
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
    let mut contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Store first verified account", || {
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
    });

    step("Store second verified account", || {
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
    });

    step("Verify count is 2", || {
        assert_eq!(contract.get_verified_count(), 2);
    });

    step("Test pagination returns correct slices", || {
        let first_page = contract.get_verified_accounts(0, 1);
        assert_eq!(first_page.len(), 1);
        let second_page = contract.get_verified_accounts(1, 10);
        assert_eq!(second_page.len(), 1);
        let capped = contract.get_verified_accounts(0, 200);
        assert_eq!(capped.len(), 2);
        let empty_page = contract.get_verified_accounts(5, 10);
        assert!(empty_page.is_empty());
    });

    step("Test batch verification returns correct flags", || {
        let statuses = contract.are_accounts_verified(vec![accounts(2), accounts(3), accounts(4)]);
        assert_eq!(statuses, vec![true, true, false]);
    });

    step("Test batch get_accounts returns Some/None correctly", || {
        let accounts_data = contract.get_accounts(vec![accounts(2), accounts(4)]);
        assert!(accounts_data[0].is_some());
        assert!(accounts_data[1].is_none());
    });
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
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    step("Call get_verified_accounts with limit > 100 on empty data", || {
        let accounts_list = contract.get_verified_accounts(0, 200);
        assert_eq!(accounts_list.len(), 0);
    });
}
