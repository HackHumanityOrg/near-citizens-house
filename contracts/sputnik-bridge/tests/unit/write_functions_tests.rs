//! Happy-path write function tests for sputnik-bridge

use allure_rs::prelude::*;
use near_sdk::mock::MockAction;
use near_sdk::test_utils::{accounts, get_created_receipts, VMContextBuilder};
use near_sdk::testing_env;
use sputnik_bridge::{GAS_FOR_ADD_PROPOSAL, GAS_FOR_VERIFICATION, SputnikBridge};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Write Functions")]
#[allure_severity("critical")]
#[allure_tags("unit", "promise", "write")]
#[allure_description("Verifies add_member schedules verified-accounts check with correct receiver, method, gas and zero deposit.")]
#[allure_test]
#[test]
fn test_add_member_schedules_verification_call() {
    let mut contract = step("Initialize contract with backend wallet", || {
        let mut context = VMContextBuilder::new();
        context.predecessor_account_id(accounts(0));
        testing_env!(context.build());
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Call add_member", || {
        let _ = contract.add_member(accounts(5));
    });

    let receipt = step("Verify receipt was created", || {
        let receipts = get_created_receipts();
        assert!(!receipts.is_empty(), "Expected a receipt to be created");
        receipts[0].clone()
    });

    step("Verify receipt targets verified_accounts_contract", || {
        assert_eq!(
            receipt.receiver_id, accounts(2),
            "Verification call should target verified_accounts_contract"
        );
    });

    step("Verify function call parameters", || {
        let action = receipt
            .actions
            .iter()
            .find_map(|a| match a {
                MockAction::FunctionCallWeight {
                    method_name,
                    args,
                    attached_deposit,
                    prepaid_gas,
                    ..
                } => Some((method_name, args, attached_deposit, prepaid_gas)),
                _ => None,
            })
            .expect("Expected a function call action");

        let (method_name, _args, attached_deposit, prepaid_gas) = action;
        let method = String::from_utf8(method_name.clone()).unwrap();
        assert_eq!(method, "is_account_verified");
        assert_eq!(
            attached_deposit.as_yoctonear(),
            0,
            "Verification check should not attach deposit"
        );
        assert_eq!(
            prepaid_gas.as_gas(),
            GAS_FOR_VERIFICATION.as_gas(),
            "Verification call should reserve GAS_FOR_VERIFICATION"
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Write Functions")]
#[allure_severity("critical")]
#[allure_tags("unit", "promise", "write")]
#[allure_description("Verifies create_proposal schedules add_proposal call with correct target, gas, and trimmed description payload.")]
#[allure_test]
#[test]
fn test_create_proposal_schedules_add_proposal() {
    let mut contract = step("Initialize contract with backend wallet", || {
        let mut context = VMContextBuilder::new();
        context.predecessor_account_id(accounts(0));
        testing_env!(context.build());
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string())
    });

    step("Call create_proposal with padded description", || {
        let _ = contract.create_proposal("  Hello Citizens  ".to_string());
    });

    let receipt = step("Verify receipt was created", || {
        let receipts = get_created_receipts();
        assert!(!receipts.is_empty(), "Expected a receipt to be created");
        receipts[0].clone()
    });

    step("Verify receipt targets sputnik_dao contract", || {
        assert_eq!(
            receipt.receiver_id, accounts(1),
            "add_proposal should target the sputnik_dao contract"
        );
    });

    step("Verify function call parameters and trimmed description", || {
        let action = receipt
            .actions
            .iter()
            .find_map(|a| match a {
                MockAction::FunctionCallWeight {
                    method_name,
                    args,
                    attached_deposit,
                    prepaid_gas,
                    ..
                } => Some((method_name, args, attached_deposit, prepaid_gas)),
                _ => None,
            })
            .expect("Expected a function call action");

        let (method_name, args, attached_deposit, prepaid_gas) = action;
        let method = String::from_utf8(method_name.clone()).unwrap();
        assert_eq!(method, "add_proposal");
        assert_eq!(
            attached_deposit.as_yoctonear(),
            0,
            "create_proposal should forward the caller's attached deposit (default 0)"
        );
        assert_eq!(
            prepaid_gas.as_gas(),
            GAS_FOR_ADD_PROPOSAL.as_gas(),
            "add_proposal call should reserve GAS_FOR_ADD_PROPOSAL"
        );

        let args_str = String::from_utf8(args.clone()).expect("args should be UTF-8 JSON");
        assert!(
            args_str.contains("Hello Citizens"),
            "Expected trimmed description in add_proposal args, got: {}",
            args_str
        );
    });
}
