//! Store verification tests for verified-accounts contract
//!
//! Happy path tests with real cryptographic signatures

use super::helpers::{
    assert_panic_with, create_signer, create_valid_signature, get_context, test_self_proof,
};
use allure_rs::bdd;
use allure_rs::prelude::*;
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::testing_env;
use verified_accounts::{Contract, VerifiedAccount};

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

            let contract = Contract::new(backend);
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
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    });

    bdd::then("account is verified with correct state and events", || {
        assert!(contract.is_account_verified(user.clone()));
        assert_eq!(contract.get_verified_count(), 1);

        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected verification event");
        assert!(
            logs.iter().any(|l| l.contains("EVENT_JSON")),
            "Expected JSON event"
        );
        assert!(
            logs.iter().any(|l| l.contains("verification_stored")),
            "Expected verification_stored event"
        );

        let account = contract.get_account(user.clone()).unwrap();
        assert_eq!(account.near_account_id, user);
        assert_eq!(account.nullifier, "test_nullifier");
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "replay-protection")]
#[allure_description("Verifies signature replay protection rejects storing the same signature twice.")]
#[allure_test]
#[test]
fn test_signature_replay_rejected() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let signer = create_signer(&user);
    let nonce = vec![1u8; 32];
    let sig_data = create_valid_signature(&signer, &user, "Identify myself", &nonce, &user);

    // First store succeeds
    contract.store_verification(
        "nullifier_one".to_string(),
        user.clone(),
        "user1".to_string(),
        "1".to_string(),
        sig_data,
        test_self_proof(),
        "ctx".to_string(),
    );
    assert!(contract.is_account_verified(user.clone()));

    // Second attempt with the same signature should be rejected
    assert_panic_with(
        || {
            let replay_sig = create_valid_signature(
                &signer,
                &user,
                "Identify myself",
                &nonce,
                &user,
            );
            contract.store_verification(
                "nullifier_two".to_string(),
                user.clone(),
                "user1".to_string(),
                "1".to_string(),
                replay_sig,
                test_self_proof(),
                "ctx".to_string(),
            );
        },
        "Signature already used - potential replay attack",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "timestamp")]
#[allure_description("Verifies that verified_at matches the block timestamp when the verification was stored.")]
#[allure_test]
#[test]
fn test_verification_timestamp_matches_block_time() {
    let backend = accounts(1);
    let user = accounts(2);
    let mut context = get_context(backend.clone());
    let expected_ts = 123_456_789u64;
    context.block_timestamp(expected_ts);
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let signer = create_signer(&user);
    let sig_data =
        create_valid_signature(&signer, &user, "Identify myself", &[13; 32], &user);

    contract.store_verification(
        "timestamp_nullifier".to_string(),
        user.clone(),
        "ts_user".to_string(),
        "1".to_string(),
        sig_data,
        test_self_proof(),
        "ctx".to_string(),
    );

    let account: VerifiedAccount = contract.get_account_with_proof(user.clone()).unwrap();
    assert_eq!(account.verified_at, expected_ts);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("normal")]
#[allure_tags("unit", "replay-protection")]
#[allure_description("Alias test to mirror the integration test plan naming for replay attack prevention.")]
#[allure_test]
#[test]
fn test_replay_attack_same_signature_rejected() {
    test_signature_replay_rejected();
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
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

    // First verified account
    let user_a = accounts(2);
    let signer_a = create_signer(&user_a);
    let sig_a = create_valid_signature(&signer_a, &user_a, "Identify myself", &[0; 32], &user_a);
    contract.store_verification(
        "shared_nullifier".to_string(),
        user_a,
        "userA".to_string(),
        "1".to_string(),
        sig_a,
        test_self_proof(),
        "ctx".to_string(),
    );

    // Second attempt with same nullifier but new account/signature should fail
    let user_b = accounts(3);
    let signer_b = create_signer(&user_b);
    let sig_b = create_valid_signature(
        &signer_b,
        &user_b,
        "Identify myself",
        &[2; 32],
        &user_b,
    );
    assert_panic_with(
        || {
            contract.store_verification(
                "shared_nullifier".to_string(),
                user_b,
                "userB".to_string(),
                "1".to_string(),
                sig_b,
                test_self_proof(),
                "ctx".to_string(),
            );
        },
        "Nullifier already used - passport already registered",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "duplicate-account")]
#[allure_description("Verifies the same NEAR account cannot be verified twice even with new signatures/nullifiers.")]
#[allure_test]
#[test]
fn test_double_verification_rejected() {
    let backend = accounts(1);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let user = accounts(2);
    let signer = create_signer(&user);

    let sig_one = create_valid_signature(&signer, &user, "Identify myself", &[3; 32], &user);
    contract.store_verification(
        "n1".to_string(),
        user.clone(),
        "user1".to_string(),
        "1".to_string(),
        sig_one,
        test_self_proof(),
        "ctx".to_string(),
    );

    let sig_two = create_valid_signature(&signer, &user, "Identify myself", &[4; 32], &user);
    assert_panic_with(
        || {
            contract.store_verification(
                "n2".to_string(),
                user.clone(),
                "user1".to_string(),
                "1".to_string(),
                sig_two,
                test_self_proof(),
                "ctx".to_string(),
            );
        },
        "NEAR account already verified",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "storage", "economics")]
#[allure_description("Verifies insufficient contract balance is rejected before persisting verification.")]
#[allure_test]
#[test]
fn test_insufficient_balance_rejected() {
    let backend = accounts(1);
    let user = accounts(2);
    let mut context = get_context(backend.clone());
    // Set balance far below the estimated storage cost
    context.account_balance(near_sdk::NearToken::from_yoctonear(1));
    testing_env!(context.build());

    let mut contract = Contract::new(backend);
    let signer = create_signer(&user);
    let sig = create_valid_signature(&signer, &user, "Identify myself", &[5; 32], &user);

    assert_panic_with(
        || {
            contract.store_verification(
                "low_balance".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig,
                test_self_proof(),
                "ctx".to_string(),
            );
        },
        "Insufficient contract balance for storage",
    );
}
