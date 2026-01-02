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
    let (mut contract, user, different_user) =
        step("Initialize contract and test accounts", || {
            let backend = accounts(1);
            let user = accounts(2);
            let different_user = accounts(3);
            let context = get_context(backend.clone());
            testing_env!(context.build());
            let contract = Contract::new(backend);
            (contract, user, different_user)
        });

    step("Attempt verification with mismatched account_id", || {
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
    });
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
    let (mut contract, user, different_recipient) =
        step("Initialize contract and test accounts", || {
            let backend = accounts(1);
            let user = accounts(2);
            let different_recipient = accounts(3);
            let context = get_context(backend.clone());
            testing_env!(context.build());
            let contract = Contract::new(backend);
            (contract, user, different_recipient)
        });

    step("Attempt verification with mismatched recipient", || {
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
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "batch-size")]
#[allure_description(
    "Verifies that are_verified rejects batch queries exceeding maximum size of 100 accounts."
)]
#[allure_test]
#[test]
fn test_batch_size_exceeded_are_verified() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    let too_many_accounts = step("Create batch of 101 accounts", || {
        (0..101)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect::<Vec<near_sdk::AccountId>>()
    });

    step("Attempt batch verification exceeding limit", || {
        assert_panic_with(
            || {
                contract.are_verified(too_many_accounts);
            },
            "Batch size exceeds maximum of 100 accounts",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Input Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "batch-size")]
#[allure_description(
    "Verifies that get_verifications rejects batch queries exceeding maximum size of 100 accounts."
)]
#[allure_test]
#[test]
fn test_batch_size_exceeded_get_verifications() {
    let contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        Contract::new(backend)
    });

    let too_many_accounts = step("Create batch of 101 accounts", || {
        (0..101)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect::<Vec<near_sdk::AccountId>>()
    });

    step("Attempt batch get_verifications exceeding limit", || {
        assert_panic_with(
            || {
                contract.get_verifications(too_many_accounts);
            },
            "Batch size exceeds maximum of 100 accounts",
        );
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 81-char nullifier", || {
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
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 2-char attestation_id", || {
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
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step(
        "Attempt verification with 4097-char user_context_data",
        || {
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
        },
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
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        let signer = create_signer(&user);
        let sig_data = create_valid_signature(&signer, &user, "Identify myself", &[2; 32], &user);
        (contract, user, sig_data)
    });

    step("Store verification with 80-char nullifier", || {
        contract.store_verification(
            "n".repeat(80),
            user.clone(),
            "9".to_string(),
            sig_data,
            test_self_proof(),
            "ctx".to_string(),
        );
    });

    step("Verify account is verified", || {
        assert!(contract.is_verified(user));
    });
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
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        let signer = create_signer(&user);
        let sig_data = create_valid_signature(&signer, &user, "Identify myself", &[4; 32], &user);
        (contract, user, sig_data)
    });

    step("Store verification with single-char attestation_id", || {
        contract.store_verification(
            "nullifier_attestation".to_string(),
            user.clone(),
            "Z".to_string(),
            sig_data,
            test_self_proof(),
            "ctx".to_string(),
        );
    });

    step("Verify account is verified", || {
        assert!(contract.is_verified(user));
    });
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
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        let signer = create_signer(&user);
        let sig_data = create_valid_signature(&signer, &user, "Identify myself", &[5; 32], &user);
        (contract, user, sig_data)
    });

    step(
        "Store verification with 4096-char user_context_data",
        || {
            let context_data = "c".repeat(4096);
            contract.store_verification(
                "nullifier_context".to_string(),
                user.clone(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                context_data,
            );
        },
    );

    step("Verify account data is stored correctly", || {
        let verification = contract.get_verification(user.clone()).unwrap();
        assert_eq!(verification.attestation_id, "1");
        assert_eq!(verification.near_account_id, user);
        assert_eq!(verification.nullifier, "nullifier_context");
        assert_eq!(contract.get_verified_count(), 1);
    });
}
