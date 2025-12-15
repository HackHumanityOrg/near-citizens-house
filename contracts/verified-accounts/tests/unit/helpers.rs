//! Shared test helpers for verified-accounts unit tests

use near_sdk::test_utils::VMContextBuilder;
use near_sdk::AccountId;
use verified_accounts::{SelfProofData, ZkProof};

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
