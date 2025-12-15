//! Pause/Unpause tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context, test_self_proof};
use allure_rs::prelude::*;
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::testing_env;
use near_sdk::NearToken;
use verified_accounts::{Contract, NearSignatureData};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("unit", "admin", "pause")]
#[allure_description("Verifies that backend wallet can pause and unpause the contract, emitting proper events.")]
#[allure_test]
#[test]
fn test_pause_unpause() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());

    // Initially not paused
    assert!(!contract.is_paused());

    // Pause (requires 1 yocto)
    let mut context = get_context(backend.clone());
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());
    contract.pause();
    assert!(contract.is_paused());

    let logs = get_logs();
    assert!(!logs.is_empty(), "Expected pause event");
    assert!(
        logs.iter().any(|l| l.contains("EVENT_JSON")),
        "Expected JSON event"
    );
    assert!(
        logs.iter().any(|l| l.contains("contract_paused")),
        "Expected contract_paused event"
    );

    // Unpause (requires 1 yocto)
    let mut context = get_context(backend);
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());
    contract.unpause();
    assert!(!contract.is_paused());

    let logs = get_logs();
    assert!(!logs.is_empty(), "Expected unpause event");
    assert!(
        logs.iter().any(|l| l.contains("EVENT_JSON")),
        "Expected JSON event"
    );
    assert!(
        logs.iter().any(|l| l.contains("contract_unpaused")),
        "Expected contract_unpaused event"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description("Verifies that only the backend wallet can pause the contract and unauthorized accounts are rejected.")]
#[allure_test]
#[test]
fn test_unauthorized_pause() {
    let backend = accounts(1);
    let unauthorized = accounts(0);
    let mut context = get_context(unauthorized);
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    assert_panic_with(
        || contract.pause(),
        "Only backend wallet can pause contract",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_description("Verifies that only the backend wallet can unpause the contract and unauthorized accounts are rejected.")]
#[allure_test]
#[test]
fn test_unauthorized_unpause() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());

    // Pause (requires 1 yocto)
    let mut context = get_context(backend);
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());
    contract.pause();

    // Change context to unauthorized user (with 1 yocto to pass deposit check)
    let mut unauthorized_context = get_context(accounts(0));
    unauthorized_context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(unauthorized_context.build());

    assert_panic_with(
        || contract.unpause(),
        "Only backend wallet can unpause contract",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Pause/Unpause")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "pause")]
#[allure_description("Verifies that storing verifications is blocked when the contract is paused.")]
#[allure_test]
#[test]
fn test_store_verification_when_paused() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend.clone());

    // Pause (requires 1 yocto)
    let mut context = get_context(backend);
    context.attached_deposit(NearToken::from_yoctonear(1));
    testing_env!(context.build());
    contract.pause();

    assert_panic_with(
        || {
            let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
            let sig_data = NearSignatureData {
                account_id: user.clone(),
                signature: vec![0; 64],
                public_key: public_key_str.parse().unwrap(),
                challenge: "Identify myself".to_string(),
                nonce: vec![0; 32],
                recipient: user.clone(),
            };

            // Should panic because contract is paused (before signature verification)
            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Contract is paused - no new verifications allowed",
    );
}
