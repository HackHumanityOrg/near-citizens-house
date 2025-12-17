//! Input validation tests for verified-accounts contract

use super::helpers::{
    assert_panic_with, create_signer, create_valid_signature, get_context, test_self_proof,
};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "security")]
#[allure_description("Verifies that store_verification rejects when signature account_id doesn't match near_account_id parameter.")]
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
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Signature account ID must match near_account_id",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "security")]
#[allure_description("Verifies that store_verification rejects when signature recipient doesn't match near_account_id parameter.")]
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
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Signature recipient must match near_account_id",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "batch-size")]
#[allure_description("Verifies that are_accounts_verified rejects batch queries exceeding maximum size of 100 accounts.")]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "batch-size")]
#[allure_description("Verifies that get_accounts rejects batch queries exceeding maximum size of 100 accounts.")]
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

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "nullifier")]
#[allure_description("Verifies that store_verification rejects nullifier strings exceeding 80 character maximum length.")]
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
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Nullifier exceeds maximum length of 80",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "attestation-id")]
#[allure_description("Verifies that store_verification rejects attestation_id strings exceeding 1 character maximum length.")]
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
                too_long_attestation_id,
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Attestation ID exceeds maximum length of 1",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "user-context-data")]
#[allure_description("Verifies that store_verification rejects user_context_data strings exceeding 4096 character maximum length.")]
#[allure_test]
#[test]
fn test_user_context_data_too_long() {
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

            // Create user_context_data that exceeds the 4096 character limit
            let too_long_user_context = "x".repeat(4097);

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "1".to_string(),
                sig_data,
                test_self_proof(),
                too_long_user_context,
            );
        },
        "User context data exceeds maximum length of 4096",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "nullifier", "boundary")]
#[allure_description("Verifies that a nullifier exactly 80 characters long is accepted.")]
#[allure_test]
#[test]
fn test_nullifier_max_length_allowed() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let signer = create_signer(&user);
    let sig_data =
        create_valid_signature(&signer, &user, "Identify myself", &[2; 32], &user);

    contract.store_verification(
        "n".repeat(80),
        user.clone(),
        "9".to_string(),
        sig_data,
        test_self_proof(),
        "ctx".to_string(),
    );

    assert!(contract.is_account_verified(user));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "attestation-id", "boundary")]
#[allure_description("Verifies that a single-character attestation_id is accepted.")]
#[allure_test]
#[test]
fn test_attestation_id_single_char_allowed() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let signer = create_signer(&user);
    let sig_data =
        create_valid_signature(&signer, &user, "Identify myself", &[4; 32], &user);

    contract.store_verification(
        "nullifier_attestation".to_string(),
        user.clone(),
        "Z".to_string(),
        sig_data,
        test_self_proof(),
        "ctx".to_string(),
    );

    assert!(contract.is_account_verified(user));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "context", "boundary")]
#[allure_description("Verifies that user_context_data at the 4096 character limit is accepted.")]
#[allure_test]
#[test]
fn test_user_context_data_max_length_allowed() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let signer = create_signer(&user);
    let sig_data =
        create_valid_signature(&signer, &user, "Identify myself", &[5; 32], &user);

    let context_data = "c".repeat(4096);

    contract.store_verification(
        "nullifier_context".to_string(),
        user.clone(),
        "1".to_string(),
        sig_data,
        test_self_proof(),
        context_data.clone(),
    );

    let account = contract.get_account(user.clone()).unwrap();
    assert_eq!(account.attestation_id, "1");
    assert_eq!(account.near_account_id, user);
    assert_eq!(account.nullifier, "nullifier_context");
    assert_eq!(contract.get_verified_count(), 1);
}
