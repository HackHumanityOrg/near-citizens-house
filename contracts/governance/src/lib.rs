//! # Citizens House Governance Contract (Scaffold)
//!
//! This file provides the full data model, events, and method signatures
//! required by the VOTING_PRD_UPDATED.md specification. Method bodies are
//! intentionally left unimplemented.

#![allow(clippy::too_many_arguments)]

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableMap, IterableSet, LookupMap, Vector};
use near_sdk::{ext_contract, near, AccountId, BorshStorageKey, NearSchema, PanicOnDefault};
use serde::{Deserialize, Serialize};

pub mod interface;
pub use interface::{ext_verified_accounts, VerificationSummary};

/// Conservative estimate of vote storage size in bytes for deposit checks.
pub const ESTIMATED_VOTE_BYTES: u64 = 200;

/// Conservative estimate of pending vote storage size in bytes for deposit checks.
pub const ESTIMATED_PENDING_VOTE_BYTES: u64 = 180;

// ==================== Error Constants ====================
// Each constant's value matches its name for stable, greppable error strings.
// Grouped by category; see PRD Section 17 for conditions and per-method mapping.

// Access control
pub const ERR_NOT_ADMIN: &str = "ERR_NOT_ADMIN";
pub const ERR_CANNOT_REMOVE_LAST_ADMIN: &str = "ERR_CANNOT_REMOVE_LAST_ADMIN";

// Proposal lifecycle
pub const ERR_PROPOSAL_NOT_FOUND: &str = "ERR_PROPOSAL_NOT_FOUND";
pub const ERR_PROPOSAL_NOT_ACTIVE: &str = "ERR_PROPOSAL_NOT_ACTIVE";
pub const ERR_PROPOSAL_NOT_PENDING: &str = "ERR_PROPOSAL_NOT_PENDING";
pub const ERR_PROPOSAL_ALREADY_FINALIZED: &str = "ERR_PROPOSAL_ALREADY_FINALIZED";
pub const ERR_PROPOSAL_ALREADY_CANCELLED: &str = "ERR_PROPOSAL_ALREADY_CANCELLED";
pub const ERR_PROPOSAL_NOT_STARTED: &str = "ERR_PROPOSAL_NOT_STARTED";
pub const ERR_PROPOSAL_ENDED: &str = "ERR_PROPOSAL_ENDED";
pub const ERR_PROPOSAL_NOT_EXPIRED: &str = "ERR_PROPOSAL_NOT_EXPIRED";
pub const ERR_FINALIZE_NOT_ENDED: &str = "ERR_FINALIZE_NOT_ENDED";
pub const ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES: &str = "ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES";

// Proposal creation
pub const ERR_TITLE_TOO_LONG: &str = "ERR_TITLE_TOO_LONG";
pub const ERR_AUTHOR_TOO_LONG: &str = "ERR_AUTHOR_TOO_LONG";
pub const ERR_DESCRIPTION_TOO_LONG: &str = "ERR_DESCRIPTION_TOO_LONG";
pub const ERR_INSUFFICIENT_BOND: &str = "ERR_INSUFFICIENT_BOND";
pub const ERR_START_AT_BEFORE_CREATED: &str = "ERR_START_AT_BEFORE_CREATED";
pub const ERR_START_AT_TOO_FAR: &str = "ERR_START_AT_TOO_FAR";

// Voting
pub const ERR_BLOCKLISTED: &str = "ERR_BLOCKLISTED";
pub const ERR_ALREADY_VOTED: &str = "ERR_ALREADY_VOTED";
pub const ERR_VOTE_ALREADY_PENDING: &str = "ERR_VOTE_ALREADY_PENDING";
pub const ERR_INSUFFICIENT_DEPOSIT: &str = "ERR_INSUFFICIENT_DEPOSIT";

