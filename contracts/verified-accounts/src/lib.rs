//! # Verified Accounts Contract
//!
//! Links Self.xyz ZK passport proofs to NEAR accounts with on-chain NEP-413 signature checks.
//!
//! ## Versioning
//! - Contract state: `VersionedContract` (append-only enum; migrate in `contract_mut()`).
//! - Records: `VersionedVerification` for lazy per-record upgrades (see `interface.rs`).
//! - Use `migrate()` + `#[init(ignore_state)]` only for breaking, non-lazy changes.
//!
//! ## Security Model
//! - Backend verifies ZK proofs and account ownership off-chain; the contract cannot verify proofs.
//! - NEP-413 checks here are cryptographic only; backend must validate access keys via RPC,
//!   enforce one-time challenges with TTLs, and bind challenges to this contract.
//! - On-chain enforcement: signature validity, signature uniqueness, nullifier uniqueness,
//!   and account uniqueness.

#![allow(clippy::too_many_arguments)]

use near_sdk::assert_one_yocto;
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupSet, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, BorshStorageKey, NearSchema, PanicOnDefault, PublicKey};

// Interface module for cross-contract calls
pub mod interface;
pub use interface::{
    ext_verified_accounts, SelfProofData, Verification, VerificationSummary, VersionedVerification,
    ZkProof,
};

/// Maximum length for string inputs
const MAX_NULLIFIER_LEN: usize = 80; // uint256 max = 78 decimal digits
const MAX_ATTESTATION_ID_LEN: usize = 1; // Self.xyz uses "1", "2", "3"
const MAX_USER_CONTEXT_DATA_LEN: usize = 4096;
const MAX_PUBLIC_SIGNALS_COUNT: usize = 21; // Passport proofs have 21 signals
const MAX_PROOF_COMPONENT_LEN: usize = 80; // BN254 field elements ~77 decimal digits

/// Maximum accounts per batch query
const MAX_BATCH_SIZE: usize = 100;

/// Storage key prefixes for collections.
/// IMPORTANT: These must remain constant across versions to preserve data.
#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Nullifiers,
    Accounts,
}

/// NEAR signature data
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, NearSchema)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct NearSignatureData {
    pub account_id: AccountId,
    pub signature: Vec<u8>,
    pub public_key: PublicKey,
    pub challenge: String,
    pub nonce: Vec<u8>,
    pub recipient: AccountId,
}

/// NEP-413 Payload structure
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Nep413Payload {
    pub message: String,
    pub nonce: [u8; 32],
    pub recipient: String,
    pub callback_url: Option<String>,
}

/// Event emitted when a verification is stored
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationStoredEvent {
    pub near_account_id: String,
    pub nullifier: String,
    pub attestation_id: String,
}

/// Event emitted when contract is paused
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractPausedEvent {
    pub by: String,
}

/// Event emitted when contract is unpaused
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractUnpausedEvent {
    pub by: String,
}

/// Event emitted when backend wallet is updated
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct BackendWalletUpdatedEvent {
    pub old_wallet: String,
    pub new_wallet: String,
}

/// Helper to emit JSON events in NEAR standard format
fn emit_event<T: Serialize>(event_name: &str, data: &T) {
    match near_sdk::serde_json::to_string(data) {
        Ok(json) => {
            env::log_str(&format!("EVENT_JSON:{{\"standard\":\"near-verified-accounts\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}", event_name, json));
        }
        Err(e) => {
            env::log_str(&format!("Failed to emit event {}: {:?}", event_name, e));
        }
    }
}

// ==================== Contract State Versioning ====================

/// Versioned contract state for upgrades.
///
/// Append new variants only and migrate in `contract_mut()`.
/// Never reorder or remove variants; Borsh discriminants are order-based.
#[derive(PanicOnDefault)]
#[near(contract_state)]
pub enum VersionedContract {
    /// V1: Original contract state (current production version)
    V1(ContractV1),
    // Future versions append here:
    // V2(ContractV2),  // 0x01 - example: adds rate limiting
}

/// Contract state version 1 (current production).
///
/// When adding fields, create `ContractV2` instead of modifying this struct.
#[near]
pub struct ContractV1 {
    /// Account authorized to write to this contract
    pub backend_wallet: AccountId,
    /// Set of used nullifiers
    pub nullifiers: LookupSet<String>,
    /// Map of NEAR accounts to their verification records (versioned format)
    pub verifications: UnorderedMap<AccountId, VersionedVerification>,
    /// Whether the contract is paused
    pub paused: bool,
}

/// Type alias for the current contract version.
/// Update this when changing the current production version.
pub type Contract = ContractV1;

