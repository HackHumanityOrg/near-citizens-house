//! # Verified Accounts Interface (Minimal)
//!
//! This module provides a minimal typed interface for making cross-contract calls
//! to the verified-accounts oracle contract. Only the methods needed by the bridge
//! contract are included.
//!
//! ## Usage
//!
//! ```rust,ignore
//! use crate::verified_accounts::ext_verified_accounts;
//!
//! ext_verified_accounts::ext(self.verified_accounts_contract.clone())
//!     .with_static_gas(Gas::from_tgas(5))
//!     .is_verified(account_id)
//! ```

use near_sdk::{ext_contract, AccountId};

/// Minimal interface for cross-contract calls to the verified-accounts contract.
///
/// Only includes methods needed by the bridge contract.
///
/// ## Gas Recommendations
///
/// | Method | Recommended Gas |
/// |--------|-----------------|
/// | `is_verified` | 5 TGas |
#[ext_contract(ext_verified_accounts)]
pub trait VerifiedAccounts {
    /// Check if an account is verified (simple boolean).
    ///
    /// **Use this for:** Gate checks, access control, DAO voting eligibility.
    /// This is the most gas-efficient method.
    fn is_verified(&self, account_id: AccountId) -> bool;
}
