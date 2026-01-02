//! # Verified Accounts Contract
//!
//! A NEAR smart contract that links real-world passport identity to NEAR wallets
//! using Self.xyz zero-knowledge proofs and on-chain signature verification.
//!
//! # Security Model
//!
//! This contract operates with a trusted backend model:
//!
//! ## Trust Assumptions
//! - The `backend_wallet` is trusted to only submit valid Self.xyz ZK proofs
//! - The contract cannot verify ZK proofs on-chain (prohibitively expensive)
//! - **The `backend_wallet` is trusted to verify account ownership off-chain**
//!   - NEP-413 signatures prove cryptographic validity, NOT that the public key
//!     is a valid access key for the claimed account
//!   - NEAR smart contracts cannot query on-chain access keys (SDK limitation)
//!   - The backend MUST verify the signing key is registered for the account
//!     via RPC (`view_access_key`) before submitting verifications
//!
//! ## On-Chain Verification
//! The contract independently verifies:
//! - NEP-413 Ed25519 signatures (cryptographic validity only)
//! - Signature uniqueness (replay protection)
//! - Nullifier uniqueness (one identity per person)
//! - Account uniqueness (one identity per NEAR account)
//!
//! ## Proof Storage & Re-Verification
//! Self.xyz ZK proofs are stored on-chain in their entirety
//!

#![allow(clippy::too_many_arguments)]

use near_sdk::assert_one_yocto;
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupSet, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, BorshStorageKey, NearSchema, PanicOnDefault, PublicKey};

// Interface module for cross-contract calls
pub mod interface;
pub use interface::{
    ext_verified_accounts, SelfProofData, VerifiedAccount, VerifiedAccountInfo, ZkProof,
};

/// Maximum length for string inputs
const MAX_NULLIFIER_LEN: usize = 80; // uint256 max = 78 decimal digits
const MAX_ATTESTATION_ID_LEN: usize = 1; // Self.xyz uses "1", "2", "3"
const MAX_USER_CONTEXT_DATA_LEN: usize = 4096;
const MAX_PUBLIC_SIGNALS_COUNT: usize = 21; // Passport proofs have 21 signals
const MAX_PROOF_COMPONENT_LEN: usize = 80; // BN254 field elements ~77 decimal digits

/// Maximum accounts per batch query
const MAX_BATCH_SIZE: usize = 100;

/// Storage key prefixes for collections
#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Nullifiers,
    Accounts,
    UsedSignatures,
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
#[cfg(not(feature = "testing"))]
struct Nep413Payload {
    message: String,
    nonce: [u8; 32],
    recipient: String,
    callback_url: Option<String>,
}

/// NEP-413 Payload structure (public for testing)
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
#[cfg(feature = "testing")]
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

/// Main contract structure
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    /// Account authorized to write to this contract
    pub backend_wallet: AccountId,
    /// Set of used nullifiers
    pub nullifiers: LookupSet<String>,
    /// Map of NEAR accounts to their verification records
    pub accounts: UnorderedMap<AccountId, VerifiedAccount>,
    /// Set of used signatures
    pub used_signatures: LookupSet<[u8; 64]>,
    /// Whether the contract is paused
    pub paused: bool,
}

#[near]
impl Contract {
    /// Initialize contract with backend wallet address
    #[init]
    pub fn new(backend_wallet: AccountId) -> Self {
        Self {
            backend_wallet,
            nullifiers: LookupSet::new(StorageKey::Nullifiers),
            accounts: UnorderedMap::new(StorageKey::Accounts),
            used_signatures: LookupSet::new(StorageKey::UsedSignatures),
            paused: false,
        }
    }

    /// Update the backend wallet address (only callable by backend wallet)
    #[payable]
    pub fn update_backend_wallet(&mut self, new_backend_wallet: AccountId) {
        assert_one_yocto();
        assert_eq!(
            env::predecessor_account_id(),
            self.backend_wallet,
            "Only backend wallet can update backend wallet"
        );
        let old_wallet = self.backend_wallet.clone();
        self.backend_wallet = new_backend_wallet.clone();

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
        assert_eq!(
            caller, self.backend_wallet,
            "Only backend wallet can pause contract"
        );
        self.paused = true;

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
        assert_eq!(
            caller, self.backend_wallet,
            "Only backend wallet can unpause contract"
        );
        self.paused = false;

        emit_event(
            "contract_unpaused",
            &ContractUnpausedEvent {
                by: caller.to_string(),
            },
        );
    }

