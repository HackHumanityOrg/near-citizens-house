//! Proof validation tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData, SelfProofData, ZkProof};

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Proof Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_test]
#[test]
fn test_public_signals_too_many() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create proof with too many public signals (22 instead of max 21)
            let too_many_signals_proof = SelfProofData {
                proof: ZkProof {
                    a: ["1".to_string(), "2".to_string()],
                    b: [
                        ["3".to_string(), "4".to_string()],
                        ["5".to_string(), "6".to_string()],
                    ],
                    c: ["7".to_string(), "8".to_string()],
                },
                public_signals: vec!["0".to_string(); 22],
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                too_many_signals_proof,
                "test_user_context_data".to_string(),
            );
        },
        "Public signals array exceeds maximum length of 21",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_test]
#[test]
fn test_public_signal_item_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create proof with one public signal too long
            let mut signals = vec!["0".to_string(); 20];
            signals.push("x".repeat(81)); // One signal exceeds 80 chars
            let bad_signal_proof = SelfProofData {
                proof: ZkProof {
                    a: ["1".to_string(), "2".to_string()],
                    b: [
                        ["3".to_string(), "4".to_string()],
                        ["5".to_string(), "6".to_string()],
                    ],
                    c: ["7".to_string(), "8".to_string()],
                },
                public_signals: signals,
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                bad_signal_proof,
                "test_user_context_data".to_string(),
            );
        },
        "Public signal string exceeds maximum length of 80",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_test]
#[test]
fn test_proof_component_a_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create proof with 'a' component too long
            let bad_proof = SelfProofData {
                proof: ZkProof {
                    a: ["x".repeat(81), "2".to_string()], // First 'a' component too long
                    b: [
                        ["3".to_string(), "4".to_string()],
                        ["5".to_string(), "6".to_string()],
                    ],
                    c: ["7".to_string(), "8".to_string()],
                },
                public_signals: vec!["0".to_string(); 21],
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                bad_proof,
                "test_user_context_data".to_string(),
            );
        },
        "Proof component 'a' string exceeds maximum length of 80",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_test]
#[test]
fn test_proof_component_b_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create proof with 'b' component too long
            let bad_proof = SelfProofData {
                proof: ZkProof {
                    a: ["1".to_string(), "2".to_string()],
                    b: [
                        ["x".repeat(81), "4".to_string()], // First 'b' component too long
                        ["5".to_string(), "6".to_string()],
                    ],
                    c: ["7".to_string(), "8".to_string()],
                },
                public_signals: vec!["0".to_string(); 21],
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                bad_proof,
                "test_user_context_data".to_string(),
            );
        },
        "Proof component 'b' string exceeds maximum length of 80",
    );
}

#[allure_epic("Smart Contracts")]
#[allure_feature("Verified Accounts Contract")]
#[allure_story("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_test]
#[test]
fn test_proof_component_c_too_long() {
    let backend = accounts(1);
    let user = accounts(2);
    let context = get_context(backend.clone());
    testing_env!(context.build());

    let mut contract = Contract::new(backend);

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

            // Create proof with 'c' component too long
            let bad_proof = SelfProofData {
                proof: ZkProof {
                    a: ["1".to_string(), "2".to_string()],
                    b: [
                        ["3".to_string(), "4".to_string()],
                        ["5".to_string(), "6".to_string()],
                    ],
                    c: ["x".repeat(81), "8".to_string()], // First 'c' component too long
                },
                public_signals: vec!["0".to_string(); 21],
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                user,
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                bad_proof,
                "test_user_context_data".to_string(),
            );
        },
        "Proof component 'c' string exceeds maximum length of 80",
    );
}