// Blocklist
pub const ERR_BLOCKLIST_LOCKED: &str = "ERR_BLOCKLIST_LOCKED";
pub const ERR_BLOCKLIST_OP_PENDING: &str = "ERR_BLOCKLIST_OP_PENDING";
pub const ERR_BLOCKLIST_ACCOUNT_NOT_VERIFIED: &str = "ERR_BLOCKLIST_ACCOUNT_NOT_VERIFIED";
pub const ERR_ACCOUNT_NOT_BLOCKLISTED: &str = "ERR_ACCOUNT_NOT_BLOCKLISTED";

// Config validation (init + update methods)
pub const ERR_NO_ADMINS: &str = "ERR_NO_ADMINS";
pub const ERR_CONFIG_LOCKED: &str = "ERR_CONFIG_LOCKED";
pub const ERR_QUORUM_BPS_OUT_OF_RANGE: &str = "ERR_QUORUM_BPS_OUT_OF_RANGE";
pub const ERR_VOTING_PERIOD_OUT_OF_RANGE: &str = "ERR_VOTING_PERIOD_OUT_OF_RANGE";
pub const ERR_PENDING_EXPIRY_OUT_OF_RANGE: &str = "ERR_PENDING_EXPIRY_OUT_OF_RANGE";
pub const ERR_MIN_BOND_OUT_OF_RANGE: &str = "ERR_MIN_BOND_OUT_OF_RANGE";
pub const ERR_GRACE_PERIOD_OUT_OF_RANGE: &str = "ERR_GRACE_PERIOD_OUT_OF_RANGE";
pub const ERR_MAX_START_DELAY_OUT_OF_RANGE: &str = "ERR_MAX_START_DELAY_OUT_OF_RANGE";

// Admin recovery
pub const ERR_PENDING_VOTE_NOT_FOUND: &str = "ERR_PENDING_VOTE_NOT_FOUND";

// Pagination
pub const ERR_LIMIT_TOO_LARGE: &str = "ERR_LIMIT_TOO_LARGE";

// Callback-phase (logged via env::log_str, not panics — callbacks return false)
pub const ERR_PENDING_VOTE_NOT_FOUND_IN_CALLBACK: &str = "ERR_PENDING_VOTE_NOT_FOUND_IN_CALLBACK";
pub const ERR_SNAPSHOT_CALLBACK_FAILED: &str = "ERR_SNAPSHOT_CALLBACK_FAILED";
pub const ERR_ZERO_SNAPSHOT: &str = "ERR_ZERO_SNAPSHOT";

/// Storage key prefixes for collections. Must remain stable across upgrades.
#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Proposals,
    ProposalVotes { proposal_id: u64 },
    PendingVotes,
    Admins,
    Blocklist,
}

/// Proposal lifecycle status.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    NearSchema,
    Clone,
    Debug,
    PartialEq,
    Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(rename_all = "snake_case")]
#[abi(json)]
#[abi(borsh)]
pub enum ProposalStatus {
    Pending,
    Active,
    Succeeded,
    Failed,
    Cancelled,
}

/// Failure reason when a proposal ends in Failed.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    NearSchema,
    Clone,
    Debug,
    PartialEq,
    Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(rename_all = "snake_case")]
#[abi(json)]
#[abi(borsh)]
pub enum FailureKind {
    QuorumNotMet,
    Rejected,
    PendingExpired,
    ZeroSnapshot,
}

/// Vote choice.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    NearSchema,
    Clone,
    Debug,
    PartialEq,
    Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(json)]
#[abi(borsh)]
pub enum VoteChoice {
    Yes,
    No,
}

/// Reason a vote was rejected during the verification callback.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    NearSchema,
    Clone,
    Debug,
    PartialEq,
    Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(rename_all = "snake_case")]
#[abi(json)]
pub enum VoteRejectionReason {
    ProposalCancelled,
    NotVerified,
    VerifiedAfterCreation,
    ProposalExpired,
    CallbackFailed,
    PostFinalize,
}

/// Reason proposal creation failed during the snapshot callback.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    NearSchema,
    Clone,
    Debug,
    PartialEq,
    Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(rename_all = "snake_case")]
