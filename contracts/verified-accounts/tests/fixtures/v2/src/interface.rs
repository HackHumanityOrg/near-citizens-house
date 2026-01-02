//! # Verified Accounts Interface
//!
//! This module provides a typed interface for making cross-contract calls to the
//! NEAR verified accounts oracle contract. Other NEAR contracts can use these types
//! and the generated `ext_verified_accounts` module for type-safe cross-contract calls.
//!
//! ## Versioning
//!
//! This module uses versioned types to support contract upgrades without migrations:
//! - `VersionedVerification` - enum wrapper for verification records stored on-chain
//! - `Verification` - type alias for the current version (currently `VerificationV1`)
//!
//! Old records are automatically upgraded when read (lazy migration).
//!
//! ### Adding New Versions
//!
//! When you need to add fields to verification records:
//! 1. Create a new struct (e.g., `VerificationV2`) with the new fields
//! 2. Append a new variant to `VersionedVerification` (NEVER reorder existing variants)
//! 3. Update `into_current()` to migrate from all older versions
//! 4. Update the `Verification` type alias to point to the new struct
//!
//! ```ignore
//! pub enum VersionedVerification {
//!     V1(VerificationV1),  // 0x00 - original (NEVER REMOVE)
//!     Latest(Verification), // 0x01 - current version
//! }
//! ```
//!
//! ### Borsh Serialization Warning
//!
//! Borsh uses enum discriminants (0x00, 0x01, etc.) based on declaration order.
//! **CRITICAL:** Never reorder, remove, or insert variants - only append at the end.
//!
//! ## Usage Example
//!
//! ```rust,ignore
//! use near_sdk::{env, near, AccountId, Promise, Gas, PromiseResult};
//! use verified_accounts::interface::ext_verified_accounts;
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
//!             .is_verified(env::predecessor_account_id())
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

// ==================== Versioning ====================

/// Versioned verification record for on-chain storage.
///
/// This enum allows the contract to upgrade the verification structure
/// without requiring data migrations. Old records are lazily upgraded
/// when read via `into_current()`.
///
/// ## Borsh Serialization
///
/// Borsh serializes enums with a 1-byte discriminant based on declaration order:
/// - `0x00` = V1 (original format)
///
/// **CRITICAL:** Never reorder, remove, or insert variants - only append at the end.
/// Doing so will corrupt existing on-chain data.
#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub enum VersionedVerification {
    /// V1: Original verification format
    V1(VerificationV1),
    /// V2: Adds nationality_disclosed field
    V2(VerificationV2),
}

/// Current verification version number.
pub const CURRENT_VERIFICATION_VERSION: u8 = 2;

impl VersionedVerification {
    /// Create a new versioned verification using the current version (V2).
    pub fn new(v: Verification) -> Self {
        Self::V2(v)
    }

    /// Convert to current Verification format.
    /// This performs lazy migration from older versions.
    pub fn into_current(self) -> Verification {
        match self {
            Self::V1(v) => VerificationV2 {
                nullifier: v.nullifier,
                near_account_id: v.near_account_id,
                attestation_id: v.attestation_id,
                verified_at: v.verified_at,
                self_proof: v.self_proof,
                user_context_data: v.user_context_data,
                nationality_disclosed: false, // Default for migrated V1 records
            },
            Self::V2(v) => v,
        }
    }

    /// Get a reference as current Verification (cloning if migration needed).
    pub fn as_current(&self) -> Verification {
        match self {
            Self::V1(v) => VerificationV2 {
                nullifier: v.nullifier.clone(),
                near_account_id: v.near_account_id.clone(),
                attestation_id: v.attestation_id.clone(),
                verified_at: v.verified_at,
                self_proof: v.self_proof.clone(),
                user_context_data: v.user_context_data.clone(),
                nationality_disclosed: false,
            },
            Self::V2(v) => v.clone(),
        }
    }

    /// Check if this is the current version (V2).
    pub fn is_current(&self) -> bool {
        matches!(self, Self::V2(_))
    }

    /// Get the version number of this record.
    pub fn version(&self) -> u8 {
        match self {
            Self::V1(_) => 1,
            Self::V2(_) => 2,
        }
    }
}

impl From<Verification> for VersionedVerification {
    fn from(v: Verification) -> Self {
        Self::V2(v)
    }
}

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

/// Lightweight verification summary (no proof data).
///
/// This is the most commonly used return type for cross-contract calls.
/// It includes all essential verification data without the large ZK proof,
/// keeping gas costs low.
///
/// Note: This type is NOT versioned because it's only used for view responses,
/// not for on-chain storage.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerificationSummary {
    /// Unique nullifier from the ZK proof (prevents duplicate passport use)
    pub nullifier: String,
    /// The NEAR account that was verified
    pub near_account_id: AccountId,
    /// Attestation ID from the identity provider
    pub attestation_id: String,
    /// Unix timestamp (nanoseconds) when verification was recorded
    pub verified_at: u64,
}

