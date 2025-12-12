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
//!
//! ## On-Chain Verification
//! The contract independently verifies:
//! - NEP-413 Ed25519 signatures
//! - Signature uniqueness
//! - Nullifier uniqueness
//! - Account uniqueness
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

/// Maximum length for string inputs
const MAX_NULLIFIER_LEN: usize = 80; // uint256 max = 77 decimal digits
const MAX_USER_ID_LEN: usize = 80; // uint256 max = 77 decimal digits
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

/// Groth16 ZK proof structure
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
    pub proof: ZkProof,
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
            paused: false,
            used_signatures: LookupSet::new(StorageKey::UsedSignatures),
        }
    }

    /// Update the backend wallet address (only callable by current backend wallet)
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
            user_id.len() <= MAX_USER_ID_LEN,
            "User ID exceeds maximum length of {}",
            MAX_USER_ID_LEN
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
        //   - nullifier: ~64 bytes (hex string)
        //   - near_account_id: ~64 bytes max
        //   - user_id: ~256 bytes max
        //   - attestation_id: ~256 bytes max
        //   - verified_at: 8 bytes (u64)
        //   - user_context_data: ~4096 bytes max
        //   - self_proof.proof (Groth16 BN254):
        //       - a: 2 × ~77 bytes (256-bit field elements as decimal strings) = ~154 bytes
        //       - b: 4 × ~77 bytes = ~308 bytes
        //       - c: 2 × ~77 bytes = ~154 bytes
        //   - self_proof.public_signals: 21 × ~77 bytes = ~1617 bytes
        //   Subtotal: ~7,000 bytes worst case
        //
        // Additional collections storage:
        //   - used_signatures LookupSet: 64 bytes + ~40 bytes key overhead
        //   - nullifiers LookupSet: ~64 bytes + ~40 bytes key overhead
        //   - accounts UnorderedMap: ~64 bytes key + ~40 bytes overhead
        //   Subtotal: ~300 bytes
        //
        // Total with Borsh overhead (~10%): ~8,000 bytes
        // Using 10KB (10,240 bytes) as conservative estimate
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
    pub fn get_account(
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
    pub fn get_accounts(
        &self,
        account_ids: Vec<AccountId>,
    ) -> Vec<Option<verified_accounts_interface::VerifiedAccountInfo>> {
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

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]
#[allure_rust::allure_suite("Verified Accounts - Unit Tests")]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::test_utils::get_logs;
    use near_sdk::NearToken;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    /// Helper function to assert that a closure panics with an expected message.
    /// This allows using #[allure_rust::allure_test] with panic tests.
    fn assert_panic_with<F: FnOnce()>(f: F, expected: &str) {
        use std::panic::{catch_unwind, AssertUnwindSafe};
        let result = catch_unwind(AssertUnwindSafe(f));
        match result {
            Ok(_) => panic!("Expected panic with '{}' but no panic occurred", expected),
            Err(err) => {
                let msg = if let Some(s) = err.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = err.downcast_ref::<String>() {
                    s.clone()
                } else {
                    format!("{:?}", err)
                };
                assert!(
                    msg.contains(expected),
                    "Panic message '{}' does not contain expected '{}'",
                    msg,
                    expected
                );
            }
        }
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

    #[allure_rust::allure_test]
    #[test]
    fn test_initialization() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = Contract::new(accounts(1));
        assert_eq!(contract.get_backend_wallet(), accounts(1));
        assert_eq!(contract.get_verified_count(), 0);
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_unauthorized_write() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = Contract::new(accounts(1));

        assert_panic_with(
            || {
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
            },
            "Only backend wallet can store verifications",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_invalid_signature() {
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

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Invalid NEAR signature - NEP-413 verification failed",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_invalid_nonce_length() {
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
            },
            "Nonce must be exactly 32 bytes",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_invalid_signature_length() {
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
            },
            "Signature must be 64 bytes",
        );
    }

    // ==================== PAUSE/UNPAUSE TESTS ====================

    #[allure_rust::allure_test]
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
        
        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected pause event");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("contract_paused"), "Expected contract_paused event");

        // Unpause (requires 1 yocto)
        let mut context = get_context(backend);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());
        contract.unpause();
        assert!(!contract.is_paused());

        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected unpause event");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("contract_unpaused"), "Expected contract_unpaused event");
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_unauthorized_pause() {
        let backend = accounts(1);
        let unauthorized = accounts(0);
        let mut context = get_context(unauthorized);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        assert_panic_with(|| contract.pause(), "Only backend wallet can pause contract");
    }

    #[allure_rust::allure_test]
    #[test]
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

        assert_panic_with(|| contract.unpause(), "Only backend wallet can unpause contract");
    }

    #[allure_rust::allure_test]
    #[test]
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
            },
            "Contract is paused - no new verifications allowed",
        );
    }

    // ==================== BACKEND WALLET UPDATE TESTS ====================

    #[allure_rust::allure_test]
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

        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected backend wallet update event");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("backend_wallet_updated"), "Expected backend_wallet_updated event");
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_unauthorized_update_backend_wallet() {
        let backend = accounts(1);
        let unauthorized = accounts(0);
        let mut context = get_context(unauthorized);
        context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        assert_panic_with(
            || contract.update_backend_wallet(accounts(3)),
            "Only current backend wallet can update backend wallet",
        );
    }

    // ==================== INPUT VALIDATION TESTS ====================

    #[allure_rust::allure_test]
    #[test]
    fn test_account_id_mismatch() {
        let backend = accounts(1);
        let user = accounts(2);
        let different_user = accounts(3);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        assert_panic_with(
            || {
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
            },
            "Signature account ID must match near_account_id",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_recipient_mismatch() {
        let backend = accounts(1);
        let user = accounts(2);
        let different_recipient = accounts(3);
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
            },
            "Signature recipient must match near_account_id",
        );
    }

    #[allure_rust::allure_test]
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
        assert!(contract.get_account_with_proof(accounts(2)).is_none());

        // Test pagination with empty data
        let accounts_list = contract.get_verified_accounts(0, 10);
        assert_eq!(accounts_list.len(), 0);
    }

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
    #[test]
    fn test_get_account_empty() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Should return None for non-existent account
        let info = contract.get_account(accounts(2));
        assert!(info.is_none());
    }

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
    #[test]
    fn test_get_accounts_empty() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Batch status check with empty contract
        let results = contract.get_accounts(vec![accounts(2), accounts(3), accounts(4)]);
        assert_eq!(results.len(), 3);
        assert!(results[0].is_none());
        assert!(results[1].is_none());
        assert!(results[2].is_none());
    }

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
    #[test]
    fn test_batch_size_exceeded_are_accounts_verified() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Create 101 accounts to exceed the limit
        let too_many_accounts: Vec<near_sdk::AccountId> = (0..101)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();

        assert_panic_with(
            || {
                contract.are_accounts_verified(too_many_accounts);
            },
            "Batch size exceeds maximum of 100 accounts",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_batch_size_exceeded_get_accounts() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        // Create 101 accounts to exceed the limit
        let too_many_accounts: Vec<near_sdk::AccountId> = (0..101)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();

        assert_panic_with(
            || {
                contract.get_accounts(too_many_accounts);
            },
            "Batch size exceeds maximum of 100 accounts",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_nullifier_too_long() {
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

                // Create a nullifier that exceeds the 80 character limit
                let too_long_nullifier = "x".repeat(81);

                contract.store_verification(
                    too_long_nullifier,
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Nullifier exceeds maximum length of 80",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_id_too_long() {
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

                // Create a user_id that exceeds the 80 character limit
                let too_long_user_id = "x".repeat(81);

                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    too_long_user_id,
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "User ID exceeds maximum length of 80",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_context_data_too_long() {
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
            },
            "User context data exceeds maximum length of 4096",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_attestation_id_too_long() {
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

                // Attestation ID exceeds the 1 character limit
                contract.store_verification(
                    "test_nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "12".to_string(), // Too long - max is 1
                    sig_data,
                    test_self_proof(),
                    "test_user_context_data".to_string(),
                );
            },
            "Attestation ID exceeds maximum length of 1",
        );
    }

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
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

    #[allure_rust::allure_test]
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

    // ==================== BOUNDARY VALUE TESTS (Phase 1.1) ====================
    // These tests verify behavior at exact boundary limits per ISTQB best practices

    /// Helper to create signature data for boundary tests
    fn create_test_sig_data(user: AccountId) -> NearSignatureData {
        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 64],
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user,
        }
    }

    /// Helper to create proof with custom public signals
    fn test_self_proof_with_signals(signals: Vec<String>) -> SelfProofData {
        SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: signals,
        }
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_nullifier_at_max_length_80_reaches_signature_check() {
        // If nullifier at exactly 80 chars passes validation, it should reach signature check
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Exactly 80 characters - should pass length validation
        let nullifier_80 = "x".repeat(80);
        assert_eq!(nullifier_80.len(), 80);

        assert_panic_with(
            || {
                contract.store_verification(
                    nullifier_80,
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_id_at_max_length_80_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Exactly 80 characters - should pass length validation
        let user_id_80 = "y".repeat(80);
        assert_eq!(user_id_80.len(), 80);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    user_id_80,
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_attestation_id_at_max_length_1_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Exactly 1 character - should pass length validation
        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "9".to_string(), // Single char - max allowed
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_context_data_at_max_length_4096_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Exactly 4096 characters - should pass length validation
        let context_4096 = "z".repeat(4096);
        assert_eq!(context_4096.len(), 4096);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    context_4096,
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_public_signals_at_max_21_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Exactly 21 signals - should pass length validation
        let proof = test_self_proof_with_signals(vec!["0".to_string(); 21]);
        assert_eq!(proof.public_signals.len(), 21);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_public_signal_item_at_80_chars_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Signal string at exactly 80 chars - should pass validation
        let mut signals = vec!["0".to_string(); 20];
        signals.push("x".repeat(80));
        let proof = test_self_proof_with_signals(signals);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_proof_component_a_at_80_chars_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Proof 'a' component at exactly 80 chars
        let proof = SelfProofData {
            proof: ZkProof {
                a: ["x".repeat(80), "y".repeat(80)],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: vec!["0".to_string(); 21],
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_proof_component_b_at_80_chars_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Proof 'b' component at exactly 80 chars
        let proof = SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["x".repeat(80), "y".repeat(80)],
                    ["z".repeat(80), "w".repeat(80)],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: vec!["0".to_string(); 21],
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_proof_component_c_at_80_chars_reaches_signature_check() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // Proof 'c' component at exactly 80 chars
        let proof = SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["x".repeat(80), "y".repeat(80)],
            },
            public_signals: vec!["0".to_string(); 21],
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    // ==================== EMPTY STRING EDGE CASE TESTS (Phase 1.2) ====================

    #[allure_rust::allure_test]
    #[test]
    fn test_empty_nullifier_passes_validation() {
        // Empty nullifier is allowed (no minimum length requirement)
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        assert_panic_with(
            || {
                contract.store_verification(
                    "".to_string(), // Empty nullifier
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_empty_user_id_passes_validation() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "".to_string(), // Empty user_id
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_empty_attestation_id_passes_validation() {
        // Empty attestation_id has length 0, which is <= 1, so it passes validation
        // This test documents that empty attestation_id IS allowed by the contract
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "".to_string(), // Empty attestation_id - passes validation (0 <= 1)
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_empty_user_context_data_passes_validation() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "".to_string(), // Empty user_context_data
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_empty_public_signals_array_passes_validation() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let proof = test_self_proof_with_signals(vec![]); // Empty signals array

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    // ==================== NEP-413 SIGNATURE COMPONENT TESTS (Phase 1.5) ====================

    #[allure_rust::allure_test]
    #[test]
    fn test_nonce_31_bytes_fails() {
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
            nonce: vec![0; 31], // 31 bytes - too short
            recipient: user.clone(),
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Nonce must be exactly 32 bytes",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_nonce_33_bytes_fails() {
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
            nonce: vec![0; 33], // 33 bytes - too long
            recipient: user.clone(),
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Nonce must be exactly 32 bytes",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_signature_63_bytes_fails() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 63], // 63 bytes - too short
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Signature must be 64 bytes",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_signature_65_bytes_fails() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
        let sig_data = NearSignatureData {
            account_id: user.clone(),
            signature: vec![0; 65], // 65 bytes - too long
            public_key: public_key_str.parse().unwrap(),
            challenge: "Identify myself".to_string(),
            nonce: vec![0; 32],
            recipient: user.clone(),
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Signature must be 64 bytes",
        );
    }

    // ==================== UNICODE/MULTIBYTE TESTS (Phase 1.4) ====================

    #[allure_rust::allure_test]
    #[test]
    fn test_nullifier_with_unicode_counted_by_bytes() {
        // Unicode characters take multiple bytes - test boundary behavior
        // The contract uses .len() which counts bytes, not chars
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // 40 emoji chars = 160 bytes (each emoji is 4 bytes)
        // But we want to test that it uses byte length, not char count
        // 20 emojis = 80 bytes exactly
        let emoji_nullifier = "🔥".repeat(20);
        assert_eq!(emoji_nullifier.len(), 80); // 80 bytes

        assert_panic_with(
            || {
                contract.store_verification(
                    emoji_nullifier,
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_nullifier_with_unicode_exceeds_byte_limit() {
        // 21 emojis = 84 bytes, exceeds 80 byte limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let emoji_nullifier = "🔥".repeat(21);
        assert_eq!(emoji_nullifier.len(), 84); // 84 bytes > 80

        assert_panic_with(
            || {
                contract.store_verification(
                    emoji_nullifier,
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Nullifier exceeds maximum length of 80",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_context_data_with_unicode_at_boundary() {
        // Test user_context_data at exactly 4096 bytes with multibyte chars
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        // 1024 emojis = 4096 bytes exactly
        let unicode_context = "🎉".repeat(1024);
        assert_eq!(unicode_context.len(), 4096);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    unicode_context,
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_context_data_with_unicode_exceeds_limit() {
        // 1025 emojis = 4100 bytes, exceeds limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let unicode_context = "🎉".repeat(1025);
        assert_eq!(unicode_context.len(), 4100);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    unicode_context,
                );
            },
            "User context data exceeds maximum length of 4096",
        );
    }

    // ==================== LIMIT-1 BOUNDARY VALUE TESTS (Phase 1.6) ====================
    // Per ISTQB best practices: test at limit-1, limit, and limit+1
    // limit and limit+1 tests already exist above; these add limit-1 tests

    #[allure_rust::allure_test]
    #[test]
    fn test_nullifier_boundary_limit_minus_1_passes() {
        // 79 chars - one below the 80 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let nullifier_79 = "x".repeat(79);
        assert_eq!(nullifier_79.len(), 79);

        assert_panic_with(
            || {
                contract.store_verification(
                    nullifier_79,
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_id_boundary_limit_minus_1_passes() {
        // 79 chars - one below the 80 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let user_id_79 = "y".repeat(79);
        assert_eq!(user_id_79.len(), 79);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    user_id_79,
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_user_context_data_boundary_limit_minus_1_passes() {
        // 4095 chars - one below the 4096 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let context_4095 = "z".repeat(4095);
        assert_eq!(context_4095.len(), 4095);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    test_self_proof(),
                    context_4095,
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_public_signals_boundary_limit_minus_1_passes() {
        // 20 signals - one below the 21 signal limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let proof = test_self_proof_with_signals(vec!["0".to_string(); 20]);
        assert_eq!(proof.public_signals.len(), 20);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_public_signal_item_boundary_limit_minus_1_passes() {
        // 79 char signal string - one below the 80 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let mut signals = vec!["0".to_string(); 20];
        signals.push("x".repeat(79));
        let proof = test_self_proof_with_signals(signals);

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_proof_component_a_boundary_limit_minus_1_passes() {
        // 79 char proof component - one below the 80 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let proof = SelfProofData {
            proof: ZkProof {
                a: ["x".repeat(79), "y".repeat(79)],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: vec!["0".to_string(); 21],
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_proof_component_b_boundary_limit_minus_1_passes() {
        // 79 char proof component - one below the 80 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let proof = SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["x".repeat(79), "y".repeat(79)],
                    ["z".repeat(79), "w".repeat(79)],
                ],
                c: ["7".to_string(), "8".to_string()],
            },
            public_signals: vec!["0".to_string(); 21],
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_proof_component_c_boundary_limit_minus_1_passes() {
        // 79 char proof component - one below the 80 char limit
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);
        let sig_data = create_test_sig_data(user.clone());

        let proof = SelfProofData {
            proof: ZkProof {
                a: ["1".to_string(), "2".to_string()],
                b: [
                    ["3".to_string(), "4".to_string()],
                    ["5".to_string(), "6".to_string()],
                ],
                c: ["x".repeat(79), "y".repeat(79)],
            },
            public_signals: vec!["0".to_string(); 21],
        };

        assert_panic_with(
            || {
                contract.store_verification(
                    "nullifier".to_string(),
                    user,
                    "user1".to_string(),
                    "1".to_string(),
                    sig_data,
                    proof,
                    "test".to_string(),
                );
            },
            "Invalid NEAR signature",
        );
    }

    // ==================== BATCH SIZE BOUNDARY TESTS (Phase 1.7) ====================

    #[allure_rust::allure_test]
    #[test]
    fn test_batch_size_boundary_limit_minus_1_passes() {
        // 99 accounts - one below the 100 account limit
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        let batch_99: Vec<near_sdk::AccountId> = (0..99)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();
        assert_eq!(batch_99.len(), 99);

        // Should not panic - returns 99 false results
        let results = contract.are_accounts_verified(batch_99);
        assert_eq!(results.len(), 99);
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_batch_size_boundary_at_limit_passes() {
        // 100 accounts - exactly at the limit
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        let batch_100: Vec<near_sdk::AccountId> = (0..100)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();
        assert_eq!(batch_100.len(), 100);

        // Should not panic - returns 100 false results
        let results = contract.are_accounts_verified(batch_100);
        assert_eq!(results.len(), 100);
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_batch_size_get_accounts_boundary_limit_minus_1_passes() {
        // 99 accounts - one below the 100 account limit
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        let batch_99: Vec<near_sdk::AccountId> = (0..99)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();
        assert_eq!(batch_99.len(), 99);

        // Should not panic - returns 99 None results
        let results = contract.get_accounts(batch_99);
        assert_eq!(results.len(), 99);
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_batch_size_get_accounts_boundary_at_limit_passes() {
        // 100 accounts - exactly at the limit
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        let batch_100: Vec<near_sdk::AccountId> = (0..100)
            .map(|i| format!("account{}.near", i).parse().unwrap())
            .collect();
        assert_eq!(batch_100.len(), 100);

        // Should not panic - returns 100 None results
        let results = contract.get_accounts(batch_100);
        assert_eq!(results.len(), 100);
    }

    // ==================== INVARIANT TESTS (Phase 2) ====================
    // Per OpenZeppelin best practices: verify system-wide invariants

    #[allure_rust::allure_test]
    #[test]
    fn test_invariant_backend_wallet_always_valid() {
        // Invariant: backend_wallet should never be empty after initialization
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend.clone());

        // Backend wallet should never be empty
        assert!(!contract.get_backend_wallet().as_str().is_empty());
        assert_eq!(contract.get_backend_wallet(), backend);
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_invariant_verified_count_starts_at_zero() {
        // Invariant: new contract should have zero verified accounts
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let contract = Contract::new(backend);

        assert_eq!(contract.get_verified_count(), 0);
        assert!(contract.get_verified_accounts(0, 100).is_empty());
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_invariant_paused_state_consistent() {
        // Invariant: is_paused should reflect actual state after pause/unpause
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend.clone());
        assert!(!contract.is_paused(), "Should start unpaused");

        // Pause
        let mut pause_context = get_context(backend.clone());
        pause_context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(pause_context.build());
        contract.pause();
        assert!(contract.is_paused(), "Should be paused after pause()");

        // Unpause
        let mut unpause_context = get_context(backend);
        unpause_context.attached_deposit(NearToken::from_yoctonear(1));
        testing_env!(unpause_context.build());
        contract.unpause();
        assert!(!contract.is_paused(), "Should be unpaused after unpause()");
    }

    // ==================== STRESS TESTS (Phase 4) ====================
    // Verify behavior at maximum capacity

    #[allure_rust::allure_test]
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

    // ==================== HAPPY PATH TEST (Phase 3) ====================
    
    use near_crypto::{KeyType, SecretKey, Signer, InMemorySigner};

    /// Helper to create a valid signature for a given message
    fn create_valid_signature(
        signer: &Signer, 
        signer_id: &AccountId,
        challenge: &str, 
        nonce: &[u8], 
        recipient: &AccountId
    ) -> NearSignatureData {
        // Step 1: Serialize the NEP-413 prefix tag (2^31 + 413)
        let tag: u32 = 2147484061;
        let tag_bytes = tag.to_le_bytes().to_vec();

        // Step 2: Create valid NEP-413 payload
        let mut nonce_array = [0u8; 32];
        nonce_array.copy_from_slice(nonce);

        let payload = Nep413Payload {
            message: challenge.to_string(),
            nonce: nonce_array,
            recipient: recipient.to_string(),
            callback_url: None,
        };

        let payload_bytes = near_sdk::borsh::to_vec(&payload).unwrap();

        // Step 3: Concatenate tag + payload
        let mut full_message = tag_bytes;
        full_message.extend_from_slice(&payload_bytes);

        // Step 4: SHA-256 hash
        let message_hash = env::sha256(&full_message);

        // Step 5: Sign the hash
        let signature = signer.sign(&message_hash);
        
        // Extract bytes from signature enum using Borsh (skip 1 byte tag)
        // Signature::ED25519 is 0 + 64 bytes
        let signature_borsh = near_sdk::borsh::to_vec(&signature).unwrap();
        let signature_bytes = signature_borsh[1..].to_vec();
        assert_eq!(signature_bytes.len(), 64, "Signature must be 64 bytes");

        // Convert to our data structure
        let public_key_str = signer.public_key().to_string();
        
        NearSignatureData {
            account_id: signer_id.clone(),
            signature: signature_bytes,
            public_key: public_key_str.parse().unwrap(),
            challenge: challenge.to_string(),
            nonce: nonce.to_vec(),
            recipient: recipient.clone(),
        }
    }

    #[allure_rust::allure_test]
    #[test]
    fn test_happy_path_store_verification() {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let mut contract = Contract::new(backend);

        // create a signer for the user (using near-crypto)
        let signer = InMemorySigner::from_secret_key(
            user.clone(),
            SecretKey::from_random(KeyType::ED25519),
        );

        let challenge = "Identify myself";
        let nonce = vec![0u8; 32];
        let sig_data = create_valid_signature(&signer, &user, challenge, &nonce, &user);

        // Should succeed without panic
        contract.store_verification(
            "test_nullifier".to_string(),
            user.clone(),
            "user1".to_string(),
            "1".to_string(),
            sig_data,
            test_self_proof(),
            "test_user_context_data".to_string(),
        );

        // Verify state changes
        assert!(contract.is_account_verified(user.clone()));
        assert_eq!(contract.get_verified_count(), 1);

        // Verify events
        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected verification event");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("verification_stored"), "Expected verification_stored event");
        
        let account = contract.get_account(user.clone()).unwrap();
        assert_eq!(account.near_account_id, user);
        assert_eq!(account.nullifier, "test_nullifier");
    }
}