#[abi(json)]
pub enum ProposalCreationFailedReason {
    SnapshotCallbackFailed,
    ZeroSnapshot,
}

/// Governance configuration (admin-managed).
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, NearSchema, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(json)]
#[abi(borsh)]
pub struct Config {
    pub verified_accounts_contract: AccountId,
    pub quorum_bps: u16,
    pub voting_period_secs: u64,
    pub pending_expiry_secs: u64,
    pub min_proposal_bond: U128,
    pub finalize_grace_period_secs: u64,
    pub max_start_delay_secs: u64,
}

/// Proposal record (stored on-chain, includes per-proposal votes map).
#[derive(BorshDeserialize, BorshSerialize, NearSchema, Debug)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(borsh)]
pub struct Proposal {
    pub id: u64,
    pub creator: AccountId,
    pub title: String,
    pub author: String,
    pub description: String,
    pub created_at: u64,
    pub start_at: u64,
    pub ends_at: u64,
    pub pending_expires_at: u64,
    pub status: ProposalStatus,
    pub failure_kind: Option<FailureKind>,
    pub quorum_bps: u16,
    pub snapshot_verified_count: u64,
    pub pending_vote_count: u64,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub votes: IterableMap<AccountId, Vote>,
}

/// Proposal view (JSON-safe output, no embedded votes map).
#[derive(Serialize, Deserialize, NearSchema, Clone, Debug)]
pub struct ProposalView {
    pub id: U64,
    pub creator: AccountId,
    pub title: String,
    pub author: String,
    pub description: String,
    pub created_at: U64,
    pub start_at: U64,
    pub ends_at: U64,
    pub pending_expires_at: U64,
    pub status: ProposalStatus,
    pub failure_kind: Option<FailureKind>,
    pub quorum_bps: u16,
    pub snapshot_verified_count: U64,
    pub pending_vote_count: U64,
    pub yes_votes: U64,
    pub no_votes: U64,
}

/// Vote record (stored in the proposal's IterableMap).
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, NearSchema, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(borsh)]
pub struct Vote {
    pub choice: VoteChoice,
    pub voted_at: u64,
}

/// Vote view (JSON-safe output).
#[derive(Serialize, Deserialize, NearSchema, Clone, Debug)]
pub struct VoteView {
    pub proposal_id: U64,
    pub voter: AccountId,
    pub choice: VoteChoice,
    pub voted_at: U64,
}

/// Pending vote lock recorded during async verification.
/// Captures submission time for deadline checks in the callback.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, NearSchema, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(borsh)]
pub struct PendingVote {
    pub submitted_at: u64,
    pub choice: VoteChoice,
    pub voter_deposit: U128,
}

/// Pending blocklist operation (add-only verification).
/// Ensures only one async blocklist add is in flight.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, NearSchema, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(borsh)]
pub struct PendingBlocklistOp {
    pub account_id: AccountId,
    pub submitted_at: u64,
}

/// Key for the global pending votes map: (proposal_id, voter).
pub type PendingVoteKey = (u64, AccountId);

/// Contract state V1 (current version).
#[near]
pub struct ContractV1 {
    pub config: Config,
    pub proposals: Vector<Proposal>,
    pub pending_votes: LookupMap<PendingVoteKey, PendingVote>,
    pub admins: IterableSet<AccountId>,
    pub blocklist: IterableSet<AccountId>,
    pub pending_blocklist_op: Option<PendingBlocklistOp>,
}

/// Versioned contract state for upgrades (append-only enum).
#[derive(PanicOnDefault)]
#[near(contract_state)]
pub enum VersionedContract {
    V1(ContractV1),
}

/// Contract type alias for the current version.
pub type Contract = ContractV1;