impl VersionedContract {
    /// Get mutable reference to current contract version, upgrading if necessary.
    ///
    /// This method handles lazy migration from older versions to the current version.
    /// When adding V2, this would migrate V1 -> V2 on first write.
    fn contract_mut(&mut self) -> &mut Contract {
        match self {
            Self::V1(contract) => contract,
            // Future versions: migrate to current
            // Self::V2(contract) => contract,
        }
    }

    // ==================== Field Accessors for View Methods ====================
    // These provide uniform access to common fields across all versions,
    // eliminating the need for duplicate view method implementations.

    /// Get reference to verifications map (works across all versions)
    fn verifications(&self) -> &UnorderedMap<AccountId, VersionedVerification> {
        match self {
            Self::V1(c) => &c.verifications,
            // Self::V2(c) => &c.verifications,
        }
    }

    /// Get reference to backend wallet (works across all versions)
    fn backend_wallet(&self) -> &AccountId {
        match self {
            Self::V1(c) => &c.backend_wallet,
            // Self::V2(c) => &c.backend_wallet,
        }
    }

    /// Get paused state (works across all versions)
    fn paused(&self) -> bool {
        match self {
            Self::V1(c) => c.paused,
            // Self::V2(c) => c.paused,
        }
    }
}

// ==================== Contract Implementation ====================

#[near]
impl VersionedContract {
    /// Initialize contract with backend wallet address.
    #[init]
    pub fn new(backend_wallet: AccountId) -> Self {
        VersionedContract::V1(ContractV1 {
            backend_wallet,
            nullifiers: LookupSet::new(StorageKey::Nullifiers),
            verifications: UnorderedMap::new(StorageKey::Accounts),
            paused: false,
        })
    }

    /// One-time state migration after deploying new code.
    ///
    /// Use only for breaking changes that cannot be handled lazily. This uses
    /// `#[init(ignore_state)]` to read old state and `#[private]` to restrict callers.
    /// See `docs/UPGRADING.md` for details and examples.
    #[init(ignore_state)]
    #[private]
    pub fn migrate() -> Self {
        // Read the existing state
        let old_state: VersionedContract =
            env::state_read().unwrap_or_else(|| env::panic_str("No state to migrate"));

        // Currently no migration needed - just return the existing state.
        // When adding V2, this would transform V1 -> V2:
        //
        // match old_state {
        //     VersionedContract::V1(v1) => {
        //         VersionedContract::V2(ContractV2 {
        //             backend_wallet: v1.backend_wallet,
        //             nullifiers: v1.nullifiers,
        //             verifications: v1.verifications,
        //             paused: v1.paused,
        //         })
        //     }

        //     VersionedContract::V2(v2) => VersionedContract::V2(v2),
        // }

        old_state
    }

    /// Update the backend wallet address (only callable by backend wallet)
    #[payable]
    pub fn update_backend_wallet(&mut self, new_backend_wallet: AccountId) {
        assert_one_yocto();

        let contract = self.contract_mut();
        assert_eq!(
            env::predecessor_account_id(),
            contract.backend_wallet,
            "Only backend wallet can update backend wallet"
        );
        let old_wallet = contract.backend_wallet.clone();
        contract.backend_wallet = new_backend_wallet.clone();

        emit_event(
            "backend_wallet_updated",
            &BackendWalletUpdatedEvent {
                old_wallet: old_wallet.to_string(),
                new_wallet: new_backend_wallet.to_string(),
            },
        );
    }

    /// Pause the contract (only callable by backend wallet)
    /// When paused, no new verifications can be stored
    #[payable]
    pub fn pause(&mut self) {
        assert_one_yocto();
        let caller = env::predecessor_account_id();

        let contract = self.contract_mut();
        assert_eq!(
            caller, contract.backend_wallet,
            "Only backend wallet can pause contract"
        );
        assert!(!contract.paused, "Contract is already paused");
        contract.paused = true;

        emit_event(
            "contract_paused",
            &ContractPausedEvent {
                by: caller.to_string(),
            },
        );
    }

    /// Unpause the contract (only callable by backend wallet)
    #[payable]
    pub fn unpause(&mut self) {
        assert_one_yocto();
        let caller = env::predecessor_account_id();

        let contract = self.contract_mut();
        assert_eq!(
            caller, contract.backend_wallet,
            "Only backend wallet can unpause contract"
        );
        assert!(contract.paused, "Contract is not paused");
        contract.paused = false;

        emit_event(
            "contract_unpaused",
            &ContractUnpausedEvent {
                by: caller.to_string(),
            },
        );
    }

