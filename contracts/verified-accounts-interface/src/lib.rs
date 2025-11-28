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

/// Lightweight verification status (no proof data).
///
/// Use this when you only need basic verification info without the full ZK proof.
/// This reduces gas costs for cross-contract calls.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerificationStatus {
    /// The NEAR account that was verified
    pub near_account_id: AccountId,
    /// The attestation ID from the identity provider
    pub attestation_id: String,
    /// Unix timestamp (nanoseconds) when verification was recorded
    pub verified_at: u64,
}

/// Full verification record for interface consumers.
///
/// Note: The full `VerifiedAccount` in the main contract also contains
/// `self_proof` and `user_context_data` fields. This interface version
/// omits those to keep the interface lightweight. If you need the full
/// proof data for re-verification, call `get_verified_account()` on
/// the main contract directly.
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

/// Interface for cross-contract calls to the verified-accounts contract.
///
/// This trait is processed by the `#[ext_contract]` macro to generate
/// the `ext_verified_accounts` module with cross-contract call builders.
///
/// ## Gas Recommendations
///
/// | Method | Recommended Gas |
/// |--------|-----------------|
/// | `is_account_verified` | 5 TGas |
/// | `get_verification_status` | 5 TGas |
/// | `get_verified_account` | 10 TGas |
/// | `are_accounts_verified(10)` | 8 TGas |
/// | `get_verification_statuses(10)` | 10 TGas |
/// | Callback overhead | 5 TGas |
#[ext_contract(ext_verified_accounts)]
pub trait VerifiedAccounts {
    // ==================== Single Account Queries ====================

    /// Check if an account is verified (simple boolean).
    ///
    /// This is the most gas-efficient method for simple gate checks.
    fn is_account_verified(&self, near_account_id: AccountId) -> bool;

    /// Get lightweight verification status (no proof data).
    ///
    /// Returns `None` if the account is not verified.
    /// Use this when you need the attestation_id or verification timestamp.
    fn get_verification_status(&self, near_account_id: AccountId) -> Option<VerificationStatus>;

    /// Get full verification record.
    ///
    /// Returns `None` if the account is not verified.
    /// Note: This returns `VerifiedAccountInfo` which omits the ZK proof data
    /// to keep the interface lightweight.
    fn get_verified_account_info(&self, near_account_id: AccountId) -> Option<VerifiedAccountInfo>;

    // ==================== Batch Queries (for DAO voting, etc.) ====================

    /// Check multiple accounts in one call.
    ///
    /// Returns `Vec<bool>` in the same order as the input `account_ids`.
    /// More gas-efficient than multiple individual calls.
    ///
    /// Note: Large batches may exceed gas limits. Recommended max: 50 accounts.
    fn are_accounts_verified(&self, account_ids: Vec<AccountId>) -> Vec<bool>;

    /// Get statuses for multiple accounts.
    ///
    /// Returns `Vec<Option<VerificationStatus>>` in the same order as input.
    /// Each element is `None` if that account is not verified.
    ///
    /// Note: Large batches may exceed gas limits. Recommended max: 50 accounts.
    fn get_verification_statuses(
        &self,
        account_ids: Vec<AccountId>,
    ) -> Vec<Option<VerificationStatus>>;

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
mod tests {
    use super::*;

    #[test]
    fn test_verification_status_serialization() {
        let status = VerificationStatus {
            near_account_id: "test.near".parse().unwrap(),
            attestation_id: "attestation123".to_string(),
            verified_at: 1234567890,
        };

        // Test JSON serialization
        let json = near_sdk::serde_json::to_string(&status).unwrap();
        assert!(json.contains("test.near"));
        assert!(json.contains("attestation123"));

        // Test Borsh serialization
        let borsh = near_sdk::borsh::to_vec(&status).unwrap();
        let decoded: VerificationStatus = near_sdk::borsh::from_slice(&borsh).unwrap();
        assert_eq!(decoded.near_account_id, status.near_account_id);
    }

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
}
