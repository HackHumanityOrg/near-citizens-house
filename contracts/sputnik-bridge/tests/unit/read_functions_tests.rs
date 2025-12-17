//! Read functions tests for sputnik-bridge contract

use super::helpers::get_context;
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("unit", "query", "view")]
#[allure_description("Verifies get_info returns correct contract configuration information.")]
#[allure_test]
#[test]
fn test_get_info() {
    let contract = step("Initialize contract", || {
        let context = get_context(accounts(0));
        testing_env!(context.build());
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    let info = step("Call get_info()", || {
        contract.get_info()
    });

    step("Verify backend_wallet in info", || {
        assert_eq!(info.backend_wallet, accounts(0));
    });

    step("Verify sputnik_dao in info", || {
        assert_eq!(info.sputnik_dao, accounts(1));
    });

    step("Verify verified_accounts_contract in info", || {
        assert_eq!(info.verified_accounts_contract, accounts(2));
    });

    step("Verify citizen_role in info", || {
        assert_eq!(info.citizen_role, "citizen");
    });
}
