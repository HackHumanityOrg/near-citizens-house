//! Signature verification tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context, test_self_proof};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData};

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "signature")]
#[allure_test]
#[test]
fn test_invalid_signature() {
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
        "Invalid NEAR signature - NEP-413 verification failed",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "nonce")]
#[allure_test]
#[test]
fn test_invalid_nonce_length() {
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
                challenge: "test".to_string(),
                nonce: vec![0; 16],
                recipient: user.clone(),
            };

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
        "Nonce must be exactly 32 bytes",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "signature")]
#[allure_test]
#[test]
fn test_invalid_signature_length() {
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
                signature: vec![0; 32],
                public_key: public_key_str.parse().unwrap(),
                challenge: "test".to_string(),
                nonce: vec![0; 32],
                recipient: user.clone(),
            };

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
        "Signature must be 64 bytes",
    );
}
