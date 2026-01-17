//! Shared test helpers for verified-accounts unit tests

use near_crypto::{InMemorySigner, KeyType, SecretKey, Signer};
use near_sdk::json_types::Base64VecU8;
use near_sdk::serde::de::DeserializeOwned;
use near_sdk::serde::Deserialize;
use near_sdk::{env, test_utils::accounts, test_utils::VMContextBuilder, AccountId};
use verified_accounts::{NearSignatureData, SelfProofData, ZkProof};

// Re-export event structs from the contract for test use
pub use verified_accounts::{
    BackendWalletUpdatedEvent, ContractPausedEvent, ContractUnpausedEvent, VerificationStoredEvent,
};

/// Create a test context with the given predecessor account
/// Includes 1 yoctoNEAR attached deposit by default for payable functions
pub fn get_context(predecessor: AccountId) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder.current_account_id(accounts(0));
    builder.predecessor_account_id(predecessor);
    builder.attached_deposit(near_sdk::NearToken::from_yoctonear(1));
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
        signature: Base64VecU8::from(vec![0; 64]),
        public_key: public_key_str.parse().unwrap(),
        challenge: "Identify myself".to_string(),
        nonce: Base64VecU8::from(vec![0; 32]),
        recipient: env::current_account_id(),
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
        signature: Base64VecU8::from(signature_bytes),
        public_key: public_key_str.parse().unwrap(),
        challenge: challenge.to_string(),
        nonce: Base64VecU8::from(nonce.to_vec()),
        recipient: recipient.clone(),
    }
}

// ==================== EVENT PARSING HELPERS ====================

/// NEP-297 event wrapper structure
#[derive(Debug, Clone, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct EventWrapper<T> {
    pub standard: String,
    pub version: String,
    pub event: String,
    pub data: T,
}

/// Parse an event of type T from the log lines.
/// Searches for EVENT_JSON logs and deserializes the event data.
///
/// # Arguments
/// * `logs` - The log lines from `get_logs()`
/// * `event_name` - The name of the event to find (e.g., "verification_stored")
///
/// # Returns
/// The parsed event data if found, None otherwise
pub fn parse_event<T: DeserializeOwned>(logs: &[String], event_name: &str) -> Option<T> {
    for log in logs {
        if let Some(json_str) = log.strip_prefix("EVENT_JSON:") {
            if let Ok(wrapper) = near_sdk::serde_json::from_str::<EventWrapper<T>>(json_str) {
                if wrapper.event == event_name {
                    return Some(wrapper.data);
                }
            }
        }
    }
    None
}

/// Parse all events of type T from the log lines.
/// Useful when multiple events of the same type may be emitted.
pub fn parse_all_events<T: DeserializeOwned>(logs: &[String], event_name: &str) -> Vec<T> {
    let mut events = Vec::new();
    for log in logs {
        if let Some(json_str) = log.strip_prefix("EVENT_JSON:") {
            if let Ok(wrapper) = near_sdk::serde_json::from_str::<EventWrapper<T>>(json_str) {
                if wrapper.event == event_name {
                    events.push(wrapper.data);
                }
            }
        }
    }
    events
}