    /// Store a verified account with NEAR signature verification (only callable by backend wallet)
    #[payable]
    pub fn store_verification(
        &mut self,
        nullifier: String,
        near_account_id: AccountId,
        attestation_id: String,
        signature_data: NearSignatureData,
        self_proof: SelfProofData,
        user_context_data: String,
    ) {
        assert_one_yocto();

        let contract = self.contract_mut();

        // Check if contract is paused
        assert!(
            !contract.paused,
            "Contract is paused - no new verifications allowed"
        );

        // Input length validation
        assert!(!nullifier.is_empty(), "Nullifier cannot be empty");
        assert!(
            nullifier.len() <= MAX_NULLIFIER_LEN,
            "Nullifier exceeds maximum length of {}",
            MAX_NULLIFIER_LEN
        );
        assert!(
            attestation_id.len() <= MAX_ATTESTATION_ID_LEN,
            "Attestation ID exceeds maximum length of {}",
            MAX_ATTESTATION_ID_LEN
        );
        assert!(
            attestation_id == "1" || attestation_id == "2" || attestation_id == "3",
            "Attestation ID must be one of: 1, 2, 3"
        );
        assert!(
            user_context_data.len() <= MAX_USER_CONTEXT_DATA_LEN,
            "User context data exceeds maximum length of {}",
            MAX_USER_CONTEXT_DATA_LEN
        );

        // ZK Proof validation
        assert!(
            self_proof.public_signals.len() <= MAX_PUBLIC_SIGNALS_COUNT,
            "Public signals array exceeds maximum length of {}",
            MAX_PUBLIC_SIGNALS_COUNT
        );

        // Validate individual string lengths in proof components
        for signal in &self_proof.public_signals {
            assert!(
                signal.len() <= MAX_PROOF_COMPONENT_LEN,
                "Public signal string exceeds maximum length of {}",
                MAX_PROOF_COMPONENT_LEN
            );
        }

        for component in &self_proof.proof.a {
            assert!(
                component.len() <= MAX_PROOF_COMPONENT_LEN,
                "Proof component 'a' string exceeds maximum length of {}",
                MAX_PROOF_COMPONENT_LEN
            );
        }

        for row in &self_proof.proof.b {
            for component in row {
                assert!(
                    component.len() <= MAX_PROOF_COMPONENT_LEN,
                    "Proof component 'b' string exceeds maximum length of {}",
                    MAX_PROOF_COMPONENT_LEN
                );
            }
        }

        for component in &self_proof.proof.c {
            assert!(
                component.len() <= MAX_PROOF_COMPONENT_LEN,
                "Proof component 'c' string exceeds maximum length of {}",
                MAX_PROOF_COMPONENT_LEN
            );
        }

        // Access control: only backend wallet can write
        assert_eq!(
            env::predecessor_account_id(),
            contract.backend_wallet,
            "Only backend wallet can store verifications"
        );

        // Verify signature data matches the account being verified
        assert_eq!(
            signature_data.account_id, near_account_id,
            "Signature account ID must match near_account_id"
        );

        assert_eq!(
            signature_data.recipient, near_account_id,
            "Signature recipient must match near_account_id"
        );

        // Verify the NEAR signature
        Self::verify_near_signature(&signature_data);

        // Prevent duplicate nullifiers
        assert!(
            !contract.nullifiers.contains(&nullifier),
            "Nullifier already used - passport already registered"
        );

        // Prevent re-verification of accounts
        assert!(
            contract.verifications.get(&near_account_id).is_none(),
            "NEAR account already verified"
        );

        // Create verification record (always use current version)
        let verification = Verification {
            nullifier: nullifier.clone(),
            near_account_id: near_account_id.clone(),
            attestation_id: attestation_id.clone(),
            verified_at: env::block_timestamp(),
            self_proof,
            user_context_data,
        };

        // Store verification and tracking data
        contract.nullifiers.insert(&nullifier);
        contract
            .verifications
            .insert(&near_account_id, &VersionedVerification::from(verification));

        // Emit event
        emit_event(
            "verification_stored",
            &VerificationStoredEvent {
                near_account_id: near_account_id.to_string(),
                nullifier,
                attestation_id,
            },
        );
    }

