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
//! - The backend verifies that the provided public key is an access key for the account
//! - The contract cannot verify ZK proofs on-chain (prohibitively expensive)
//!
//! ## On-Chain Verification
//! The contract independently verifies:
//! - NEP-413 Ed25519 signatures (prevents signature forgery)
//! - Signature uniqueness (prevents replay attacks)
//! - Nullifier uniqueness (prevents passport reuse)
//! - Account uniqueness (prevents re-verification)
//!
//! ## Proof Storage & Re-Verification
//! Self.xyz ZK proofs are stored on-chain in their entirety, enabling:
//! - Independent re-verification using snarkjs.groth16.verify() with the public vkey
//! - No timestamp expiration - proofs remain mathematically valid forever
//! - The on-chain record serves as authoritative proof of verification at `verified_at`
//! - Auditing and dispute resolution
//! - Transparency of all verification claims
//!
//! Note: The Self.xyz SDK has a ~24 hour timestamp window that rejects old proofs.
//! The backend uses snarkjs directly to bypass this check for stored proof re-verification.
//!
//! ## Defense in Depth
//! Multiple layers of protection ensure security even if one layer is bypassed:
//! 1. Backend access control (only trusted wallet can write)
//! 2. Signature verification (proves user consent)
//! 3. Signature tracking (prevents replay of valid signatures)
//! 4. Nullifier tracking (prevents same passport used twice)
//! 5. Account tracking (prevents re-verification)
//! 6. On-chain proof storage (enables future re-verification)

#![allow(clippy::too_many_arguments)]

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupSet, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, BorshStorageKey, NearSchema, PanicOnDefault, PublicKey};
use near_sdk::assert_one_yocto;

/// Maximum length for string inputs (prevents storage abuse)
const MAX_NULLIFIER_LEN: usize = 256;
const MAX_USER_ID_LEN: usize = 256;
const MAX_ATTESTATION_ID_LEN: usize = 256;
const MAX_USER_CONTEXT_DATA_LEN: usize = 4096;

/// Maximum accounts per batch query (prevents gas exhaustion)
const MAX_BATCH_SIZE: usize = 100;

/// Storage key prefixes for collections
/// Using enum ensures unique prefixes per Sigma Prime recommendations
#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Nullifiers,
    Accounts,
    /// Tracks used signatures to prevent replay attacks on NEP-413 off-chain signatures
    UsedSignatures,
}

/// Groth16 ZK proof structure (a, b, c points) for async verification
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct ZkProof {
    pub a: [String; 2],
    pub b: [[String; 2]; 2],
    pub c: [String; 2],
}

/// Self.xyz proof data
/// Contains all data needed to re-verify the proof against Self.xyz's IdentityVerificationHub
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct SelfProofData {
    /// Groth16 ZK proof (a, b, c points)
    pub proof: ZkProof,
    /// Public signals from the circuit (contains nullifier, merkle root, scope, etc.)
    pub public_signals: Vec<String>,
}

/// Verified account record stored on-chain
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerifiedAccount {
    pub nullifier: String,
    pub near_account_id: AccountId,
    pub user_id: String,
    pub attestation_id: String,
    pub verified_at: u64,
    pub self_proof: SelfProofData,
    pub user_context_data: String,
}

/// NEAR signature data for verification (NEP-413 format)
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

/// NEP-413 Payload structure for signature verification
/// This must match the wallet's signature format exactly
#[derive(BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
struct Nep413Payload {
    message: String,
    nonce: [u8; 32],
    recipient: String,
    callback_url: Option<String>,
}

/// Event emitted when a verification is stored
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VerificationStoredEvent {
    pub near_account_id: String,
    pub nullifier: String,
    pub attestation_id: String,
}

/// Event emitted when contract is paused
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractPausedEvent {
    pub by: String,
}

/// Event emitted when contract is unpaused
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractUnpausedEvent {
    pub by: String,
}

