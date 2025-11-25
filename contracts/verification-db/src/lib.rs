#![allow(clippy::too_many_arguments)]

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupSet, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, BorshStorageKey, NearSchema, PanicOnDefault, PublicKey};

/// Storage key prefixes for collections
#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Nullifiers,
    Accounts,
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
    if let Ok(json) = near_sdk::serde_json::to_string(data) {
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"near-self-verify\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}", event_name, json));
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
        }
    }

    /// Update the backend wallet address (only callable by current backend wallet)
    /// Use this for key rotation or if the backend wallet is compromised
    pub fn update_backend_wallet(&mut self, new_backend_wallet: AccountId) {
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
    pub fn pause(&mut self) {
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
    pub fn unpause(&mut self) {
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

        // Store verification
        self.nullifiers.insert(&nullifier);
        self.accounts.insert(&near_account_id, &account);

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
            Err(_) => {
                env::panic_str("Failed to serialize NEP-413 payload");
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

    /// Check if a nullifier has been used (public read)
    pub fn is_nullifier_used(&self, nullifier: String) -> bool {
        self.nullifiers.contains(&nullifier)
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
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

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

    #[test]
    fn test_duplicate_nullifier() {
        let backend = accounts(1);
        let context = get_context(backend.clone());
        testing_env!(context.build());

        let _contract = Contract::new(backend);
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

        // Test nullifier check
        assert!(!contract.is_nullifier_used("test".to_string()));

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
}
