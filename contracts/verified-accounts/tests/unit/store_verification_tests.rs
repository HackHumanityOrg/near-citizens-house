//! Store verification tests for verified-accounts contract
//!
//! Happy path tests with real cryptographic signatures

use super::helpers::{get_context, test_self_proof};
use allure_rs::prelude::*;
use near_crypto::{InMemorySigner, KeyType, SecretKey, Signer};
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::testing_env;
use near_sdk::{env, AccountId};
use verified_accounts::{Contract, NearSignatureData, Nep413Payload};

/// Helper to create a valid signature for a given message
fn create_valid_signature(
    signer: &Signer,
    signer_id: &AccountId,
    challenge: &str,
    nonce: &[u8],
    recipient: &AccountId,
) -> NearSignatureData {
    // Step 1: Serialize the NEP-413 prefix tag (2^31 + 413)
    let tag: u32 = 2147484061;
    let tag_bytes = tag.to_le_bytes().to_vec();

    // Step 2: Create valid NEP-413 payload
    let mut nonce_array = [0u8; 32];
    nonce_array.copy_from_slice(nonce);

    let payload = Nep413Payload {
        message: challenge.to_string(),
        nonce: nonce_array,
        recipient: recipient.to_string(),
        callback_url: None,
    };

    let payload_bytes = near_sdk::borsh::to_vec(&payload).unwrap();

    // Step 3: Concatenate tag + payload
    let mut full_message = tag_bytes;
    full_message.extend_from_slice(&payload_bytes);

    // Step 4: SHA-256 hash
    let message_hash = env::sha256(&full_message);

    // Step 5: Sign the hash
    let signature = signer.sign(&message_hash);

    // Extract bytes from signature enum using pattern matching
    let signature_bytes = match signature {
        near_crypto::Signature::ED25519(sig) => sig.to_bytes().to_vec(),
        _ => panic!("Only ED25519 signatures are supported in tests"),
    };

    // Convert to our data structure
    let public_key_str = signer.public_key().to_string();

    NearSignatureData {
        account_id: signer_id.clone(),
        signature: signature_bytes,
        public_key: public_key_str.parse().unwrap(),
        challenge: challenge.to_string(),
        nonce: nonce.to_vec(),
        recipient: recipient.clone(),
    }
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Store Verification")]
#[allure_severity("critical")]
#[allure_tags("unit", "happy-path", "integration")]
#[allure_test]
#[test]
fn test_happy_path_store_verification() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

    // create a signer for the user (using near-crypto)
    let signer =
        InMemorySigner::from_secret_key(user.clone(), SecretKey::from_random(KeyType::ED25519));

    let challenge = "Identify myself";
    let nonce = vec![0u8; 32];
    let sig_data = create_valid_signature(&signer, &user, challenge, &nonce, &user);

    // Should succeed without panic
    contract.store_verification(
        "test_nullifier".to_string(),
        user.clone(),
        "user1".to_string(),
        "1".to_string(),
        sig_data,
        test_self_proof(),
        "test_user_context_data".to_string(),
    );

    // Verify state changes
    assert!(contract.is_account_verified(user.clone()));
    assert_eq!(contract.get_verified_count(), 1);

    // Verify events
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
}
