//! Signature verification tests for verified-accounts contract

use super::helpers::{
    assert_panic_with, create_signer, create_valid_signature, get_context, test_self_proof,
};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{NearSignatureData, VersionedContract};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "signature")]
#[allure_description(
    "Verifies that invalid NEAR signatures are rejected during NEP-413 verification."
)]
#[allure_test]
#[test]
fn test_invalid_signature() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Attempt verification with invalid signature bytes", || {
        assert_panic_with(
            || {
                let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
                let sig_data = NearSignatureData {
                    account_id: user.clone(),
                    signature: vec![0; 64],
                    public_key: public_key_str.parse().unwrap(),
                    challenge: "Identify myself".to_string(),
                    nonce: vec![0; 32],
                    recipient: accounts(0),
                };

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    1,
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Invalid NEAR signature - NEP-413 verification failed",
        );
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 16-byte nonce", || {
        assert_panic_with(
            || {
                let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
                let sig_data = NearSignatureData {
                    account_id: user.clone(),
                    signature: vec![0; 64],
                    public_key: public_key_str.parse().unwrap(),
                    challenge: "test".to_string(),
                    nonce: vec![0; 16],
                    recipient: accounts(0),
                };

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    1,
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Nonce must be exactly 32 bytes",
        );
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 32-byte signature", || {
        assert_panic_with(
            || {
                let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
                let sig_data = NearSignatureData {
                    account_id: user.clone(),
                    signature: vec![0; 32],
                    public_key: public_key_str.parse().unwrap(),
                    challenge: "test".to_string(),
                    nonce: vec![0; 32],
                    recipient: accounts(0),
                };

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    1,
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Signature must be 64 bytes",
        );
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 33-byte nonce", || {
        assert_panic_with(
            || {
                let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
                let sig_data = NearSignatureData {
                    account_id: user.clone(),
                    signature: vec![0; 64],
                    public_key: public_key_str.parse().unwrap(),
                    challenge: "test".to_string(),
                    nonce: vec![0; 33],
                    recipient: accounts(0),
                };

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    1,
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Nonce must be exactly 32 bytes",
        );
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 65-byte signature", || {
        assert_panic_with(
            || {
                let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
                let sig_data = NearSignatureData {
                    account_id: user.clone(),
                    signature: vec![0; 65],
                    public_key: public_key_str.parse().unwrap(),
                    challenge: "test".to_string(),
                    nonce: vec![0; 32],
                    recipient: accounts(0),
                };

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    1,
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Signature must be 64 bytes",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "signature")]
#[allure_description(
    "Verifies signatures signed by a different key than the declared account are rejected."
)]
#[allure_test]
#[test]
fn test_signature_from_different_key_rejected() {
    let (mut contract, user, other) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let other = accounts(3);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user, other)
    });

    step(
        "Create signature with other's key but user's public key",
        || {
            let signer_other = create_signer(&other);
            let mut sig_data =
                create_valid_signature(&signer_other, &user, "Identify myself", &[9; 32], &accounts(0));
            let user_pk = create_signer(&user).public_key();
            sig_data.public_key = user_pk.to_string().parse().unwrap();

            assert_panic_with(
                || {
                    contract.store_verification(
                        "nullifier_wrong_key".to_string(),
                        user.clone(),
                        1,
                        sig_data,
                        test_self_proof(),
                        "ctx".to_string(),
                    );
                },
                "Invalid NEAR signature - NEP-413 verification failed",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "signature", "nonce")]
#[allure_description("Verifies that changing the nonce after signing invalidates the signature.")]
#[allure_test]
#[test]
fn test_signature_wrong_nonce_rejected() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Create valid signature then tamper nonce", || {
        let signer = create_signer(&user);
        let mut sig_data =
            create_valid_signature(&signer, &user, "Identify myself", &[10; 32], &accounts(0));
        sig_data.nonce = vec![42u8; 32];

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier_wrong_nonce".to_string(),
                    user.clone(),
                    1,
                    sig_data,
                    test_self_proof(),
                    "ctx".to_string(),
                );
            },
            "Invalid NEAR signature - NEP-413 verification failed",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "signature", "recipient")]
#[allure_description(
    "Verifies that changing the recipient after signing invalidates the signature."
)]
#[allure_test]
#[test]
fn test_signature_wrong_recipient_rejected() {
    let (mut contract, user, other) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let other = accounts(3);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user, other)
    });

    step("Create valid signature then tamper recipient", || {
        let signer = create_signer(&user);
        let mut sig_data =
            create_valid_signature(&signer, &user, "Identify myself", &[11; 32], &accounts(0));
        sig_data.recipient = other.clone();

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier_wrong_recipient".to_string(),
                    user.clone(),
                    1,
                    sig_data,
                    test_self_proof(),
                    "ctx".to_string(),
                );
            },
            "Signature recipient must match contract account",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Signature Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "signature", "challenge")]
#[allure_description(
    "Verifies that changing the challenge after signing invalidates the signature."
)]
#[allure_test]
#[test]
fn test_signature_wrong_challenge_rejected() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Create valid signature then tamper challenge", || {
        let signer = create_signer(&user);
        let mut sig_data =
            create_valid_signature(&signer, &user, "Identify myself", &[12; 32], &accounts(0));
        sig_data.challenge = "Different message".to_string();

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier_wrong_challenge".to_string(),
                    user.clone(),
                    1,
                    sig_data,
                    test_self_proof(),
                    "ctx".to_string(),
                );
            },
            "Invalid NEAR signature - NEP-413 verification failed",
        );
    });
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
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        (contract, user)
    });

    step("Create valid signature then flip a byte", || {
        let signer = create_signer(&user);
        let mut sig_data =
            create_valid_signature(&signer, &user, "Identify myself", &[7; 32], &accounts(0));
        sig_data.signature[0] ^= 0xFF;

        assert_panic_with(
            || {
                contract.store_verification(
                    "tampered".to_string(),
                    user,
                    1,
                    sig_data,
                    test_self_proof(),
                    "ctx".to_string(),
                );
            },
            "Invalid NEAR signature - NEP-413 verification failed",
        );
    });
}
