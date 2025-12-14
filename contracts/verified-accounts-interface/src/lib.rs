//! # Verified Accounts Interface
//!
//! This crate provides a typed interface for making cross-contract calls to the
//! NEAR verified accounts oracle contract. Other NEAR contracts can add this as
//! a dependency to get type-safe cross-contract calls.
//!
//! ## Usage Example
//!
//! ```rust,ignore
//! use near_sdk::{env, near, AccountId, Promise, Gas, PromiseResult};
//! use verified_accounts_interface::ext_verified_accounts;
//!
//! #[near(contract_state)]
//! pub struct MyContract {
//!     verification_contract: AccountId,
//! }
//!
//! #[near]
//! impl MyContract {
//!     pub fn do_verified_action(&mut self) -> Promise {
//!         ext_verified_accounts::ext(self.verification_contract.clone())
//!             .with_static_gas(Gas::from_tgas(5))
//!             .is_account_verified(env::predecessor_account_id())
//!             .then(
//!                 Self::ext(env::current_account_id())
//!                     .with_static_gas(Gas::from_tgas(10))
//!                     .callback_verified_action()
//!             )
//!     }
//!
//!     #[private]
//!     pub fn callback_verified_action(&mut self) {
//!         let is_verified: bool = match env::promise_result(0) {
//!             PromiseResult::Successful(data) => {
//!                 // NEAR cross-contract calls use JSON serialization by default
//!                 near_sdk::serde_json::from_slice(&data).unwrap_or(false)
//!             }
//!             _ => false,
//!         };
//!         assert!(is_verified, "Account must be verified");
//!         // Proceed with action...
//!     }
//! }
//! ```

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{ext_contract, AccountId, NearSchema};

// ==================== Data Types ====================

/// Groth16 ZK proof structure (a, b, c points)
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct ZkProof {
    pub a: [String; 2],
    pub b: [[String; 2]; 2],
    pub c: [String; 2],
}

/// Self.xyz proof data (ZK proof + public signals)
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct SelfProofData {
    /// Groth16 ZK proof (a, b, c points)
    pub proof: ZkProof,
    /// Public signals from the circuit (contains nullifier, merkle root, scope, etc.)
    pub public_signals: Vec<String>,
}

/// Standard verification info (no proof data).
///
/// This is the most commonly used return type for cross-contract calls.
/// It includes all essential verification data without the large ZK proof,
/// keeping gas costs low.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerifiedAccountInfo {
    /// Unique nullifier from the ZK proof (prevents duplicate passport use)
    pub nullifier: String,
    /// The NEAR account that was verified
    pub near_account_id: AccountId,
    /// User identifier from the identity provider
    pub user_id: String,
    /// Attestation ID from the identity provider
    pub attestation_id: String,
    /// Unix timestamp (nanoseconds) when verification was recorded
    pub verified_at: u64,
}

/// Full verification record including ZK proof.
///
/// Only use this when you need the actual proof data for re-verification.
/// Most cross-contract calls should use `get_account()` instead to save gas.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerifiedAccount {
    /// Unique nullifier from the ZK proof (prevents duplicate passport use)
    pub nullifier: String,
    /// The NEAR account that was verified
    pub near_account_id: AccountId,
    /// User identifier from the identity provider
    pub user_id: String,
    /// Attestation ID from the identity provider
    pub attestation_id: String,
    /// Unix timestamp (nanoseconds) when verification was recorded
    pub verified_at: u64,
    /// Self.xyz ZK proof data (for re-verification)
    pub self_proof: SelfProofData,
    /// Additional context data from verification flow
    pub user_context_data: String,
}

// ==================== Interface Trait ====================

/// Interface for cross-contract calls to the verified-accounts contract.
///
/// This trait is processed by the `#[ext_contract]` macro to generate
/// the `ext_verified_accounts` module with cross-contract call builders.
///
/// ## Important: Serialization Format
///
/// **NEAR cross-contract calls use JSON serialization by default**.
/// When handling promise results in callbacks, you should use:
/// ```ignore
/// near_sdk::serde_json::from_slice(&data)
/// ```
/// The types in this crate derive both `Serialize`/`Deserialize` (for JSON)
/// and `BorshSerialize`/`BorshDeserialize` (for storage) to support both.
///
/// ## Gas Recommendations
///
/// | Method | Recommended Gas |
/// |--------|-----------------|
/// | `is_account_verified` | 5 TGas |
/// | `get_account` | 8 TGas |
/// | `get_account_with_proof` | 15 TGas |
/// | `are_accounts_verified(10)` | 8 TGas |
/// | `get_accounts(10)` | 12 TGas |
/// | Callback overhead | 5 TGas |
#[ext_contract(ext_verified_accounts)]
pub trait VerifiedAccounts {
    // ==================== Single Account Queries ====================