/// Governance events (NEP-297).
#[near(event_json(standard = "citizens-house-vote"))]
pub enum GovernanceEvent {
    #[event_version("1.0.0")]
    ProposalCreated {
        proposal_id: U64,
        creator: AccountId,
        created_at: U64,
        start_at: U64,
        ends_at: U64,
        pending_expires_at: U64,
        quorum_bps: U64,
    },
    #[event_version("1.0.0")]
    ProposalActivated {
        proposal_id: U64,
        snapshot_verified_count: U64,
        quorum_required: U64,
    },
    #[event_version("1.0.0")]
    ProposalCreationFailed {
        proposal_id: U64,
        creator: AccountId,
        reason: ProposalCreationFailedReason,
    },
    #[event_version("1.0.0")]
    ProposalCancelled {
        proposal_id: U64,
        cancelled_by: AccountId,
    },
    #[event_version("1.0.0")]
    ProposalFinalized {
        proposal_id: U64,
        status: ProposalStatus,
        yes_votes: U64,
        no_votes: U64,
        quorum: U64,
        snapshot_verified_count: U64,
    },
    #[event_version("1.0.0")]
    VoteCast {
        proposal_id: U64,
        voter: AccountId,
        choice: VoteChoice,
        voted_at: U64,
    },
    #[event_version("1.0.0")]
    VoteRejected {
        proposal_id: U64,
        voter: AccountId,
        reason: VoteRejectionReason,
    },
    #[event_version("1.0.0")]
    AdminAdded {
        account_id: AccountId,
        added_by: AccountId,
    },
    #[event_version("1.0.0")]
    AdminRemoved {
        account_id: AccountId,
        removed_by: AccountId,
    },
    #[event_version("1.0.0")]
    BlocklistAdded {
        account_id: AccountId,
        added_by: AccountId,
    },
    #[event_version("1.0.0")]
    BlocklistRemoved {
        account_id: AccountId,
        removed_by: AccountId,
    },
    #[event_version("1.0.0")]
    ConfigUpdated {
        quorum_bps: U64,
        voting_period_secs: U64,
        pending_expiry_secs: U64,
        verified_accounts_contract: AccountId,
        min_proposal_bond: U128,
        finalize_grace_period_secs: U64,
        max_start_delay_secs: U64,
        updated_by: AccountId,
    },
    #[event_version("1.0.0")]
    PendingVoteCleared {
        proposal_id: U64,
        account_id: AccountId,
        cleared_by: AccountId,
        deposit_refunded: U128,
    },
    #[event_version("1.0.0")]
    PendingProposalExpired {
        proposal_id: U64,
        expired_by: AccountId,
    },
}

/// Callback interface for self-calls.
#[ext_contract(ext_self)]
pub trait GovernanceCallbacks {
    /// Snapshot callback after get_verified_count().
    fn on_snapshot(&mut self, proposal_id: U64) -> bool;

    /// Vote verification callback after get_verification().
    fn on_vote_verification(&mut self, proposal_id: U64, voter: AccountId) -> bool;

    /// Blocklist verification callback after get_verification().
    fn on_blocklist_verification(&mut self, account_id: AccountId) -> bool;
}

#[near]
impl VersionedContract {
    fn contract(&self) -> &ContractV1 {
        match self {
            VersionedContract::V1(contract) => contract,
        }
    }

    fn contract_mut(&mut self) -> &mut ContractV1 {
        match self {
            VersionedContract::V1(contract) => contract,
        }
    }

    /// Initialize contract state and configuration.
    /// Must validate bounds, set admins, and initialize empty collections.
    #[init]
    pub fn new(
        verified_accounts_contract: AccountId,
        admins: Vec<AccountId>,
        quorum_bps: u16,
        voting_period_secs: u64,
        pending_expiry_secs: u64,
        min_proposal_bond: U128,
        finalize_grace_period_secs: u64,
        max_start_delay_secs: u64,
    ) -> Self {
        unimplemented!("initialize contract state with config, admins, and empty collections");
    }

    /// One-time state migration after deploying new code.
    /// Must be admin-only with one-yocto in the implementation.
    #[init(ignore_state)]
    pub fn migrate() -> Self {
        unimplemented!("migrate contract state to latest version");
    }

    // ==================== Admin Management ====================

