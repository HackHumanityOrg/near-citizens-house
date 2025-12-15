//! Signature verification tests for verified-accounts contract

use super::helpers::{
    assert_panic_with, create_signer, create_valid_signature, get_context, test_self_proof,
};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "signature")]
#[allure_description("Verifies that invalid NEAR signatures are rejected during NEP-413 verification.")]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "nonce")]
#[allure_description("Verifies that nonces shorter than 32 bytes are rejected.")]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "signature")]
#[allure_description("Verifies that signatures shorter than 64 bytes are rejected.")]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "nonce", "boundary")]
#[allure_description("Verifies that nonces longer than 32 bytes are rejected.")]
#[allure_test]
#[test]
fn test_nonce_too_long() {
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
                nonce: vec![0; 33], // Too long - should be exactly 32 bytes
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "signature", "boundary")]
#[allure_description("Verifies that signatures longer than 64 bytes are rejected.")]
#[allure_test]
#[test]
fn test_signature_too_long() {
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
                signature: vec![0; 65], // Too long - should be exactly 64 bytes
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "signature")]
#[allure_description("Verifies that a tampered signature fails NEP-413 verification.")]
#[allure_test]
#[test]
fn test_invalid_signature_contents() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

    // Create a valid signature, then tamper with it
    let signer = create_signer(&user);
    let mut sig_data =
        create_valid_signature(&signer, &user, "Identify myself", &[7; 32], &user);
    sig_data.signature[0] ^= 0xFF; // flip a byte to invalidate signature

    assert_panic_with(
        || {
            contract.store_verification(
                "tampered".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "ctx".to_string(),
            );
        },
        "Invalid NEAR signature - NEP-413 verification failed",
    );
}
