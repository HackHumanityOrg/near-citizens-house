//! Proof validation tests for verified-accounts contract

use super::helpers::{
    assert_panic_with, create_signer, create_valid_signature, get_context,
    test_self_proof_with_signals,
};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData, SelfProofData, Verification, ZkProof};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_description("Verifies that store_verification rejects ZK proof with public_signals array exceeding maximum length of 21.")]
#[allure_test]
#[test]
fn test_public_signals_too_many() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 22 public signals", || {
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
                    "1".to_string(),
                    sig_data,
                    too_many_signals_proof,
                    "test_user_context_data".to_string(),
                );
            },
            "Public signals array exceeds maximum length of 21",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_description("Verifies that store_verification rejects ZK proof with any public_signal string exceeding 80 character maximum length.")]
#[allure_test]
#[test]
fn test_public_signal_item_too_long() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step("Attempt verification with 81-char public signal", || {
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

                let mut signals = vec!["0".to_string(); 20];
                signals.push("x".repeat(81));
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
                    "1".to_string(),
                    sig_data,
                    bad_signal_proof,
                    "test_user_context_data".to_string(),
                );
            },
            "Public signal string exceeds maximum length of 80",
        );
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_description("Verifies that store_verification rejects ZK proof with 'a' component strings exceeding 80 character maximum length.")]
#[allure_test]
#[test]
fn test_proof_component_a_too_long() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step(
        "Attempt verification with 81-char proof.a component",
        || {
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

                    let bad_proof = SelfProofData {
                        proof: ZkProof {
                            a: ["x".repeat(81), "2".to_string()],
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
                        "1".to_string(),
                        sig_data,
                        bad_proof,
                        "test_user_context_data".to_string(),
                    );
                },
                "Proof component 'a' string exceeds maximum length of 80",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_description("Verifies that store_verification rejects ZK proof with 'b' component strings exceeding 80 character maximum length.")]
#[allure_test]
#[test]
fn test_proof_component_b_too_long() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step(
        "Attempt verification with 81-char proof.b component",
        || {
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

                    let bad_proof = SelfProofData {
                        proof: ZkProof {
                            a: ["1".to_string(), "2".to_string()],
                            b: [
                                ["x".repeat(81), "4".to_string()],
                                ["5".to_string(), "6".to_string()],
                            ],
                            c: ["7".to_string(), "8".to_string()],
                        },
                        public_signals: vec!["0".to_string(); 21],
                    };

                    contract.store_verification(
                        "test_nullifier".to_string(),
                        user,
                        "1".to_string(),
                        sig_data,
                        bad_proof,
                        "test_user_context_data".to_string(),
                    );
                },
                "Proof component 'b' string exceeds maximum length of 80",
            );
        },
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof", "boundary")]
#[allure_description(
    "Verifies that a proof with exactly 21 public signals within the length limit is accepted."
)]
#[allure_test]
#[test]
fn test_public_signals_at_max_length_allowed() {
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        let signer = create_signer(&user);
        let sig_data = create_valid_signature(&signer, &user, "Identify myself", &[6; 32], &user);
        (contract, user, sig_data)
    });

    let proof = step("Create proof with max-length signals", || {
        let signals = vec!["s".repeat(80); 21];
        SelfProofData {
            proof: ZkProof {
                a: ["a".repeat(80), "b".repeat(80)],
                b: [
                    ["c".repeat(80), "d".repeat(80)],
                    ["e".repeat(80), "f".repeat(80)],
                ],
                c: ["g".repeat(80), "h".repeat(80)],
            },
            public_signals: signals,
        }
    });

    step("Store verification with max-length proof", || {
        contract.store_verification(
            "nullifier_proof_ok".to_string(),
            user.clone(),
            "1".to_string(),
            sig_data,
            proof,
            "ctx".to_string(),
        );
    });

    step("Verify account data is stored correctly", || {
        let verification: Verification = contract.get_full_verification(user.clone()).unwrap();
        assert_eq!(verification.near_account_id, user);
        assert_eq!(verification.self_proof.public_signals.len(), 21);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_description("Verifies that proof validation accepts fewer than 21 public signals.")]
#[allure_test]
#[test]
fn test_public_signals_under_max_allowed() {
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        let signer = create_signer(&user);
        let sig_data = create_valid_signature(&signer, &user, "Identify myself", &[7; 32], &user);
        (contract, user, sig_data)
    });

    step("Store verification with only 3 public signals", || {
        let proof =
            test_self_proof_with_signals(vec!["1".to_string(), "2".to_string(), "3".to_string()]);

        contract.store_verification(
            "nullifier_three_signals".to_string(),
            user.clone(),
            "1".to_string(),
            sig_data,
            proof,
            "ctx".to_string(),
        );
    });

    step("Verify proof has 3 public signals", || {
        let verification: Verification = contract.get_full_verification(user.clone()).unwrap();
        assert_eq!(verification.self_proof.public_signals.len(), 3);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof", "boundary")]
#[allure_description(
    "Verifies that proof components exactly at the 80 character limit are accepted."
)]
#[allure_test]
#[test]
fn test_proof_components_at_max_length_allowed() {
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        let signer = create_signer(&user);
        let sig_data = create_valid_signature(&signer, &user, "Identify myself", &[8; 32], &user);
        (contract, user, sig_data)
    });

    step("Store verification with 80-char proof components", || {
        let component = "x".repeat(80);
        let proof = SelfProofData {
            proof: ZkProof {
                a: [component.clone(), component.clone()],
                b: [
                    [component.clone(), component.clone()],
                    [component.clone(), component.clone()],
                ],
                c: [component.clone(), component.clone()],
            },
            public_signals: vec!["ok".to_string(); 2],
        };

        contract.store_verification(
            "nullifier_component_ok".to_string(),
            user.clone(),
            "1".to_string(),
            sig_data,
            proof,
            "ctx".to_string(),
        );
    });

    step("Verify account is verified", || {
        assert!(contract.is_verified(user));
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Proof Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "zk-proof")]
#[allure_description("Verifies that store_verification rejects ZK proof with 'c' component strings exceeding 80 character maximum length.")]
#[allure_test]
#[test]
fn test_proof_component_c_too_long() {
    let (mut contract, user) = step("Initialize contract", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = Contract::new(backend);
        (contract, user)
    });

    step(
        "Attempt verification with 81-char proof.c component",
        || {
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

                    let bad_proof = SelfProofData {
                        proof: ZkProof {
                            a: ["1".to_string(), "2".to_string()],
                            b: [
                                ["3".to_string(), "4".to_string()],
                                ["5".to_string(), "6".to_string()],
                            ],
                            c: ["x".repeat(81), "8".to_string()],
                        },
                        public_signals: vec!["0".to_string(); 21],
                    };

                    contract.store_verification(
                        "test_nullifier".to_string(),
                        user,
                        "1".to_string(),
                        sig_data,
                        bad_proof,
                        "test_user_context_data".to_string(),
                    );
                },
                "Proof component 'c' string exceeds maximum length of 80",
            );
        },
    );
}
