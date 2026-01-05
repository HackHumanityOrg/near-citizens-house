//! Store verification tests for verified-accounts contract
//!
//! Happy path tests with real cryptographic signatures

use super::helpers::{
    assert_panic_with, create_signer, create_valid_signature, get_context, parse_event,
    test_self_proof, VerificationStoredEvent,
};
use allure_rs::bdd;
use allure_rs::prelude::*;
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::testing_env;
use verified_accounts::{Verification, VersionedContract};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "happy-path", "integration")]
#[allure_description(r#"
## Purpose
Verifies the complete happy path for storing a verified account with real ED25519 cryptographic signatures.

## Preconditions
- Backend wallet is configured as contract owner
- User has a valid ED25519 keypair
- NEP-413 signature is properly formatted and valid

## Expected Behavior
1. Verification is stored without panic
2. Account is marked as verified
3. Verified count increments to 1
4. `verification_stored` event is emitted with correct JSON format
5. Account data is retrievable with correct nullifier
"#)]
#[allure_test]
#[test]
fn test_happy_path_store_verification() {
    let (mut contract, user, sig_data) =
        bdd::given("contract initialized with valid user signature", || {
            let backend = accounts(1);
            let user = accounts(2);
            let context = get_context(backend.clone());
            testing_env!(context.build());

            let contract = VersionedContract::new(backend);
            let signer = create_signer(&user);

            let challenge = "Identify myself";
            let nonce = vec![0u8; 32];
            let sig_data = create_valid_signature(&signer, &user, challenge, &nonce, &user);

            (contract, user, sig_data)
        });

    bdd::when("storing the verification with valid proof", || {
        contract.store_verification(
            "test_nullifier".to_string(),
            user.clone(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    });

    bdd::then("account is verified with correct state and events", || {
        assert!(contract.is_verified(user.clone()));
        assert_eq!(contract.get_verified_count(), 1);

        // Parse and validate the verification_stored event
        let logs = get_logs();
        let event: VerificationStoredEvent =
            parse_event(&logs, "verification_stored").expect("verification_stored event not found");

        // Validate event data matches inputs
        assert_eq!(
            event.near_account_id,
            user.to_string(),
            "Event near_account_id should match stored account"
        );
        assert_eq!(
            event.nullifier, "test_nullifier",
            "Event nullifier should match input"
        );
        assert_eq!(
            event.attestation_id, "1",
            "Event attestation_id should match input"
        );

        // Verify account data is also correct
        let account = contract.get_verification(user.clone()).unwrap();
        assert_eq!(account.near_account_id, user);
        assert_eq!(account.nullifier, "test_nullifier");
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "timestamp")]
#[allure_description(
    "Verifies that verified_at matches the block timestamp when the verification was stored."
)]
#[allure_test]
#[test]
fn test_verification_timestamp_matches_block_time() {
    let (mut contract, user, sig_data, expected_ts) =
        step("Initialize contract with specific block timestamp", || {
            let backend = accounts(1);
            let user = accounts(2);
            let mut context = get_context(backend.clone());
            let expected_ts = 123_456_789u64;
            context.block_timestamp(expected_ts);
            testing_env!(context.build());
            let contract = VersionedContract::new(backend);
            let signer = create_signer(&user);
            let sig_data =
                create_valid_signature(&signer, &user, "Identify myself", &[13; 32], &user);
            (contract, user, sig_data, expected_ts)
        });

    step("Store verification", || {
        contract.store_verification(
            "timestamp_nullifier".to_string(),
            user.clone(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "ctx".to_string(),
        );
    });

    step("Verify timestamp matches block time", || {
        let verification: Verification = contract.get_full_verification(user.clone()).unwrap();
        assert_eq!(verification.verified_at, expected_ts);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "nullifier-dedup")]
#[allure_description("Verifies duplicate nullifiers are rejected even for different accounts.")]
#[allure_test]
#[test]
fn test_nullifier_reuse_rejected() {
    let mut contract = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        VersionedContract::new(backend)
    });

    step("Store first verification with nullifier", || {
        let user_a = accounts(2);
        let signer_a = create_signer(&user_a);
        let sig_a =
            create_valid_signature(&signer_a, &user_a, "Identify myself", &[0; 32], &user_a);
        contract.store_verification(
            "shared_nullifier".to_string(),
            user_a,
            "1".to_string(),
            sig_a,
            test_self_proof(),
            "ctx".to_string(),
        );
    });

    step("Attempt to reuse nullifier with different account", || {
        let user_b = accounts(3);
        let signer_b = create_signer(&user_b);
        let sig_b =
            create_valid_signature(&signer_b, &user_b, "Identify myself", &[2; 32], &user_b);
        assert_panic_with(
            || {
                contract.store_verification(
                    "shared_nullifier".to_string(),
                    user_b,
                    "1".to_string(),
                    sig_b,
                    test_self_proof(),
                    "ctx".to_string(),
                );
            },
            "Nullifier already used - passport already registered",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "duplicate-account")]
#[allure_description(
    "Verifies the same NEAR account cannot be verified twice even with new signatures/nullifiers."
)]
#[allure_test]
#[test]
fn test_double_verification_rejected() {
    let (mut contract, user, signer) = step("Initialize contract", || {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        let user = accounts(2);
        let signer = create_signer(&user);
        (contract, user, signer)
    });

    step("Store first verification for user", || {
        let sig_one = create_valid_signature(&signer, &user, "Identify myself", &[3; 32], &user);
        contract.store_verification(
            "n1".to_string(),
            user.clone(),
            "1".to_string(),
            sig_one,
            test_self_proof(),
            "ctx".to_string(),
        );
    });

    step("Attempt second verification for same user", || {
        let sig_two = create_valid_signature(&signer, &user, "Identify myself", &[4; 32], &user);
        assert_panic_with(
            || {
                contract.store_verification(
                    "n2".to_string(),
                    user.clone(),
                    "1".to_string(),
                    sig_two,
                    test_self_proof(),
                    "ctx".to_string(),
                );
            },
            "NEAR account already verified",
        );
    });
}
