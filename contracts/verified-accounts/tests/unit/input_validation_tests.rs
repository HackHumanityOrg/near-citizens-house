//! Input validation tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context, test_self_proof};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData};

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "security")]
#[allure_test]
#[test]
fn test_account_id_mismatch() {
    let backend = accounts(1);
    let user = accounts(2);
    let different_user = accounts(3);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

    assert_panic_with(
        || {
            let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
            let sig_data = NearSignatureData {
                account_id: different_user, // Mismatch: signature is for accounts(3)
                signature: vec![0; 64],
                public_key: public_key_str.parse().unwrap(),
                challenge: "Identify myself".to_string(),
                nonce: vec![0; 32],
                recipient: user.clone(),
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user, // But we're trying to verify accounts(2)
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Signature account ID must match near_account_id",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "security")]
#[allure_test]
#[test]
fn test_recipient_mismatch() {
    let backend = accounts(1);
    let user = accounts(2);
    let different_recipient = accounts(3);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

    assert_panic_with(
        || {
            let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
            let sig_data = NearSignatureData {
                account_id: user.clone(),
                signature: vec![0; 64],
                public_key: public_key_str.parse().unwrap(),
                challenge: "Identify myself".to_string(),
                nonce: vec![0; 32],
                recipient: different_recipient, // Mismatch: recipient is accounts(3)
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user, // But we're trying to verify accounts(2)
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Signature recipient must match near_account_id",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "batch-size")]
#[allure_test]
#[test]
fn test_batch_size_exceeded_are_accounts_verified() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Create 101 accounts to exceed the limit
    let too_many_accounts: Vec<near_sdk::AccountId> = (0..101)
        .map(|i| format!("account{}.near", i).parse().unwrap())
        .collect();

    assert_panic_with(
        || {
            contract.are_accounts_verified(too_many_accounts);
        },
        "Batch size exceeds maximum of 100 accounts",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "batch-size")]
#[allure_test]
#[test]
fn test_batch_size_exceeded_get_accounts() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let contract = Contract::new(backend);

    // Create 101 accounts to exceed the limit
    let too_many_accounts: Vec<near_sdk::AccountId> = (0..101)
        .map(|i| format!("account{}.near", i).parse().unwrap())
        .collect();

    assert_panic_with(
        || {
            contract.get_accounts(too_many_accounts);
        },
        "Batch size exceeds maximum of 100 accounts",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "nullifier")]
#[allure_test]
#[test]
fn test_nullifier_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create a nullifier that exceeds the 80 character limit
            let too_long_nullifier = "x".repeat(81);

            contract.store_verification(
                too_long_nullifier,
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Nullifier exceeds maximum length of 80",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "user-id")]
#[allure_test]
#[test]
fn test_user_id_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create a user_id that exceeds the 80 character limit
            let too_long_user_id = "x".repeat(81);

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                too_long_user_id,
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "User ID exceeds maximum length of 80",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "attestation-id")]
#[allure_test]
#[test]
fn test_attestation_id_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create an attestation_id that exceeds the 1 character limit
            let too_long_attestation_id = "xx".to_string();

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                too_long_attestation_id,
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Attestation ID exceeds maximum length of 1",
    );
}

