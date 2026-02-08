//! # Verified Accounts Interface (Governance)
//!
//! Minimal typed interface and data types for cross-contract calls to the
//! verified-accounts contract.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use serde::{Deserialize, Serialize};
use near_sdk::{ext_contract, AccountId, NearSchema};

/// Lightweight verification summary (no signature data).
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerificationSummary {
    pub near_account_id: AccountId,
    pub verified_at: u64,
}

/// Cross-contract interface to the verified-accounts contract.
#[ext_contract(ext_verified_accounts)]
pub trait VerifiedAccountsInterface {
    /// Returns total verified count.
    fn get_verified_count(&self) -> u32;

    /// Returns verification summary for the account, if verified.
    fn get_verification(&self, account_id: AccountId) -> Option<VerificationSummary>;
}