    /// Check if an account is verified (simple boolean).
    ///
    /// **Use this for:** Gate checks, access control, DAO voting eligibility.
    /// This is the most gas-efficient method.
    fn is_account_verified(&self, near_account_id: AccountId) -> bool;

    /// Get account verification info (without ZK proof).
    ///
    /// **Use this for:** Most cross-contract calls that need verification details.
    /// Returns all essential data (nullifier, user_id, attestation_id, timestamp)
    /// without the large ZK proof, keeping gas costs low.
    ///
    /// Returns `None` if the account is not verified.
    fn get_account(&self, near_account_id: AccountId) -> Option<VerifiedAccountInfo>;

    /// Get full account data including ZK proof.
    ///
    /// **Use this for:** Re-verification, audit trails, proof validation.
    /// This is the most expensive method due to large proof data (~500 bytes).
    ///
    /// Returns `None` if the account is not verified.
    fn get_account_with_proof(&self, near_account_id: AccountId) -> Option<VerifiedAccount>;

    // ==================== Batch Queries (for DAO voting, etc.) ====================

    /// Check multiple accounts in one call.
    ///
    /// Returns `Vec<bool>` in the same order as the input `account_ids`.
    /// More gas-efficient than multiple individual calls.
    ///
    /// **Use this for:** Batch eligibility checks in DAO voting.
    ///
    /// Note: Large batches may exceed gas limits. Recommended max: 100 accounts.
    fn are_accounts_verified(&self, account_ids: Vec<AccountId>) -> Vec<bool>;

    /// Get verification info for multiple accounts (without ZK proofs).
    ///
    /// Returns `Vec<Option<VerifiedAccountInfo>>` in the same order as input.
    /// Each element is `None` if that account is not verified.
    ///
    /// **Use this for:** Batch queries that need verification details.
    ///
    /// Note: Large batches may exceed gas limits. Recommended max: 100 accounts.
    fn get_accounts(&self, account_ids: Vec<AccountId>) -> Vec<Option<VerifiedAccountInfo>>;

    // ==================== Metadata ====================

    /// Get total number of verified accounts.
    fn get_verified_count(&self) -> u64;

    /// Get interface version for compatibility checking.
    ///
    /// Returns a semver string like "1.0.0".
    fn interface_version(&self) -> String;

    /// Check if contract is paused.
    ///
    /// When paused, no new verifications can be stored, but reads still work.
    fn is_paused(&self) -> bool;
}

#[cfg(test)]
#[allure_rs::allure_suite("Verified Accounts Interface")]
mod tests {
    use super::*;
    use allure_rs::prelude::*;

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("VerifiedAccountInfo Type")]
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("VerifiedAccount Type")]
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

    // ==================== ADDITIONAL TYPE SERIALIZATION TESTS (Phase 3) ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("ZkProof Type")]
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("ZkProof Type")]
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("SelfProofData Type")]
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("VerifiedAccountInfo Type")]
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("SelfProofData Type")]
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("SelfProofData Type")]
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

    // ==================== NEGATIVE DESERIALIZATION TESTS ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_verified_account_info_json_missing_nullifier_fails() {
        // JSON without required "nullifier" field should fail deserialization
        let json =
            r#"{"near_account_id":"test.near","user_id":"u","attestation_id":"1","verified_at":0}"#;
        let result: Result<VerifiedAccountInfo, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail when nullifier is missing"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_zk_proof_json_invalid_a_array_length_fails() {
        // 'a' should have exactly 2 elements, not 1
        let json = r#"{"a":["1"],"b":[["1","2"],["3","4"]],"c":["1","2"]}"#;
        let result: Result<ZkProof, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail when 'a' has wrong array length"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_self_proof_data_invalid_proof_type_fails() {
        // 'proof' should be an object, not a string
        let json = r#"{"proof":"not_an_object","public_signals":[]}"#;
        let result: Result<SelfProofData, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail when 'proof' is not an object"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Verified Accounts Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_zk_proof_json_missing_b_field_fails() {
        // Missing 'b' field should fail
        let json = r#"{"a":["1","2"],"c":["1","2"]}"#;
        let result: Result<ZkProof, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail when 'b' field is missing"
        );
    }
}