    /// Check if the contract is paused (public read)
    pub fn is_paused(&self) -> bool {
        self.paused
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

        // Check if contract is paused
        assert!(
            !self.paused,
            "Contract is paused - no new verifications allowed"
        );

        // Input length validation
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
        // BN254 field elements are ~77 decimal digits, 80 chars gives margin
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
            self.backend_wallet,
            "Only backend wallet can store verifications"
        );

        // Early storage cost estimation based on actual data structures:
        //
        // VerifiedAccount struct (Borsh serialized):
        //   - nullifier: ~84 bytes (80 char max + 4-byte length prefix)
        //   - near_account_id: ~68 bytes (64 char max + 4-byte length prefix)
        //   - attestation_id: ~5 bytes (1 char + 4-byte length prefix)
        //   - verified_at: 8 bytes (u64)
        //   - user_context_data: ~4100 bytes (4096 max + 4-byte length prefix)
        //   - self_proof.proof (Groth16 BN254):
        //       - a: 2 × ~84 bytes (77-digit field elements + length prefix) = ~168 bytes
        //       - b: 4 × ~84 bytes = ~336 bytes
        //       - c: 2 × ~84 bytes = ~168 bytes
        //   - self_proof.public_signals: 21 × ~84 bytes + vec prefix = ~1768 bytes
        //   Subtotal: ~6,700 bytes worst case
        //
        // Additional collections storage:
        //   - used_signatures LookupSet: 64 bytes + ~40 bytes key overhead = ~104 bytes
        //   - nullifiers LookupSet: ~84 bytes + ~40 bytes key overhead = ~124 bytes
        //   - accounts UnorderedMap: ~68 bytes key + ~40 bytes overhead = ~108 bytes
        //   Subtotal: ~336 bytes
        //
        // Total: ~7,036 bytes
        // Using 10KB (10,240 bytes) as conservative estimate with ~45% margin
        //
        // NEAR storage cost: 1e19 yoctoNEAR per byte (100KB = 1 NEAR)
        // 10KB = 0.1 NEAR = 1e23 yoctoNEAR
        const ESTIMATED_STORAGE_BYTES: u128 = 10_240;
        let estimated_cost = env::storage_byte_cost().saturating_mul(ESTIMATED_STORAGE_BYTES);
        assert!(
            env::account_balance() >= estimated_cost,
            "Insufficient contract balance for storage. Estimated required: {} yoctoNEAR (~0.1 NEAR)",
            estimated_cost
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
        self.verify_near_signature(&signature_data);

        // Prevent signature replay
        let mut sig_array = [0u8; 64];
        sig_array.copy_from_slice(&signature_data.signature);
        assert!(
            !self.used_signatures.contains(&sig_array),
            "Signature already used - potential replay attack"
        );

        // Prevent duplicate nullifiers
        assert!(
            !self.nullifiers.contains(&nullifier),
            "Nullifier already used - passport already registered"
        );

        // Prevent re-verification of accounts
        assert!(
            self.accounts.get(&near_account_id).is_none(),
            "NEAR account already verified"
        );

        // Check storage balance before modifications
        let initial_storage = env::storage_usage();

        // Create verification record
        let account = VerifiedAccount {
            nullifier: nullifier.clone(),
            near_account_id: near_account_id.clone(),
            attestation_id: attestation_id.clone(),
            verified_at: env::block_timestamp(),
            self_proof,
            user_context_data,
        };

        // Store verification and tracking data
        self.used_signatures.insert(&sig_array);
        self.nullifiers.insert(&nullifier);
        self.accounts.insert(&near_account_id, &account);

        // Validate storage cost coverage (after writes)
        // Note: NEAR transactions are atomic - if this check fails, all state changes revert
        let final_storage = env::storage_usage();
        let storage_used = final_storage.saturating_sub(initial_storage);
        let storage_cost = env::storage_byte_cost().saturating_mul(storage_used.into());

        assert!(
            env::account_balance() >= storage_cost,
            "Insufficient contract balance for storage. Required: {} yoctoNEAR",
            storage_cost
        );

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
    ///
    /// The NEAR SDK does not provide a way to query on-chain access keys from
    /// within a smart contract. Access key validation must be performed off-chain
    /// by the backend wallet using RPC (`view_access_key`) before calling this
    /// contract.
    ///
    /// See module-level documentation for the complete trust model.
    fn verify_near_signature(&self, sig_data: &NearSignatureData) {
        // Validate nonce length
        assert_eq!(sig_data.nonce.len(), 32, "Nonce must be exactly 32 bytes");

        // Validate signature length
        assert_eq!(sig_data.signature.len(), 64, "Signature must be 64 bytes");

        // Step 1: Serialize the NEP-413 prefix tag
        // The tag is 2^31 + 413 = 2147484061
        // This prevents replay attacks by making the message definitively NOT a NEAR transaction
        let tag: u32 = 2147484061;
        let tag_bytes = tag.to_le_bytes().to_vec();

        // Step 2: Create and serialize the NEP-413 payload
        let mut nonce_array = [0u8; 32];
        nonce_array.copy_from_slice(&sig_data.nonce);

        let payload = Nep413Payload {
            message: sig_data.challenge.clone(),
            nonce: nonce_array,
            recipient: sig_data.recipient.to_string(),
            callback_url: None, // Not used in our implementation
        };

        // Borsh serialize the payload
        // This should never fail
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

        // First byte is the key type (0 for ED25519)
        let key_type = public_key_data.first().copied().unwrap_or(255);
        assert_eq!(key_type, 0, "Only ED25519 keys are supported");

        // Extract the 32-byte public key (skip first byte which is key type)
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

    /// Get account verification info without proof data (public read)
    /// Returns all essential data without the large ZK proof
    pub fn get_account(&self, near_account_id: AccountId) -> Option<VerifiedAccountInfo> {
        self.accounts
            .get(&near_account_id)
            .map(|v| VerifiedAccountInfo {
                nullifier: v.nullifier,
                near_account_id: v.near_account_id,
                attestation_id: v.attestation_id,
                verified_at: v.verified_at,
            })
    }

    /// Get full account data including ZK proof (public read)
    /// Only use this when you need the actual proof data for re-verification
    /// For most cases, use get_account() instead to save gas
    pub fn get_account_with_proof(&self, near_account_id: AccountId) -> Option<VerifiedAccount> {
        self.accounts.get(&near_account_id)
    }

    /// Check if an account is verified (public read)
    pub fn is_account_verified(&self, near_account_id: AccountId) -> bool {
        self.accounts.get(&near_account_id).is_some()
    }

    /// Get the backend wallet address (public read)
    pub fn get_backend_wallet(&self) -> AccountId {
        self.backend_wallet.clone()
    }

    /// Get total number of verified accounts (public read)
    pub fn get_verified_count(&self) -> u64 {
        self.accounts.len()
    }

    /// Get paginated list of all verified accounts (public read)
    /// from_index: starting index (0-based)
    /// limit: max number of records to return (max 100)
    pub fn get_verified_accounts(&self, from_index: u64, limit: u64) -> Vec<VerifiedAccount> {
        let limit = std::cmp::min(limit, 100); // Cap at 100 per request
        let keys = self.accounts.keys_as_vector();
        let from_index = std::cmp::min(from_index, keys.len());
        let to_index = std::cmp::min(from_index + limit, keys.len());

        (from_index..to_index)
            .filter_map(|index| {
                keys.get(index)
                    .and_then(|account_id| self.accounts.get(&account_id))
            })
            .collect()
    }

    /// Batch check if multiple accounts are verified (public read)
    /// Returns Vec<bool> in same order as input - efficient for DAO voting
    /// Maximum 100 accounts per call to prevent gas exhaustion
    pub fn are_accounts_verified(&self, account_ids: Vec<AccountId>) -> Vec<bool> {
        assert!(
            account_ids.len() <= MAX_BATCH_SIZE,
            "Batch size exceeds maximum of {} accounts",
            MAX_BATCH_SIZE
        );
        account_ids
            .iter()
            .map(|id| self.accounts.get(id).is_some())
            .collect()
    }

    /// Batch get account verification info (public read)
    /// Returns Vec<Option<VerifiedAccountInfo>> in same order as input
    /// Maximum 100 accounts per call to prevent gas exhaustion
    pub fn get_accounts(&self, account_ids: Vec<AccountId>) -> Vec<Option<VerifiedAccountInfo>> {
        assert!(
            account_ids.len() <= MAX_BATCH_SIZE,
            "Batch size exceeds maximum of {} accounts",
            MAX_BATCH_SIZE
        );
        account_ids
            .iter()
            .map(|id| self.get_account(id.clone()))
            .collect()
    }

    /// Get interface version for compatibility checking (public read)
    /// Derived from Cargo.toml version to ensure consistency
    pub fn interface_version(&self) -> String {
        env!("CARGO_PKG_VERSION").to_string()
    }
}