    /// Add an admin account (requires one yoctoNEAR and admin caller).
    #[payable]
    pub fn add_admin(&mut self, account_id: AccountId) {
        unimplemented!("add admin");
    }

    /// Remove an admin account (requires one yoctoNEAR and admin caller).
    #[payable]
    pub fn remove_admin(&mut self, account_id: AccountId) {
        unimplemented!("remove admin");
    }

    /// Returns true if the account is an admin.
    pub fn is_admin(&self, account_id: AccountId) -> bool {
        unimplemented!("check admin membership");
    }

    /// List admins with pagination.
    pub fn list_admins(&self, from_index: U64, limit: u64) -> Vec<AccountId> {
        unimplemented!("list admins");
    }

    // ==================== Proposal Management ====================

    /// Create a proposal (admin-only) with optional start time.
    /// Stores a Pending proposal, triggers snapshot, and returns proposal id.
    /// Enforces bond minimum, start_at bounds, and blocklist/pending-op locks.
    /// Snapshot callback must fail if verified_count == 0 or effective snapshot is zero
    /// after subtracting blocklist size at callback time.
    #[payable]
    pub fn create_proposal(
        &mut self,
        title: String,
        author: String,
        description: String,
        start_at: Option<U64>,
    ) -> U64 {
        unimplemented!("create proposal and initiate snapshot");
    }

    /// Cancel a proposal (admin-only, one yoctoNEAR). Does not clear pending votes.
    /// Cancellation is allowed after ends_at (until finalized).
    #[payable]
    pub fn cancel_proposal(&mut self, proposal_id: U64) {
        unimplemented!("cancel proposal");
    }

    /// Expire a pending proposal past pending_expires_at (admin-only).
    #[payable]
    pub fn expire_pending_proposal(&mut self, proposal_id: U64) {
        unimplemented!("expire pending proposal");
    }

    /// Clear a stuck pending vote lock and refund any deposit (admin-only).
    #[payable]
    pub fn clear_stale_pending_vote(&mut self, proposal_id: U64, account_id: AccountId) {
        unimplemented!("clear stale pending vote");
    }

    /// Finalize an active proposal after ends_at.
    /// Must respect pending-vote grace period and emit final status.
    /// Pending votes after the grace period are abandoned and do not count.
    pub fn finalize_proposal(&mut self, proposal_id: U64) {
        unimplemented!("finalize proposal");
    }

    /// Get a proposal by id (JSON-safe view).
    pub fn get_proposal(&self, proposal_id: U64) -> Option<ProposalView> {
        unimplemented!("get proposal");
    }

    /// List proposals with pagination.
    pub fn list_proposals(&self, from_index: U64, limit: u64) -> Vec<ProposalView> {
        unimplemented!("list proposals");
    }

    /// Return total number of proposals created (proposals.len()).
    pub fn get_proposal_count(&self) -> U64 {
        unimplemented!("get proposal count");
    }

    /// Return the pending vote count for a proposal.
    pub fn get_pending_votes_count(&self, proposal_id: U64) -> U64 {
        unimplemented!("get pending votes count");
    }

    // ==================== Voting ====================

    /// Cast a vote on an active proposal (verified-only).
    /// Records PendingVote before async verification and enforces storage-deposit rules.
    /// Must reject if a final vote already exists for (proposal_id, voter).
    #[payable]
    pub fn cast_vote(&mut self, proposal_id: U64, choice: VoteChoice) {
        unimplemented!("cast vote and initiate verification callback");
    }

    /// Check whether an account has voted for a proposal.
    pub fn has_voted(&self, proposal_id: U64, account_id: AccountId) -> bool {
        unimplemented!("check if account has voted");
    }

    /// Get a single vote for a proposal.
    pub fn get_vote(&self, proposal_id: U64, account_id: AccountId) -> Option<VoteView> {
        unimplemented!("get vote");
    }

    /// List votes for a proposal with pagination.
    pub fn list_votes(&self, proposal_id: U64, from_index: U64, limit: u64) -> Vec<VoteView> {
        unimplemented!("list votes");
    }

