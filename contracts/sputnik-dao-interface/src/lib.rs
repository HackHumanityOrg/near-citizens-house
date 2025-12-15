//! # SputnikDAO Interface
//!
//! This crate provides a typed interface for making cross-contract calls to
//! SputnikDAO v2 contracts. Other NEAR contracts can add this as a dependency
//! to get type-safe cross-contract calls.
//!
//! ## Usage Example
//!
//! ```rust,ignore
//! use near_sdk::{env, near, AccountId, Promise, Gas};
//! use sputnik_dao_interface::{ext_sputnik_dao, ProposalInput, ProposalKind};
//!
//! #[near(contract_state)]
//! pub struct MyContract {
//!     sputnik_dao: AccountId,
//! }
//!
//! #[near]
//! impl MyContract {
//!     pub fn create_vote_proposal(&mut self, description: String) -> Promise {
//!         ext_sputnik_dao::ext(self.sputnik_dao.clone())
//!             .with_static_gas(Gas::from_tgas(30))
//!             .with_attached_deposit(env::attached_deposit())
//!             .add_proposal(ProposalInput {
//!                 description,
//!                 kind: ProposalKind::Vote,
//!             })
//!     }
//! }
//! ```

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::serde_json;
use near_sdk::{ext_contract, AccountId, NearSchema};

// ==================== Proposal Types ====================

/// Input structure for creating a new proposal.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct ProposalInput {
    /// Description of the proposal (usually markdown).
    pub description: String,
    /// The type and parameters of the proposal.
    pub kind: ProposalKind,
}

/// Proposal types supported by SputnikDAO v2.
///
/// Note: Only the types needed for the bridge contract are included.
/// The full SputnikDAO supports many more types (Transfer, FunctionCall, etc.)
/// which are intentionally excluded for security.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum ProposalKind {
    /// Text-only governance/discussion proposal.
    /// No on-chain action is executed when approved.
    Vote,

    /// Add a member to a specific role.
    AddMemberToRole {
        /// The account to add to the role.
        member_id: AccountId,
        /// The name of the role (e.g., "citizen", "council").
        role: String,
    },

    /// Remove a member from a specific role.
    RemoveMemberFromRole {
        /// The account to remove from the role.
        member_id: AccountId,
        /// The name of the role.
        role: String,
    },

    /// Add or update a role in the DAO policy.
    /// Used to dynamically update vote thresholds as membership changes.
    ChangePolicyAddOrUpdateRole {
        /// The role definition to add or update.
        role: RolePermission,
    },
}

/// How permissions are assigned to a role.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum RoleKind {
    /// Role applies to everyone.
    Everyone,
    /// Role applies only to specific group of accounts.
    Group(Vec<AccountId>),
}

/// Role permission definition for DAO policy.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct RolePermission {
    /// Name of the role (e.g., "citizen", "council").
    pub name: String,
    /// Kind of role membership.
    pub kind: RoleKind,
    /// Set of permissions (e.g., "vote:VoteApprove", "add_member_to_role:AddProposal").
    pub permissions: Vec<String>,
    /// Per-proposal-kind voting policies. Empty uses default.
    pub vote_policy: std::collections::HashMap<String, VotePolicy>,
}

// ==================== Action Types ====================

/// Actions that can be performed on proposals.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum Action {
    /// Vote to approve the proposal.
    VoteApprove,
    /// Vote to reject the proposal.
    VoteReject,
    /// Vote to remove the proposal entirely.
    VoteRemove,
    /// Finalize the proposal after voting period ends.
    Finalize,
    /// Move proposal to another DAO (AstroDAO hub feature).
    MoveToHub,
}

// ==================== Policy Types ====================

/// Voting weight calculation method.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum WeightKind {
    /// Each member of a role has equal weight (1 vote).
    RoleWeight,
    /// Weight is based on token balance.
    TokenWeight,
}

/// How votes are counted to determine outcome.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
#[serde(untagged)]
pub enum WeightOrRatio {
    /// Fixed weight threshold.
    Weight(U128),
    /// Ratio threshold (numerator, denominator), e.g., [1, 2] = 50%.
    Ratio(u64, u64),
}

/// Voting policy for proposals.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct VotePolicy {
    /// How to calculate vote weight.
    pub weight_kind: WeightKind,
    /// Minimum participation required (0 = no quorum).
    pub quorum: U128,
    /// Threshold to pass (ratio or fixed weight).
    pub threshold: WeightOrRatio,
}

// ==================== Interface Trait ====================

/// Interface for cross-contract calls to SputnikDAO v2.
///
/// This trait is processed by the `#[ext_contract]` macro to generate
/// the `ext_sputnik_dao` module with cross-contract call builders.
///
/// ## Important: Attached Deposit
///
/// The `add_proposal` method requires an attached deposit (proposal bond).
/// The bond amount is configured in the DAO's policy.
///
/// ## Gas Recommendations
///
/// | Method | Recommended Gas |
/// |--------|-----------------|
/// | `add_proposal` | 30 TGas |
/// | `act_proposal` | 30 TGas |
/// | `get_policy` | 10 TGas |
#[ext_contract(ext_sputnik_dao)]
pub trait SputnikDao {
    /// Create a new proposal.
    ///
    /// Returns the proposal ID (u64).
    ///
    /// **Important**: Requires attached deposit equal to or greater than
    /// the proposal_bond configured in the DAO policy.
    fn add_proposal(&mut self, proposal: ProposalInput) -> u64;

    /// Perform an action on a proposal.
    ///
    /// Actions include voting (VoteApprove, VoteReject, VoteRemove),
    /// finalizing after voting period, or moving to hub.
    ///
    /// **Important**: The `proposal` parameter must match the stored proposal's kind,
    /// otherwise the call will fail with "ERR_WRONG_KIND".
    fn act_proposal(
        &mut self,
        id: u64,
        action: Action,
        proposal: ProposalKind,
        memo: Option<String>,
    );

    /// Get the current DAO policy.
    fn get_policy(&self) -> serde_json::Value;

    /// Get a proposal by ID.
    fn get_proposal(&self, id: u64) -> Option<serde_json::Value>;

    /// Get the last proposal ID.
    fn get_last_proposal_id(&self) -> u64;
}

