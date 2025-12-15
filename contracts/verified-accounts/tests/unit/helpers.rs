//! Shared test helpers for verified-accounts unit tests

use near_crypto::{InMemorySigner, KeyType, SecretKey, Signer};
use near_sdk::{env, test_utils::VMContextBuilder, AccountId};
use verified_accounts::{NearSignatureData, SelfProofData, ZkProof};

/// Create a test context with the given predecessor account
pub fn get_context(predecessor: AccountId) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder.predecessor_account_id(predecessor);
    builder
}

/// Helper function to assert that a closure panics with an expected message.
/// This allows using #[allure_test] with panic tests.
pub fn assert_panic_with<F: FnOnce()>(f: F, expected: &str) {
    use std::panic::{catch_unwind, AssertUnwindSafe};
    let result = catch_unwind(AssertUnwindSafe(f));
    match result {
        Ok(_) => panic!("Expected panic with '{}' but no panic occurred", expected),
        Err(err) => {
            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                format!("{:?}", err)
            };
            assert!(
                msg.contains(expected),
                "Panic message '{}' does not contain expected '{}'",
                msg,
                expected
            );
        }
    }
}

/// Create test Self proof data
pub fn test_self_proof() -> SelfProofData {
    SelfProofData {
        proof: ZkProof {
            a: ["1".to_string(), "2".to_string()],
            b: [
                ["3".to_string(), "4".to_string()],
                ["5".to_string(), "6".to_string()],
            ],
            c: ["7".to_string(), "8".to_string()],
        },
        public_signals: vec!["0".to_string(); 21],
    }
}

/// Helper to create signature data for boundary tests
pub fn create_test_sig_data(user: AccountId) -> verified_accounts::NearSignatureData {
    let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
    verified_accounts::NearSignatureData {
        account_id: user.clone(),
        signature: vec![0; 64],
        public_key: public_key_str.parse().unwrap(),
        challenge: "Identify myself".to_string(),
        nonce: vec![0; 32],
        recipient: user,
    }
}

/// Helper to create proof with custom public signals
pub fn test_self_proof_with_signals(signals: Vec<String>) -> SelfProofData {
    SelfProofData {
        proof: ZkProof {
            a: ["1".to_string(), "2".to_string()],
            b: [
                ["3".to_string(), "4".to_string()],
                ["5".to_string(), "6".to_string()],
            ],
            c: ["7".to_string(), "8".to_string()],
        },
        public_signals: signals,
    }
}

/// Create an in-memory ED25519 signer for a given account (convenience for signature tests)
pub fn create_signer(account_id: &AccountId) -> Signer {
    InMemorySigner::from_secret_key(account_id.clone(), SecretKey::from_random(KeyType::ED25519))
}

/// Produce a valid NEP-413 signature payload for the provided signer/account
pub fn create_valid_signature(
    signer: &Signer,
    signer_id: &AccountId,
    challenge: &str,
    nonce: &[u8],
    recipient: &AccountId,
) -> NearSignatureData {
    // Step 1: Serialize the NEP-413 prefix tag (2^31 + 413)
    let tag: u32 = 2_147_484_061;
    let mut full_message = tag.to_le_bytes().to_vec();

    // Step 2: Create valid NEP-413 payload
    let mut nonce_array = [0u8; 32];
    nonce_array.copy_from_slice(nonce);

    let payload = verified_accounts::Nep413Payload {
        message: challenge.to_string(),
        nonce: nonce_array,
        recipient: recipient.to_string(),
        callback_url: None,
    };
    let payload_bytes = near_sdk::borsh::to_vec(&payload).unwrap();

    // Step 3: Concatenate tag + payload
    full_message.extend_from_slice(&payload_bytes);

    // Step 4: SHA-256 hash
    let message_hash = env::sha256(&full_message);

    // Step 5: Sign the hash
    let signature = signer.sign(&message_hash);
    let signature_bytes = match signature {
        near_crypto::Signature::ED25519(sig) => sig.to_bytes().to_vec(),
        _ => panic!("Only ED25519 signatures are supported in tests"),
    };

    // Step 6: Return NearSignatureData used by contract
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
