//! Stress tests for verified-accounts contract
//!
//! Verify behavior at maximum capacity

use allure_rs::prelude::*;
use verified_accounts::{SelfProofData, ZkProof};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Stress Tests")]
#[allure_severity("normal")]
#[allure_tags("unit", "stress", "serialization")]
#[allure_description("Verifies that ZK proof with maximum-size components serializes and deserializes correctly without errors.")]
#[allure_test]
#[test]
fn test_stress_max_payload_proof_serialization() {
    // Create proof with max-size components (80 chars each, 21 signals)
    let max_signal = "x".repeat(80);
    let proof = SelfProofData {
        proof: ZkProof {
            a: ["x".repeat(80), "y".repeat(80)],
            b: [
                ["a".repeat(80), "b".repeat(80)],
                ["c".repeat(80), "d".repeat(80)],
            ],
            c: ["e".repeat(80), "f".repeat(80)],
        },
        public_signals: vec![max_signal; 21],
    };

    // Verify total size is at expected maximum
    assert_eq!(proof.public_signals.len(), 21);
    assert_eq!(proof.public_signals[0].len(), 80);
    assert_eq!(proof.proof.a[0].len(), 80);

    // Should serialize/deserialize without issues
    let json = near_sdk::serde_json::to_string(&proof).unwrap();
    let decoded: SelfProofData = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.public_signals.len(), 21);
}