    /// Returns whether the contract can cover vote storage without deposit.
    /// Balance-only hint; may change before the vote is recorded.
    pub fn is_vote_free(&self, proposal_id: U64) -> bool {
        unimplemented!("check if vote is free");
    }

    // ==================== Blocklist ====================

    /// Add an account to the blocklist (admin-only) using async verification.
    /// Rejects if any proposal is Pending/Active or a blocklist op is pending.
    /// Uses get_verification(account_id) for the verification check.
    #[payable]
    pub fn blocklist_account(&mut self, account_id: AccountId) {
        unimplemented!("blocklist account and initiate verification callback");
    }

    /// Remove an account from the blocklist (admin-only).
    /// Rejects if any proposal is Pending/Active or a blocklist op is pending.
    #[payable]
    pub fn unblocklist_account(&mut self, account_id: AccountId) {
        unimplemented!("unblocklist account");
    }

    /// Returns true if the account is blocklisted.
    pub fn is_blocklisted(&self, account_id: AccountId) -> bool {
        unimplemented!("check blocklist membership");
    }

    /// List blocklisted accounts with pagination.
    pub fn list_blocklist(&self, from_index: U64, limit: u64) -> Vec<AccountId> {
        unimplemented!("list blocklist");
    }

    /// Returns true if blocklist changes are currently locked.
    pub fn is_blocklist_locked(&self) -> bool {
        unimplemented!("check blocklist lock");
    }

    // ==================== Configuration ====================

    /// Update quorum basis points (admin-only).
    #[payable]
    pub fn update_quorum_bps(&mut self, new_bps: u16) {
        unimplemented!("update quorum bps");
    }

    /// Update voting period (admin-only, locked during Pending/Active proposals).
    #[payable]
    pub fn update_voting_period_secs(&mut self, new_period_secs: u64) {
        unimplemented!("update voting period");
    }

    /// Update pending expiry (admin-only).
    #[payable]
    pub fn update_pending_expiry_secs(&mut self, new_period_secs: u64) {
        unimplemented!("update pending expiry");
    }

    /// Update verified accounts contract address (admin-only, locked during Pending/Active).
    #[payable]
    pub fn update_verified_accounts_contract(&mut self, new_contract: AccountId) {
        unimplemented!("update verified accounts contract");
    }

    /// Update minimum proposal bond (admin-only).
    #[payable]
    pub fn update_min_proposal_bond(&mut self, new_min: U128) {
        unimplemented!("update min proposal bond");
    }

    /// Update finalize grace period (admin-only).
    #[payable]
    pub fn update_finalize_grace_period_secs(&mut self, new_period_secs: u64) {
        unimplemented!("update finalize grace period");
    }

    /// Update max start delay (admin-only).
    #[payable]
    pub fn update_max_start_delay_secs(&mut self, new_period_secs: u64) {
        unimplemented!("update max start delay");
    }

    /// Return current configuration.
    pub fn get_config(&self) -> Config {
        unimplemented!("get config");
    }

    // ==================== Callbacks (Private) ====================

    /// Snapshot callback after get_verified_count().
    /// Activates or fails the proposal and emits the correct event.
    /// Must fail if verified_count == 0 or effective snapshot is zero after blocklist subtraction.
    #[private]
    pub fn on_snapshot(&mut self, proposal_id: U64) -> bool {
        unimplemented!("snapshot callback");
    }

    /// Vote verification callback after get_verification().
    /// Validates timing, updates tallies, clears lock, and refunds as needed.
    #[private]
    pub fn on_vote_verification(&mut self, proposal_id: U64, voter: AccountId) -> bool {
        unimplemented!("vote verification callback");
    }

    /// Blocklist verification callback after get_verification().
    /// Clears pending op and adds to blocklist only if verified.
    #[private]
    pub fn on_blocklist_verification(&mut self, account_id: AccountId) -> bool {
        unimplemented!("blocklist verification callback");
    }
}