// ==================== Versioned Verification Types ====================

/// V1: Original verification format.
///
/// This was the first version of the verification structure.
/// Do NOT modify this struct - create new versions instead.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerificationV1 {
    /// Unique nullifier from the ZK proof (prevents duplicate passport use)
    pub nullifier: String,
    /// The NEAR account that was verified
    pub near_account_id: AccountId,
    /// Attestation ID from the identity provider
    pub attestation_id: String,
    /// Unix timestamp (nanoseconds) when verification was recorded
    pub verified_at: u64,
    /// Self.xyz ZK proof data (for re-verification)
    pub self_proof: SelfProofData,
    /// Additional context data from verification flow
    pub user_context_data: String,
}

/// V2: Adds nationality_disclosed field.
///
/// This version adds support for tracking whether nationality was disclosed
/// during verification.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerificationV2 {
    /// Unique nullifier from the ZK proof (prevents duplicate passport use)
    pub nullifier: String,
    /// The NEAR account that was verified
    pub near_account_id: AccountId,
    /// Attestation ID from the identity provider
    pub attestation_id: String,
    /// Unix timestamp (nanoseconds) when verification was recorded
    pub verified_at: u64,
    /// Self.xyz ZK proof data (for re-verification)
    pub self_proof: SelfProofData,
    /// Additional context data from verification flow
    pub user_context_data: String,
    /// Whether nationality was disclosed during verification
    pub nationality_disclosed: bool,
}

/// Type alias for the current verification version (V2).
pub type Verification = VerificationV2;

impl From<&VerificationV1> for VerificationSummary {
    fn from(v: &VerificationV1) -> Self {
        Self {
            nullifier: v.nullifier.clone(),
            near_account_id: v.near_account_id.clone(),
            attestation_id: v.attestation_id.clone(),
            verified_at: v.verified_at,
        }
    }
}

impl From<&VerificationV2> for VerificationSummary {
    fn from(v: &VerificationV2) -> Self {
        Self {
            nullifier: v.nullifier.clone(),
            near_account_id: v.near_account_id.clone(),
            attestation_id: v.attestation_id.clone(),
            verified_at: v.verified_at,
        }
    }
}

impl From<&VersionedVerification> for VerificationSummary {
    fn from(v: &VersionedVerification) -> Self {
        match v {
            VersionedVerification::V1(v) => Self::from(v),
            VersionedVerification::V2(v) => Self::from(v),
        }
    }
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
/// | `is_verified` | 5 TGas |
/// | `get_verification` | 8 TGas |
/// | `get_full_verification` | 15 TGas |
/// | `are_verified(10)` | 8 TGas |
/// | `get_verifications(10)` | 12 TGas |
/// | Callback overhead | 5 TGas |
#[ext_contract(ext_verified_accounts)]
pub trait VerifiedAccountsInterface {
    // ==================== Single Account Queries ====================

    /// Check if an account is verified (simple boolean).
    ///
    /// **Use this for:** Gate checks, access control, DAO voting eligibility.
    /// This is the most gas-efficient method.
    fn is_verified(&self, account_id: AccountId) -> bool;

    /// Get verification summary (without ZK proof).
    ///
    /// **Use this for:** Most cross-contract calls that need verification details.
    /// Returns all essential data (nullifier, attestation_id, timestamp)
    /// without the large ZK proof, keeping gas costs low.
    ///
    /// Returns `None` if the account is not verified.
    fn get_verification(&self, account_id: AccountId) -> Option<VerificationSummary>;

    /// Get full verification record including ZK proof.
    ///
    /// **Use this for:** Re-verification, audit trails, proof validation.
    /// This is the most expensive method due to large proof data (~2.5 KB).
    ///
    /// Returns `None` if the account is not verified.
    fn get_full_verification(&self, account_id: AccountId) -> Option<Verification>;

    // ==================== Batch Queries (for DAO voting, etc.) ====================

    /// Check multiple accounts in one call.
    ///
    /// Returns `Vec<bool>` in the same order as the input `account_ids`.
    /// More gas-efficient than multiple individual calls.
    ///
    /// **Use this for:** Batch eligibility checks in DAO voting.
    ///
    /// Note: Large batches may exceed gas limits. Recommended max: 100 accounts.
    fn are_verified(&self, account_ids: Vec<AccountId>) -> Vec<bool>;

    /// Get verification summaries for multiple accounts (without ZK proofs).
    ///
    /// Returns `Vec<Option<VerificationSummary>>` in the same order as input.
    /// Each element is `None` if that account is not verified.
    ///
    /// **Use this for:** Batch queries that need verification details.
    ///
    /// Note: Large batches may exceed gas limits. Recommended max: 100 accounts.
    fn get_verifications(&self, account_ids: Vec<AccountId>) -> Vec<Option<VerificationSummary>>;

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