/// Event emitted when backend wallet is updated
#[derive(Serialize)]
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
    /// Set of used nullifiers (prevents duplicate passport registrations)
    pub nullifiers: LookupSet<String>,
    /// Map of NEAR accounts to their verification records
    pub accounts: UnorderedMap<AccountId, VerifiedAccount>,
    /// Whether the contract is paused (emergency stop)
    pub paused: bool,
    /// Set of used signatures (prevents replay attacks on NEP-413 off-chain signatures)
    pub used_signatures: LookupSet<[u8; 64]>,
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
            paused: false,
            used_signatures: LookupSet::new(StorageKey::UsedSignatures),
        }
    }

    /// Update the backend wallet address (only callable by current backend wallet)
    /// Use this for key rotation or if the backend wallet is compromised
    /// Requires 1 yocto deposit to ensure only Full Access keys can call this
    #[payable]
    pub fn update_backend_wallet(&mut self, new_backend_wallet: AccountId) {
        assert_one_yocto();
        assert_eq!(
            env::predecessor_account_id(),
            self.backend_wallet,
            "Only current backend wallet can update backend wallet"
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

    /// Pause the contract (emergency stop - only callable by backend wallet)
    /// When paused, no new verifications can be stored
    /// Requires 1 yocto deposit to ensure only Full Access keys can call this
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
    /// Requires 1 yocto deposit to ensure only Full Access keys can call this
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

    /// Store a verified account with NEAR signature verification
    /// Only callable by backend wallet
    pub fn store_verification(
        &mut self,
        nullifier: String,
        near_account_id: AccountId,
        user_id: String,
        attestation_id: String,
        signature_data: NearSignatureData,
        self_proof: SelfProofData,
        user_context_data: String,
    ) {
        // Check if contract is paused
        assert!(!self.paused, "Contract is paused - no new verifications allowed");

        // Input length validation - prevents storage abuse
        // Check cheapest validations first (fail fast, save gas)
        assert!(
            nullifier.len() <= MAX_NULLIFIER_LEN,
            "Nullifier exceeds maximum length of 256"
        );
        assert!(
            user_id.len() <= MAX_USER_ID_LEN,
            "User ID exceeds maximum length of 256"
        );
        assert!(
            attestation_id.len() <= MAX_ATTESTATION_ID_LEN,
            "Attestation ID exceeds maximum length of 256"
        );
        assert!(
            user_context_data.len() <= MAX_USER_CONTEXT_DATA_LEN,
            "User context data exceeds maximum length of 4096"
        );

        // ZK Proof validation - prevents storage DOS attacks
        // Self.xyz proofs typically have 21 public signals, cap at 30 for safety
        assert!(
            self_proof.public_signals.len() <= 30,
            "Public signals array exceeds maximum length of 30"
        );

        // Validate individual string lengths in proof components
        // Field elements are ~32 bytes = 64 hex chars, 256 is very generous
        for signal in &self_proof.public_signals {
            assert!(
                signal.len() <= 256,
                "Public signal string exceeds maximum length of 256"
            );
        }

        for component in &self_proof.proof.a {
            assert!(
                component.len() <= 256,
                "Proof component 'a' string exceeds maximum length of 256"
            );
        }

        for row in &self_proof.proof.b {
            for component in row {
                assert!(
                    component.len() <= 256,
                    "Proof component 'b' string exceeds maximum length of 256"
                );
            }
        }

        for component in &self_proof.proof.c {
            assert!(
                component.len() <= 256,
                "Proof component 'c' string exceeds maximum length of 256"
            );
        }

        // Access control: only backend wallet can write
        assert_eq!(
            env::predecessor_account_id(),
            self.backend_wallet,
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
        self.verify_near_signature(&signature_data);

        // Prevent signature replay attacks
        // NEP-413 off-chain signatures don't increment on-chain nonces,
        // so we track used signatures to prevent replay
        let mut sig_array = [0u8; 64];
        sig_array.copy_from_slice(&signature_data.signature);
        assert!(
            !self.used_signatures.contains(&sig_array),
            "Signature already used - potential replay attack"
        );

        // Prevent duplicate nullifiers (same passport can't be used twice)
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
            user_id,
            attestation_id: attestation_id.clone(),
            verified_at: env::block_timestamp(),
            self_proof,
            user_context_data,
        };

        // Store verification and tracking data
        self.used_signatures.insert(&sig_array);
        self.nullifiers.insert(&nullifier);
        self.accounts.insert(&near_account_id, &account);

        // Validate storage cost coverage
        let final_storage = env::storage_usage();
        let storage_used = final_storage.saturating_sub(initial_storage);
        let storage_cost = env::storage_byte_cost()
            .saturating_mul(storage_used.into());

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
    /// This implements the full NEP-413 specification for signature verification
    /// Reference: https://github.com/near/NEPs/blob/master/neps/nep-0413.md
    fn verify_near_signature(&self, sig_data: &NearSignatureData) {
        // Validate nonce length
        assert_eq!(
            sig_data.nonce.len(),
            32,
            "Nonce must be exactly 32 bytes"
        );

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
        // This should never fail for a simple struct, but we handle the error for safety
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
        // The wallet signs the hash, not the raw message
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
        // This is the critical fix: we verify against the HASH, not raw bytes
        let is_valid = env::ed25519_verify(&sig_array, &message_hash, &pk_array);

        assert!(is_valid, "Invalid NEAR signature - NEP-413 verification failed");
    }

    /// Get verification record for an account (public read)
    pub fn get_verified_account(&self, near_account_id: AccountId) -> Option<VerifiedAccount> {
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

    // ==================== Composability Interface Methods ====================
    // These methods match the verified-accounts-interface crate for cross-contract calls

    /// Get lightweight verification status without proof data (public read)
    /// More gas-efficient for simple status checks
    pub fn get_verification_status(
        &self,
        near_account_id: AccountId,
    ) -> Option<verified_accounts_interface::VerificationStatus> {
        self.accounts.get(&near_account_id).map(|v| {
            verified_accounts_interface::VerificationStatus {
                near_account_id: v.near_account_id,
                attestation_id: v.attestation_id,
                verified_at: v.verified_at,
            }
        })
    }

    /// Get verification info without proof data (public read)
    /// Matches the interface crate's VerifiedAccountInfo type
    pub fn get_verified_account_info(
        &self,
        near_account_id: AccountId,
    ) -> Option<verified_accounts_interface::VerifiedAccountInfo> {
        self.accounts.get(&near_account_id).map(|v| {
            verified_accounts_interface::VerifiedAccountInfo {
                nullifier: v.nullifier,
                near_account_id: v.near_account_id,
                user_id: v.user_id,
                attestation_id: v.attestation_id,
                verified_at: v.verified_at,
            }
        })
    }

    /// Batch check if multiple accounts are verified (public read)
    /// Returns Vec<bool> in same order as input - efficient for DAO voting
    /// Maximum 100 accounts per call to prevent gas exhaustion
    pub fn are_accounts_verified(&self, account_ids: Vec<AccountId>) -> Vec<bool> {
        assert!(
            account_ids.len() <= MAX_BATCH_SIZE,
            "Batch size exceeds maximum of 100 accounts"
        );
        account_ids
            .iter()
            .map(|id| self.accounts.get(id).is_some())
            .collect()
    }

    /// Batch get verification statuses (public read)
    /// Returns Vec<Option<VerificationStatus>> in same order as input
    /// Maximum 100 accounts per call to prevent gas exhaustion
    pub fn get_verification_statuses(
        &self,
        account_ids: Vec<AccountId>,
    ) -> Vec<Option<verified_accounts_interface::VerificationStatus>> {
        assert!(
            account_ids.len() <= MAX_BATCH_SIZE,
            "Batch size exceeds maximum of 100 accounts"
        );
        account_ids
            .iter()
            .map(|id| self.get_verification_status(id.clone()))
            .collect()
    }

    /// Get interface version for compatibility checking (public read)
    pub fn interface_version(&self) -> String {
        "1.0.0".to_string()
    }

    // Note: NEP-330 contract_source_metadata() is auto-generated by the NEAR SDK
    // It uses CARGO_PKG_VERSION and CARGO_PKG_REPOSITORY from Cargo.toml
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::NearToken;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    /// Create test Self proof data
    fn test_self_proof() -> SelfProofData {
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

    #[test]
    fn test_initialization() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = Contract::new(accounts(1));
        assert_eq!(contract.get_backend_wallet(), accounts(1));
        assert_eq!(contract.get_verified_count(), 0);
    }

    #[test]
    #[should_panic(expected = "Only backend wallet can store verifications")]
    fn test_unauthorized_write() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = Contract::new(accounts(1));

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: accounts(2),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "test".to_string(),
            nonce: vec![0; 32],
            recipient: accounts(2),
        };

        contract.store_verification(
            "test_nullifier".to_string(),
            accounts(2),
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    #[should_panic(expected = "Invalid NEAR signature - NEP-413 verification failed")]
    fn test_invalid_signature() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        contract.store_verification(
            "test_nullifier".to_string(),
            user,
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    #[should_panic(expected = "Nonce must be exactly 32 bytes")]
    fn test_invalid_nonce_length() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "test".to_string(),
            nonce: vec![0; 16],
            recipient: user.clone(),
        };

        contract.store_verification(
            "test_nullifier".to_string(),
            user,
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    #[should_panic(expected = "Signature must be 64 bytes")]
    fn test_invalid_signature_length() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 32],
            public_key: public_key_str.parse().unwrap(),
            challenge: "test".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        contract.store_verification(
            "test_nullifier".to_string(),
            user,
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    // ==================== PAUSE/UNPAUSE TESTS ====================

    #[test]
    fn test_pause_unpause() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend.clone());

        // Initially not paused
        assert!(!contract.is_paused());

        // Pause (requires 1 yocto)
        let mut context = get_context(backend.clone());
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.pause();
        assert!(contract.is_paused());

        // Unpause (requires 1 yocto)
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.unpause();
        assert!(!contract.is_paused());
    }

    #[test]
    #[should_panic(expected = "Only backend wallet can pause contract")]
    fn test_unauthorized_pause() {
        let backend = accounts(1);
        let unauthorized = accounts(0);
        let mut context = get_context(unauthorized);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        contract.pause();
    }

    #[test]
    #[should_panic(expected = "Only backend wallet can unpause contract")]
    fn test_unauthorized_unpause() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend.clone());

        // Pause (requires 1 yocto)
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.pause();

        // Change context to unauthorized user (with 1 yocto to pass deposit check)
        let mut unauthorized_context = get_context(accounts(0));
        unauthorized_context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(unauthorized_context.build());

        contract.unpause();
    }

    #[test]
    #[should_panic(expected = "Contract is paused - no new verifications allowed")]
    fn test_store_verification_when_paused() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend.clone());

        // Pause (requires 1 yocto)
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.pause();

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        // Should panic because contract is paused (before signature verification)
        contract.store_verification(
            "test_nullifier".to_string(),
            user,
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    // ==================== BACKEND WALLET UPDATE TESTS ====================

    #[test]
    fn test_update_backend_wallet() {
        let backend = accounts(1);
        let new_backend = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend.clone());
        assert_eq!(contract.get_backend_wallet(), backend);

        // Update backend wallet (requires 1 yocto)
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.update_backend_wallet(new_backend.clone());
        assert_eq!(contract.get_backend_wallet(), new_backend);
    }

    #[test]
    #[should_panic(expected = "Only current backend wallet can update backend wallet")]
    fn test_unauthorized_update_backend_wallet() {
        let backend = accounts(1);
        let unauthorized = accounts(0);
        let mut context = get_context(unauthorized);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        contract.update_backend_wallet(accounts(3));
    }

    // ==================== INPUT VALIDATION TESTS ====================

    #[test]
    #[should_panic(expected = "Signature account ID must match near_account_id")]
    fn test_account_id_mismatch() {
        let backend = accounts(1);
        let user = accounts(2);
        let different_user = accounts(3);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: different_user, // Mismatch: signature is for accounts(3)
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        contract.store_verification(
            "test_nullifier".to_string(),
            user, // But we're trying to verify accounts(2)
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    #[should_panic(expected = "Signature recipient must match near_account_id")]
    fn test_recipient_mismatch() {
        let backend = accounts(1);
        let user = accounts(2);
        let different_recipient = accounts(3);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: different_recipient, // Mismatch: recipient is accounts(3)
        };

        contract.store_verification(
            "test_nullifier".to_string(),
            user, // But we're trying to verify accounts(2)
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    fn test_read_functions() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend.clone());

        // Test backend wallet getter
        assert_eq!(contract.get_backend_wallet(), backend);

        // Test count
        assert_eq!(contract.get_verified_count(), 0);

        // Test account verification check
        assert!(!contract.is_account_verified(accounts(2)));

        // Test get verified account
        assert!(contract.get_verified_account(accounts(2)).is_none());

        // Test pagination with empty data
        let accounts_list = contract.get_verified_accounts(0, 10);
        assert_eq!(accounts_list.len(), 0);
    }

    #[test]
    fn test_pagination_limit() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Test that limit is capped at 100
        let accounts_list = contract.get_verified_accounts(0, 200);
        assert_eq!(accounts_list.len(), 0);
    }

    // ==================== COMPOSABILITY INTERFACE TESTS ====================

    #[test]
    fn test_interface_version() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);
        assert_eq!(contract.interface_version(), "1.0.0");
    }

    // Note: NEP-330 contract_source_metadata() is auto-generated by SDK
    // and tested via integration tests

    #[test]
    fn test_get_verification_status_empty() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Should return None for non-existent account
        let status = contract.get_verification_status(accounts(2));
        assert!(status.is_none());
    }

    #[test]
    fn test_get_verified_account_info_empty() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Should return None for non-existent account
        let info = contract.get_verified_account_info(accounts(2));
        assert!(info.is_none());
    }

    #[test]
    fn test_are_accounts_verified_empty() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Batch check with empty contract
        let results = contract.are_accounts_verified(vec![accounts(2), accounts(3), accounts(4)]);
        assert_eq!(results.len(), 3);
        assert!(!results[0]);
        assert!(!results[1]);
        assert!(!results[2]);
    }

    #[test]
    fn test_get_verification_statuses_empty() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Batch status check with empty contract
        let results =
            contract.get_verification_statuses(vec![accounts(2), accounts(3), accounts(4)]);
        assert_eq!(results.len(), 3);
        assert!(results[0].is_none());
        assert!(results[1].is_none());
        assert!(results[2].is_none());
    }

    #[test]
    fn test_are_accounts_verified_empty_input() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Empty input should return empty result
        let results = contract.are_accounts_verified(vec![]);
        assert!(results.is_empty());
    }

    // ==================== INPUT VALIDATION TESTS (NEW) ====================

    #[test]
    #[should_panic(expected = "Batch size exceeds maximum of 100 accounts")]
    fn test_batch_size_exceeded_are_accounts_verified() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Create 101 accounts to exceed the limit
        let too_many_accounts: Vec<near_sdk::AccountId> = (0..101)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();

        // Should panic due to batch size limit
        contract.are_accounts_verified(too_many_accounts);
    }

    #[test]
    #[should_panic(expected = "Batch size exceeds maximum of 100 accounts")]
    fn test_batch_size_exceeded_get_verification_statuses() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Create 101 accounts to exceed the limit
        let too_many_accounts: Vec<near_sdk::AccountId> = (0..101)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();

        // Should panic due to batch size limit
        contract.get_verification_statuses(too_many_accounts);
    }

    #[test]
    #[should_panic(expected = "Nullifier exceeds maximum length of 256")]
    fn test_nullifier_too_long() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        // Create a nullifier that exceeds the 256 character limit
        let too_long_nullifier = "x".repeat(257);

        contract.store_verification(
            too_long_nullifier,
            user,
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    #[should_panic(expected = "User ID exceeds maximum length of 256")]
    fn test_user_id_too_long() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        // Create a user_id that exceeds the 256 character limit
        let too_long_user_id = "x".repeat(257);

        contract.store_verification(
            "test_nullifier".to_string(),
            user,
            too_long_user_id,
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );
    }

    #[test]
    #[should_panic(expected = "User context data exceeds maximum length of 4096")]
    fn test_user_context_data_too_long() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        // Create user_context_data that exceeds the 4096 character limit
        let too_long_context = "x".repeat(4097);

        contract.store_verification(
            "test_nullifier".to_string(),
            user,
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            too_long_context,
        );
    }
}
