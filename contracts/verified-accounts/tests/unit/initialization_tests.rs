//! Initialization tests for verified-accounts contract

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::Contract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Contract Initialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "initialization")]
#[allure_test]
#[test]
fn test_initialization() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let contract = Contract::new(accounts(1));
    assert_eq!(contract.get_backend_wallet(), accounts(1));
    assert_eq!(contract.get_verified_count(), 0);
}
