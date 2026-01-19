//! # Verified Accounts Interface (V2 Fixture)
//!
//! Interface and data types used by the upgrade fixture.
//! - `VersionedVerification` wraps stored records; `Verification` aliases the current version.
//! - Append enum variants only; migrate in `into_current()` (Borsh order is binding).
//! - Old records are lazily upgraded on read.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{ext_contract, AccountId, NearSchema};

// ==================== Versioning ====================

/// Versioned verification record for on-chain storage.
///
/// Append-only enum; old records migrate in `into_current()`.
/// Never reorder variants; Borsh discriminants are order-based.
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
                attestation_id: v.attestation_id,
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
    pub attestation_id: u8,
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
    pub attestation_id: u8,
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
    pub attestation_id: u8,
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
            attestation_id: v.attestation_id,
            verified_at: v.verified_at,
        }
    }
}

impl From<&VerificationV2> for VerificationSummary {
    fn from(v: &VerificationV2) -> Self {
        Self {
            nullifier: v.nullifier.clone(),
            near_account_id: v.near_account_id.clone(),
            attestation_id: v.attestation_id,
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
    fn get_verified_count(&self) -> u32;

    /// Check if contract is paused.
    ///
    /// When paused, no new verifications can be stored, but reads still work.
    fn is_paused(&self) -> bool;
}