    /// Verify NEAR signature (NEP-413 format)
    ///
    /// # Security Note
    ///
    /// This function verifies cryptographic signature validity only. It does NOT
    /// verify that the public key is a valid access key for the claimed account.
    fn verify_near_signature(sig_data: &NearSignatureData) {
        // Validate nonce length
        assert_eq!(sig_data.nonce.len(), 32, "Nonce must be exactly 32 bytes");

        // Validate signature length
        assert_eq!(sig_data.signature.len(), 64, "Signature must be 64 bytes");

        // Step 1: Serialize the NEP-413 prefix tag
        let tag: u32 = 2147484061;
        let tag_bytes = tag.to_le_bytes().to_vec();

        // Step 2: Create and serialize the NEP-413 payload
        let mut nonce_array = [0u8; 32];
        nonce_array.copy_from_slice(&sig_data.nonce);

        let payload = Nep413Payload {
            message: sig_data.challenge.clone(),
            nonce: nonce_array,
            recipient: sig_data.recipient.to_string(),
            callback_url: None,
        };

        // Borsh serialize the payload
        let payload_bytes = match near_sdk::borsh::to_vec(&payload) {
            Ok(bytes) => bytes,
            Err(e) => {
                env::panic_str(&format!(
                    "Failed to serialize NEP-413 payload: {:?}. Message: {}, Nonce len: {}, Recipient: {}",
                    e,
                    sig_data.challenge,
                    sig_data.nonce.len(),
                    sig_data.recipient
                ));
            }
        };

        // Step 3: Concatenate tag + payload
        let mut full_message = tag_bytes;
        full_message.extend_from_slice(&payload_bytes);

        // Step 4: SHA-256 hash the concatenated message
        let message_hash = env::sha256(&full_message);

        // Step 5: Extract and validate the public key
        let public_key_data = sig_data.public_key.as_bytes();
        assert_eq!(
            public_key_data.len(),
            33,
            "Public key data should be 33 bytes (1 byte type + 32 bytes key)"
        );

        let key_type = public_key_data.first().copied().unwrap_or(255);
        assert_eq!(key_type, 0, "Only ED25519 keys are supported");

        let public_key_bytes = public_key_data.get(1..).unwrap_or(&[]);
        assert_eq!(public_key_bytes.len(), 32, "Public key must be 32 bytes");

        // Step 6: Convert to fixed-size arrays for ed25519_verify
        let mut sig_array = [0u8; 64];
        sig_array.copy_from_slice(&sig_data.signature);

        let mut pk_array = [0u8; 32];
        pk_array.copy_from_slice(public_key_bytes);

        // Step 7: Verify the signature against the SHA-256 hash
        let is_valid = env::ed25519_verify(&sig_array, &message_hash, &pk_array);

        assert!(
            is_valid,
            "Invalid NEAR signature - NEP-413 verification failed"
        );
    }

    // ==================== View Methods ====================

    /// Get verification summary without proof data (public read)
    pub fn get_verification(&self, account_id: AccountId) -> Option<VerificationSummary> {
        self.verifications()
            .get(&account_id)
            .map(|v| VerificationSummary::from(&v))
    }

    /// Get full verification record including ZK proof (public read)
    pub fn get_full_verification(&self, account_id: AccountId) -> Option<Verification> {
        self.verifications()
            .get(&account_id)
            .map(|v| v.into_current())
    }

    /// Check if an account is verified (public read)
    pub fn is_verified(&self, account_id: AccountId) -> bool {
        self.verifications().get(&account_id).is_some()
    }

    /// Get the backend wallet address (public read)
    pub fn get_backend_wallet(&self) -> AccountId {
        self.backend_wallet().clone()
    }

    /// Get total number of verified accounts (public read)
    pub fn get_verified_count(&self) -> u64 {
        self.verifications().len()
    }

    /// Check if the contract is paused (public read)
    pub fn is_paused(&self) -> bool {
        self.paused()
    }

    /// Get paginated list of all verifications (public read)
    pub fn list_verifications(&self, from_index: u64, limit: u64) -> Vec<Verification> {
        let verifications = self.verifications();
        let limit = std::cmp::min(limit, 100);
        let keys = verifications.keys_as_vector();
        let from_index = std::cmp::min(from_index, keys.len());
        let to_index = std::cmp::min(from_index + limit, keys.len());

        (from_index..to_index)
            .filter_map(|index| {
                keys.get(index)
                    .and_then(|account_id| verifications.get(&account_id))
                    .map(|v| v.into_current())
            })
            .collect()
    }

    /// Batch check if multiple accounts are verified (public read)
    pub fn are_verified(&self, account_ids: Vec<AccountId>) -> Vec<bool> {
        assert!(
            account_ids.len() <= MAX_BATCH_SIZE,
            "Batch size exceeds maximum of {} accounts",
            MAX_BATCH_SIZE
        );
        let verifications = self.verifications();
        account_ids
            .iter()
            .map(|id| verifications.get(id).is_some())
            .collect()
    }

    /// Batch get verification summaries (public read)
    pub fn get_verifications(
        &self,
        account_ids: Vec<AccountId>,
    ) -> Vec<Option<VerificationSummary>> {
        assert!(
            account_ids.len() <= MAX_BATCH_SIZE,
            "Batch size exceeds maximum of {} accounts",
            MAX_BATCH_SIZE
        );
        let verifications = self.verifications();
        account_ids
            .iter()
            .map(|id| verifications.get(id).map(|v| VerificationSummary::from(&v)))
            .collect()
    }

    /// Get contract state version (for diagnostics)
    pub fn get_state_version(&self) -> u8 {
        match self {
            Self::V1(_) => 1,
            // Self::V2(_) => 2,
        }
    }
}
