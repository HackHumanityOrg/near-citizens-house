//! Serialization tests for verified-accounts-interface types

use allure_rs::prelude::*;
use verified_accounts_interface::*;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json", "borsh")]
#[allure_test]
#[test]
fn test_verified_account_info_serialization() {
    let info = VerifiedAccountInfo {
        nullifier: "nullifier123".to_string(),
        near_account_id: "test.near".parse().unwrap(),
        user_id: "user123".to_string(),
        attestation_id: "attestation123".to_string(),
        verified_at: 1234567890,
    };

    // Test JSON serialization
    let json = near_sdk::serde_json::to_string(&info).unwrap();
    assert!(json.contains("nullifier123"));
    assert!(json.contains("test.near"));

    // Test Borsh serialization
    let borsh = near_sdk::borsh::to_vec(&info).unwrap();
    let decoded: VerifiedAccountInfo = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.near_account_id, info.near_account_id);
    assert_eq!(decoded.nullifier, info.nullifier);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "borsh")]
#[allure_test]
#[test]
fn test_verified_account_serialization() {
    let account = VerifiedAccount {
        nullifier: "nullifier123".to_string(),
        near_account_id: "test.near".parse().unwrap(),
        user_id: "user123".to_string(),
        attestation_id: "attestation123".to_string(),
        verified_at: 1234567890,
        self_proof: SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: vec!["signal1".to_string(), "signal2".to_string()],
        },
        user_context_data: "context".to_string(),
    };

    // Test Borsh serialization
    let borsh = near_sdk::borsh::to_vec(&account).unwrap();
    let decoded: VerifiedAccount = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.near_account_id, account.near_account_id);
    assert_eq!(decoded.nullifier, account.nullifier);
    assert_eq!(decoded.self_proof.public_signals.len(), 2);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json")]
#[allure_test]
#[test]
fn test_zk_proof_json_roundtrip() {
    let proof = ZkProof {
        a: [
            "12345678901234567890".to_string(),
            "98765432109876543210".to_string(),
        ],
        b: [
            [
                "11111111111111111111".to_string(),
                "22222222222222222222".to_string(),
            ],
            [
                "33333333333333333333".to_string(),
                "44444444444444444444".to_string(),
            ],
        ],
        c: [
            "55555555555555555555".to_string(),
            "66666666666666666666".to_string(),
        ],
    };

    // Test JSON roundtrip
    let json = near_sdk::serde_json::to_string(&proof).unwrap();
    let decoded: ZkProof = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.a, proof.a);
    assert_eq!(decoded.b, proof.b);
    assert_eq!(decoded.c, proof.c);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "borsh")]
#[allure_test]
#[test]
fn test_zk_proof_borsh_roundtrip() {
    let proof = ZkProof {
        a: ["a_point_x".to_string(), "a_point_y".to_string()],
        b: [
            ["b0_x".to_string(), "b0_y".to_string()],
            ["b1_x".to_string(), "b1_y".to_string()],
        ],
        c: ["c_point_x".to_string(), "c_point_y".to_string()],
    };

    let borsh = near_sdk::borsh::to_vec(&proof).unwrap();
    let decoded: ZkProof = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.a, proof.a);
    assert_eq!(decoded.b, proof.b);
    assert_eq!(decoded.c, proof.c);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json")]
#[allure_test]
#[test]
fn test_self_proof_data_json_roundtrip() {
    let proof_data = SelfProofData {
        proof: ZkProof {
            a: ["1".to_string(), "2".to_string()],
            b: [
                ["3".to_string(), "4".to_string()],
                ["5".to_string(), "6".to_string()],
            ],
            c: ["7".to_string(), "8".to_string()],
        },
        public_signals: vec![
            "nullifier".to_string(),
            "merkle_root".to_string(),
            "scope".to_string(),
        ],
    };

    let json = near_sdk::serde_json::to_string(&proof_data).unwrap();
    let decoded: SelfProofData = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.public_signals.len(), 3);
    assert_eq!(decoded.public_signals[0], "nullifier");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json")]
#[allure_test]
#[test]
fn test_verified_account_info_json_roundtrip() {
    let info = VerifiedAccountInfo {
        nullifier: "123456789012345678901234567890".to_string(),
        near_account_id: "alice.testnet".parse().unwrap(),
        user_id: "user_abc".to_string(),
        attestation_id: "1".to_string(),
        verified_at: 1700000000000000000, // Realistic nanosecond timestamp
    };

    let json = near_sdk::serde_json::to_string(&info).unwrap();
    let decoded: VerifiedAccountInfo = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.nullifier, info.nullifier);
    assert_eq!(decoded.near_account_id, info.near_account_id);
    assert_eq!(decoded.verified_at, info.verified_at);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "serialization", "passport")]
#[allure_description(
    "Tests serialization with realistic 21 public signals from passport proofs"
)]
#[allure_test]
#[test]
fn test_verified_account_with_21_signals() {
    // Test with realistic 21 public signals (passport proofs)
    let account = VerifiedAccount {
        nullifier: "nullifier".to_string(),
        near_account_id: "user.near".parse().unwrap(),
        user_id: "user_id".to_string(),
        attestation_id: "1".to_string(),
        verified_at: 0,
        self_proof: SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: (0..21).map(|i| format!("signal_{}", i)).collect(),
        },
        user_context_data: "".to_string(),
    };

    // Verify serialization works with full 21 signals
    let borsh = near_sdk::borsh::to_vec(&account).unwrap();
    let decoded: VerifiedAccount = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.self_proof.public_signals.len(), 21);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("minor")]
#[allure_tags("unit", "serialization", "edge-case")]
#[allure_test]
#[test]
fn test_empty_public_signals() {
    let proof_data = SelfProofData {
        proof: ZkProof {
            a: ["0".to_string(), "0".to_string()],
            b: [
                ["0".to_string(), "0".to_string()],
                ["0".to_string(), "0".to_string()],
            ],
            c: ["0".to_string(), "0".to_string()],
        },
        public_signals: vec![], // Empty signals
    };

    let json = near_sdk::serde_json::to_string(&proof_data).unwrap();
    let decoded: SelfProofData = near_sdk::serde_json::from_str(&json).unwrap();
    assert!(decoded.public_signals.is_empty());
}
