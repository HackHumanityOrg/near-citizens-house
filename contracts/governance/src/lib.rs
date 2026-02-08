//! # Citizens House Governance Contract
//!
//! On-chain governance for NEAR Citizens House proposals and voting.
//! See VOTING_PRD_UPDATED.md for the full specification.

#![allow(clippy::too_many_arguments)]

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::{U128, U64};
use near_sdk::store::{IterableMap, IterableSet, LookupMap, Vector};
use near_sdk::{
    assert_one_yocto, env, ext_contract, near, require, AccountId, BorshStorageKey, Gas,
    NearSchema, NearToken, PanicOnDefault, Promise, PromiseError,
};
use serde::{Deserialize, Serialize};

pub mod interface;
pub use interface::{ext_verified_accounts, VerificationSummary};

// ==================== Gas Constants ====================

const GAS_FOR_SNAPSHOT_CALLBACK: Gas = Gas::from_tgas(20);
const GAS_FOR_VOTE_CALLBACK: Gas = Gas::from_tgas(30);
const GAS_FOR_BLOCKLIST_CALLBACK: Gas = Gas::from_tgas(20);

// ==================== Validation Constants ====================

/// Conservative estimate of vote storage size in bytes for deposit checks.
pub const ESTIMATED_VOTE_BYTES: u64 = 200;

/// Conservative estimate of pending vote storage size in bytes for deposit checks.
pub const ESTIMATED_PENDING_VOTE_BYTES: u64 = 180;

const MAX_TITLE_LEN: usize = 140;
const MAX_AUTHOR_LEN: usize = 120;
const MAX_DESCRIPTION_LEN: usize = 10_000;
const MAX_PAGINATION_LIMIT: u32 = 100;

const MIN_QUORUM_BPS: u16 = 1;
const MAX_QUORUM_BPS: u16 = 10_000;

const MIN_VOTING_PERIOD_SECS: u64 = 86_400; // 1 day
const MAX_VOTING_PERIOD_SECS: u64 = 7_776_000; // 90 days

const MIN_PENDING_EXPIRY_SECS: u64 = 300; // 5 minutes
const MAX_PENDING_EXPIRY_SECS: u64 = 86_400; // 1 day

const MIN_BOND_YOCTO: u128 = 1_000_000_000_000_000_000_000_000; // 1 NEAR
const MAX_BOND_YOCTO: u128 = 100_000_000_000_000_000_000_000_000; // 100 NEAR

const MIN_GRACE_PERIOD_SECS: u64 = 300; // 5 minutes
const MAX_GRACE_PERIOD_SECS: u64 = 86_400; // 1 day

const MAX_START_DELAY_SECS: u64 = 7_776_000; // 90 days

const NANOS_PER_SEC: u64 = 1_000_000_000;

// ==================== Error Constants ====================

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

// Proposal field validation
pub const ERR_TITLE_EMPTY: &str = "ERR_TITLE_EMPTY";
pub const ERR_AUTHOR_EMPTY: &str = "ERR_AUTHOR_EMPTY";
pub const ERR_DESCRIPTION_EMPTY: &str = "ERR_DESCRIPTION_EMPTY";

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
    ProposalVotes { proposal_id: u32 },
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
    SnapshotCallbackFailed,
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
#[serde(rename_all = "snake_case")]
#[abi(json)]
#[abi(borsh)]
pub enum VoteChoice {
    Yes,
    No,
}

/// Reason a vote was rejected during the verification callback.
#[derive(Serialize, Deserialize, NearSchema, Clone, Debug, PartialEq, Eq)]
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
#[derive(Serialize, Deserialize, NearSchema, Clone, Debug, PartialEq, Eq)]
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
    pub voting_period_secs: U64,
    pub pending_expiry_secs: U64,
    pub min_proposal_bond: U128,
    pub finalize_grace_period_secs: U64,
    pub max_start_delay_secs: U64,
}

/// Proposal record (stored on-chain, includes per-proposal votes map).
#[derive(BorshDeserialize, BorshSerialize, NearSchema, Debug)]
#[borsh(crate = "near_sdk::borsh")]
#[abi(borsh)]
pub struct Proposal {
    pub id: u32,
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
    pub id: u32,
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
    pub proposal_id: u32,
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
    pub initiated_by: AccountId,
}

/// Key for the global pending votes map: (proposal_id, voter).
pub type PendingVoteKey = (u32, AccountId);

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
        proposal_id: u32,
        creator: AccountId,
        created_at: U64,
        start_at: U64,
        ends_at: U64,
        pending_expires_at: U64,
        quorum_bps: u16,
    },
    #[event_version("1.0.0")]
    ProposalActivated {
        proposal_id: u32,
        snapshot_verified_count: U64,
        quorum_required: U64,
    },
    #[event_version("1.0.0")]
    ProposalCreationFailed {
        proposal_id: u32,
        reason: ProposalCreationFailedReason,
    },
    #[event_version("1.0.0")]
    ProposalCancelled {
        proposal_id: u32,
        cancelled_by: AccountId,
    },
    #[event_version("1.0.0")]
    ProposalFinalized {
        proposal_id: u32,
        status: ProposalStatus,
        yes_votes: U64,
        no_votes: U64,
        quorum: U64,
        snapshot_verified_count: U64,
    },
    #[event_version("1.0.0")]
    VoteCast {
        proposal_id: u32,
        voter: AccountId,
        choice: VoteChoice,
        voted_at: U64,
    },
    #[event_version("1.0.0")]
    VoteRejected {
        proposal_id: u32,
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
        quorum_bps: u16,
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
        proposal_id: u32,
        account_id: AccountId,
        cleared_by: AccountId,
        deposit_refunded: U128,
    },
    #[event_version("1.0.0")]
    PendingProposalExpired {
        proposal_id: u32,
        expired_by: AccountId,
    },
}

/// Callback interface for self-calls.
#[ext_contract(ext_self)]
pub trait GovernanceCallbacks {
    /// Snapshot callback after get_verified_count().
    fn on_snapshot(&mut self, proposal_id: u32) -> bool;

    /// Vote verification callback after get_verification().
    fn on_vote_verification(&mut self, proposal_id: u32, voter: AccountId) -> bool;

    /// Blocklist verification callback after get_verification().
    fn on_blocklist_verification(&mut self, account_id: AccountId) -> bool;
}

// ==================== Private Helper Methods ====================

impl VersionedContract {
    fn assert_admin(&self) {
        let contract = self.contract();
        require!(
            contract.admins.contains(&env::predecessor_account_id()),
            ERR_NOT_ADMIN
        );
    }

    fn has_pending_or_active_proposals(&self) -> bool {
        let contract = self.contract();
        let len = contract.proposals.len();
        for i in 0..len {
            if let Some(proposal) = contract.proposals.get(i) {
                match proposal.status {
                    ProposalStatus::Pending | ProposalStatus::Active => return true,
                    _ => {}
                }
            }
        }
        false
    }

    fn require_quorum_count(snapshot: u64, bps: u16) -> u64 {
        // ceil(snapshot * bps / 10_000)
        let numerator = snapshot
            .checked_mul(bps as u64)
            .unwrap_or_else(|| env::panic_str("quorum overflow"));
        // ceil division: (n + d - 1) / d
        numerator
            .checked_add(9_999)
            .unwrap_or_else(|| env::panic_str("quorum overflow"))
            / 10_000
    }

    fn proposal_to_view(proposal: &Proposal) -> ProposalView {
        ProposalView {
            id: proposal.id,
            creator: proposal.creator.clone(),
            title: proposal.title.clone(),
            author: proposal.author.clone(),
            description: proposal.description.clone(),
            created_at: U64(proposal.created_at),
            start_at: U64(proposal.start_at),
            ends_at: U64(proposal.ends_at),
            pending_expires_at: U64(proposal.pending_expires_at),
            status: proposal.status.clone(),
            failure_kind: proposal.failure_kind.clone(),
            quorum_bps: proposal.quorum_bps,
            snapshot_verified_count: U64(proposal.snapshot_verified_count),
            pending_vote_count: U64(proposal.pending_vote_count),
            yes_votes: U64(proposal.yes_votes),
            no_votes: U64(proposal.no_votes),
        }
    }

    fn emit_config_updated(config: &Config) {
        GovernanceEvent::ConfigUpdated {
            quorum_bps: config.quorum_bps,
            voting_period_secs: config.voting_period_secs,
            pending_expiry_secs: config.pending_expiry_secs,
            verified_accounts_contract: config.verified_accounts_contract.clone(),
            min_proposal_bond: config.min_proposal_bond,
            finalize_grace_period_secs: config.finalize_grace_period_secs,
            max_start_delay_secs: config.max_start_delay_secs,
            updated_by: env::predecessor_account_id(),
        }
        .emit();
    }
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

    // ==================== Init / Migrate ====================

    #[init]
    pub fn new(
        verified_accounts_contract: AccountId,
        admins: Vec<AccountId>,
        quorum_bps: u16,
        voting_period_secs: U64,
        pending_expiry_secs: U64,
        min_proposal_bond: U128,
        finalize_grace_period_secs: U64,
        max_start_delay_secs: U64,
    ) -> Self {
        require!(!admins.is_empty(), ERR_NO_ADMINS);
        require!(
            (MIN_QUORUM_BPS..=MAX_QUORUM_BPS).contains(&quorum_bps),
            ERR_QUORUM_BPS_OUT_OF_RANGE
        );
        require!(
            (MIN_VOTING_PERIOD_SECS..=MAX_VOTING_PERIOD_SECS).contains(&voting_period_secs.0),
            ERR_VOTING_PERIOD_OUT_OF_RANGE
        );
        require!(
            (MIN_PENDING_EXPIRY_SECS..=MAX_PENDING_EXPIRY_SECS).contains(&pending_expiry_secs.0),
            ERR_PENDING_EXPIRY_OUT_OF_RANGE
        );
        require!(
            (MIN_BOND_YOCTO..=MAX_BOND_YOCTO).contains(&min_proposal_bond.0),
            ERR_MIN_BOND_OUT_OF_RANGE
        );
        require!(
            (MIN_GRACE_PERIOD_SECS..=MAX_GRACE_PERIOD_SECS).contains(&finalize_grace_period_secs.0),
            ERR_GRACE_PERIOD_OUT_OF_RANGE
        );
        require!(
            max_start_delay_secs.0 <= MAX_START_DELAY_SECS,
            ERR_MAX_START_DELAY_OUT_OF_RANGE
        );

        let mut admin_set = IterableSet::new(StorageKey::Admins);
        for admin in admins {
            admin_set.insert(admin);
        }

        VersionedContract::V1(ContractV1 {
            config: Config {
                verified_accounts_contract,
                quorum_bps,
                voting_period_secs,
                pending_expiry_secs,
                min_proposal_bond,
                finalize_grace_period_secs,
                max_start_delay_secs,
            },
            proposals: Vector::new(StorageKey::Proposals),
            pending_votes: LookupMap::new(StorageKey::PendingVotes),
            admins: admin_set,
            blocklist: IterableSet::new(StorageKey::Blocklist),
            pending_blocklist_op: None,
        })
    }

    #[init(ignore_state)]
    #[payable]
    pub fn migrate() -> Self {
        assert_one_yocto();
        let old_state: VersionedContract =
            env::state_read().unwrap_or_else(|| env::panic_str("ERR_NO_STATE"));
        require!(
            old_state
                .contract()
                .admins
                .contains(&env::predecessor_account_id()),
            ERR_NOT_ADMIN
        );
        old_state
    }

    // ==================== Admin Management ====================

    #[payable]
    pub fn add_admin(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_admin();
        let contract = self.contract_mut();
        contract.admins.insert(account_id.clone());
        GovernanceEvent::AdminAdded {
            account_id,
            added_by: env::predecessor_account_id(),
        }
        .emit();
    }

    #[payable]
    pub fn remove_admin(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_admin();
        let contract = self.contract_mut();
        require!(contract.admins.len() > 1, ERR_CANNOT_REMOVE_LAST_ADMIN);
        contract.admins.remove(&account_id);
        GovernanceEvent::AdminRemoved {
            account_id,
            removed_by: env::predecessor_account_id(),
        }
        .emit();
    }

    pub fn is_admin(&self, account_id: AccountId) -> bool {
        self.contract().admins.contains(&account_id)
    }

    pub fn list_admins(&self, from_index: u32, limit: u32) -> Vec<AccountId> {
        require!(limit <= MAX_PAGINATION_LIMIT, ERR_LIMIT_TOO_LARGE);
        let contract = self.contract();
        contract
            .admins
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .cloned()
            .collect()
    }

    // ==================== Proposal Management ====================

    #[payable]
    pub fn create_proposal(
        &mut self,
        title: String,
        author: String,
        description: String,
        start_at: Option<U64>,
    ) -> u32 {
        self.assert_admin();

        // Validate field lengths
        require!(!title.is_empty(), ERR_TITLE_EMPTY);
        require!(!author.is_empty(), ERR_AUTHOR_EMPTY);
        require!(!description.is_empty(), ERR_DESCRIPTION_EMPTY);
        require!(title.len() <= MAX_TITLE_LEN, ERR_TITLE_TOO_LONG);
        require!(author.len() <= MAX_AUTHOR_LEN, ERR_AUTHOR_TOO_LONG);
        require!(
            description.len() <= MAX_DESCRIPTION_LEN,
            ERR_DESCRIPTION_TOO_LONG
        );

        // Validate bond
        let deposit = env::attached_deposit();
        let contract = self.contract();
        require!(
            deposit.as_yoctonear() >= contract.config.min_proposal_bond.0,
            ERR_INSUFFICIENT_BOND
        );

        // No blocklist op may be pending
        require!(
            contract.pending_blocklist_op.is_none(),
            ERR_BLOCKLIST_OP_PENDING
        );

        let now = env::block_timestamp();
        let created_at = now;

        // Compute start_at
        let effective_start_at = match start_at {
            Some(s) => s.0,
            None => now,
        };

        // Validate start_at bounds
        require!(
            effective_start_at >= created_at,
            ERR_START_AT_BEFORE_CREATED
        );
        let max_start_nanos = created_at
            .checked_add(
                contract
                    .config
                    .max_start_delay_secs
                    .0
                    .checked_mul(NANOS_PER_SEC)
                    .unwrap_or_else(|| env::panic_str("start delay overflow")),
            )
            .unwrap_or_else(|| env::panic_str("start delay overflow"));
        require!(effective_start_at <= max_start_nanos, ERR_START_AT_TOO_FAR);

        // Compute ends_at and pending_expires_at
        let ends_at = effective_start_at
            .checked_add(
                contract
                    .config
                    .voting_period_secs
                    .0
                    .checked_mul(NANOS_PER_SEC)
                    .unwrap_or_else(|| env::panic_str("voting period overflow")),
            )
            .unwrap_or_else(|| env::panic_str("voting period overflow"));
        let pending_expires_at = now
            .checked_add(
                contract
                    .config
                    .pending_expiry_secs
                    .0
                    .checked_mul(NANOS_PER_SEC)
                    .unwrap_or_else(|| env::panic_str("pending expiry overflow")),
            )
            .unwrap_or_else(|| env::panic_str("pending expiry overflow"));

        let quorum_bps = contract.config.quorum_bps;
        let verified_accounts_contract = contract.config.verified_accounts_contract.clone();

        // Build proposal
        let contract = self.contract_mut();
        let proposal_id = contract.proposals.len();
        let creator = env::predecessor_account_id();

        contract.proposals.push(Proposal {
            id: proposal_id,
            creator: creator.clone(),
            title,
            author,
            description,
            created_at,
            start_at: effective_start_at,
            ends_at,
            pending_expires_at,
            status: ProposalStatus::Pending,
            failure_kind: None,
            quorum_bps,
            snapshot_verified_count: 0,
            pending_vote_count: 0,
            yes_votes: 0,
            no_votes: 0,
            votes: IterableMap::new(StorageKey::ProposalVotes { proposal_id }),
        });

        // Flush before cross-contract call
        contract.proposals.flush();

        GovernanceEvent::ProposalCreated {
            proposal_id,
            creator,
            created_at: U64(created_at),
            start_at: U64(effective_start_at),
            ends_at: U64(ends_at),
            pending_expires_at: U64(pending_expires_at),
            quorum_bps,
        }
        .emit();

        // Cross-contract: get_verified_count -> on_snapshot
        ext_verified_accounts::ext(verified_accounts_contract)
            .get_verified_count()
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_SNAPSHOT_CALLBACK)
                    .on_snapshot(proposal_id),
            )
            .detach();

        proposal_id
    }

    #[payable]
    pub fn cancel_proposal(&mut self, proposal_id: u32) {
        assert_one_yocto();
        self.assert_admin();
        let contract = self.contract_mut();
        let proposal = contract
            .proposals
            .get_mut(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        match proposal.status {
            ProposalStatus::Succeeded | ProposalStatus::Failed => {
                env::panic_str(ERR_PROPOSAL_ALREADY_FINALIZED);
            }
            ProposalStatus::Cancelled => {
                env::panic_str(ERR_PROPOSAL_ALREADY_CANCELLED);
            }
            ProposalStatus::Pending | ProposalStatus::Active => {}
        }
        proposal.status = ProposalStatus::Cancelled;
        GovernanceEvent::ProposalCancelled {
            proposal_id,
            cancelled_by: env::predecessor_account_id(),
        }
        .emit();
    }

    #[payable]
    pub fn expire_pending_proposal(&mut self, proposal_id: u32) {
        assert_one_yocto();
        self.assert_admin();
        let now = env::block_timestamp();
        let contract = self.contract_mut();
        let proposal = contract
            .proposals
            .get_mut(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        require!(
            proposal.status == ProposalStatus::Pending,
            ERR_PROPOSAL_NOT_PENDING
        );
        require!(now >= proposal.pending_expires_at, ERR_PROPOSAL_NOT_EXPIRED);
        proposal.status = ProposalStatus::Failed;
        proposal.failure_kind = Some(FailureKind::PendingExpired);
        GovernanceEvent::PendingProposalExpired {
            proposal_id,
            expired_by: env::predecessor_account_id(),
        }
        .emit();
    }

    #[payable]
    pub fn clear_stale_pending_vote(&mut self, proposal_id: u32, account_id: AccountId) {
        assert_one_yocto();
        self.assert_admin();
        let contract = self.contract_mut();

        // Verify proposal exists
        let _proposal = contract
            .proposals
            .get(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));

        // Remove pending vote
        let key = (proposal_id, account_id.clone());
        let pending_vote = contract
            .pending_votes
            .remove(&key)
            .unwrap_or_else(|| env::panic_str(ERR_PENDING_VOTE_NOT_FOUND));

        // Decrement pending_vote_count
        let proposal = contract
            .proposals
            .get_mut(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        proposal.pending_vote_count = proposal.pending_vote_count.saturating_sub(1);

        let deposit_refunded = pending_vote.voter_deposit;

        GovernanceEvent::PendingVoteCleared {
            proposal_id,
            account_id: account_id.clone(),
            cleared_by: env::predecessor_account_id(),
            deposit_refunded,
        }
        .emit();

        // Refund deposit if any
        if deposit_refunded.0 > 0 {
            Promise::new(account_id).transfer(NearToken::from_yoctonear(deposit_refunded.0)).detach();
        }
    }

    pub fn finalize_proposal(&mut self, proposal_id: u32) {
        let now = env::block_timestamp();
        let contract = self.contract_mut();
        let proposal = contract
            .proposals
            .get_mut(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));

        require!(
            proposal.status == ProposalStatus::Active,
            ERR_PROPOSAL_NOT_ACTIVE
        );
        require!(now > proposal.ends_at, ERR_FINALIZE_NOT_ENDED);

        // Grace period check for pending votes
        if proposal.pending_vote_count > 0 {
            let grace_deadline = proposal
                .ends_at
                .checked_add(
                    contract
                        .config
                        .finalize_grace_period_secs
                        .0
                        .checked_mul(NANOS_PER_SEC)
                        .unwrap_or_else(|| env::panic_str("grace period overflow")),
                )
                .unwrap_or_else(|| env::panic_str("grace period overflow"));
            require!(
                now >= grace_deadline,
                ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES
            );
        }

        // Defensive: zero-snapshot proposals should never be Active, but guard finalize
        if proposal.snapshot_verified_count == 0 {
            proposal.status = ProposalStatus::Failed;
            proposal.failure_kind = Some(FailureKind::ZeroSnapshot);
            GovernanceEvent::ProposalFinalized {
                proposal_id,
                status: ProposalStatus::Failed,
                yes_votes: U64(proposal.yes_votes),
                no_votes: U64(proposal.no_votes),
                quorum: U64(0),
                snapshot_verified_count: U64(0),
            }
            .emit();
            return;
        }

        // Compute quorum
        let quorum_required =
            Self::require_quorum_count(proposal.snapshot_verified_count, proposal.quorum_bps);

        let total_votes = proposal
            .yes_votes
            .checked_add(proposal.no_votes)
            .unwrap_or_else(|| env::panic_str("vote count overflow"));

        let (status, failure_kind) = if total_votes < quorum_required {
            (ProposalStatus::Failed, Some(FailureKind::QuorumNotMet))
        } else if proposal.yes_votes >= proposal.no_votes {
            (ProposalStatus::Succeeded, None)
        } else {
            (ProposalStatus::Failed, Some(FailureKind::Rejected))
        };

        proposal.status = status.clone();
        proposal.failure_kind = failure_kind;

        GovernanceEvent::ProposalFinalized {
            proposal_id,
            status,
            yes_votes: U64(proposal.yes_votes),
            no_votes: U64(proposal.no_votes),
            quorum: U64(quorum_required),
            snapshot_verified_count: U64(proposal.snapshot_verified_count),
        }
        .emit();
    }

    pub fn get_proposal(&self, proposal_id: u32) -> Option<ProposalView> {
        let contract = self.contract();
        contract
            .proposals
            .get(proposal_id)
            .map(Self::proposal_to_view)
    }

    pub fn list_proposals(&self, from_index: u32, limit: u32) -> Vec<ProposalView> {
        require!(limit <= MAX_PAGINATION_LIMIT, ERR_LIMIT_TOO_LARGE);
        let contract = self.contract();
        let len = contract.proposals.len();
        let start = from_index;
        let end = len.min(
            start
                .checked_add(limit)
                .unwrap_or_else(|| env::panic_str("pagination overflow")),
        );
        let mut result = Vec::with_capacity(end.saturating_sub(start) as usize);
        let mut i = start;
        while i < end {
            if let Some(proposal) = contract.proposals.get(i) {
                result.push(Self::proposal_to_view(proposal));
            }
            i = i.checked_add(1).unwrap_or_else(|| env::panic_str("overflow"));
        }
        result
    }

    pub fn get_proposal_count(&self) -> u32 {
        self.contract().proposals.len()
    }

    pub fn get_pending_votes_count(&self, proposal_id: u32) -> U64 {
        let contract = self.contract();
        let proposal = contract
            .proposals
            .get(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        U64(proposal.pending_vote_count)
    }

    // ==================== Voting ====================

    #[payable]
    pub fn cast_vote(&mut self, proposal_id: u32, choice: VoteChoice) {
        let voter = env::predecessor_account_id();
        let deposit = env::attached_deposit();
        let now = env::block_timestamp();

        let contract = self.contract();

        // Check proposal exists and is active
        let proposal = contract
            .proposals
            .get(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        require!(
            proposal.status == ProposalStatus::Active,
            ERR_PROPOSAL_NOT_ACTIVE
        );
        require!(now >= proposal.start_at, ERR_PROPOSAL_NOT_STARTED);
        require!(now <= proposal.ends_at, ERR_PROPOSAL_ENDED);

        // Check not blocklisted
        require!(!contract.blocklist.contains(&voter), ERR_BLOCKLISTED);

        // Check no existing final vote
        require!(!proposal.votes.contains_key(&voter), ERR_ALREADY_VOTED);

        // Check no pending vote
        let pending_key = (proposal_id, voter.clone());
        require!(
            !contract.pending_votes.contains_key(&pending_key),
            ERR_VOTE_ALREADY_PENDING
        );

        // Storage deposit check: covers both PendingVote (temporary) and Vote (permanent).
        // Excess is refunded after the callback measures actual storage delta.
        let estimated_bytes = ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES;
        let storage_cost = env::storage_byte_cost().saturating_mul(estimated_bytes as u128);
        let available = NearToken::from_yoctonear(
            env::account_balance()
                .as_yoctonear()
                .saturating_sub(
                    env::storage_byte_cost()
                        .saturating_mul(env::storage_usage() as u128)
                        .as_yoctonear(),
                ),
        );

        if available.as_yoctonear() < storage_cost.as_yoctonear() {
            require!(
                deposit.as_yoctonear() >= storage_cost.as_yoctonear(),
                ERR_INSUFFICIENT_DEPOSIT
            );
        }

        let verified_accounts_contract = contract.config.verified_accounts_contract.clone();

        // Record pending vote
        let contract = self.contract_mut();
        contract.pending_votes.set(
            (proposal_id, voter.clone()),
            Some(PendingVote {
                submitted_at: now,
                choice,
                voter_deposit: U128(deposit.as_yoctonear()),
            }),
        );

        // Increment pending_vote_count
        let proposal = contract
            .proposals
            .get_mut(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        proposal.pending_vote_count = proposal
            .pending_vote_count
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str("pending vote count overflow"));

        // Flush before cross-contract call
        contract.pending_votes.flush();
        contract.proposals.flush();

        // Cross-contract: get_verification -> on_vote_verification
        ext_verified_accounts::ext(verified_accounts_contract)
            .get_verification(voter.clone())
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_VOTE_CALLBACK)
                    .on_vote_verification(proposal_id, voter),
            )
            .detach();
    }

    pub fn has_voted(&self, proposal_id: u32, account_id: AccountId) -> bool {
        let contract = self.contract();
        let proposal = contract
            .proposals
            .get(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        proposal.votes.contains_key(&account_id)
    }

    pub fn get_vote(&self, proposal_id: u32, account_id: AccountId) -> Option<VoteView> {
        let contract = self.contract();
        let proposal = contract
            .proposals
            .get(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        proposal.votes.get(&account_id).map(|vote| VoteView {
            proposal_id,
            voter: account_id,
            choice: vote.choice.clone(),
            voted_at: U64(vote.voted_at),
        })
    }

    pub fn list_votes(&self, proposal_id: u32, from_index: u32, limit: u32) -> Vec<VoteView> {
        require!(limit <= MAX_PAGINATION_LIMIT, ERR_LIMIT_TOO_LARGE);
        let contract = self.contract();
        let proposal = contract
            .proposals
            .get(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        proposal
            .votes
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|(voter, vote)| VoteView {
                proposal_id,
                voter: voter.clone(),
                choice: vote.choice.clone(),
                voted_at: U64(vote.voted_at),
            })
            .collect()
    }

    pub fn is_vote_free(&self, _proposal_id: u32) -> bool {
        let estimated_bytes = ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES;
        let storage_cost = env::storage_byte_cost().saturating_mul(estimated_bytes as u128);
        let available = NearToken::from_yoctonear(
            env::account_balance()
                .as_yoctonear()
                .saturating_sub(
                    env::storage_byte_cost()
                        .saturating_mul(env::storage_usage() as u128)
                        .as_yoctonear(),
                ),
        );
        available.as_yoctonear() >= storage_cost.as_yoctonear()
    }

    // ==================== Blocklist ====================

    #[payable]
    pub fn blocklist_account(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            !self.has_pending_or_active_proposals(),
            ERR_BLOCKLIST_LOCKED
        );
        let contract = self.contract();
        require!(
            contract.pending_blocklist_op.is_none(),
            ERR_BLOCKLIST_OP_PENDING
        );
        let verified_accounts_contract = contract.config.verified_accounts_contract.clone();
        let initiated_by = env::predecessor_account_id();

        let contract = self.contract_mut();
        contract.pending_blocklist_op = Some(PendingBlocklistOp {
            account_id: account_id.clone(),
            submitted_at: env::block_timestamp(),
            initiated_by,
        });

        // Cross-contract: get_verification -> on_blocklist_verification
        ext_verified_accounts::ext(verified_accounts_contract)
            .get_verification(account_id.clone())
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_BLOCKLIST_CALLBACK)
                    .on_blocklist_verification(account_id),
            )
            .detach();
    }

    #[payable]
    pub fn unblocklist_account(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            !self.has_pending_or_active_proposals(),
            ERR_BLOCKLIST_LOCKED
        );
        let contract = self.contract();
        require!(
            contract.pending_blocklist_op.is_none(),
            ERR_BLOCKLIST_OP_PENDING
        );
        let contract = self.contract_mut();
        require!(
            contract.blocklist.remove(&account_id),
            ERR_ACCOUNT_NOT_BLOCKLISTED
        );
        GovernanceEvent::BlocklistRemoved {
            account_id,
            removed_by: env::predecessor_account_id(),
        }
        .emit();
    }

    pub fn is_blocklisted(&self, account_id: AccountId) -> bool {
        self.contract().blocklist.contains(&account_id)
    }

    pub fn list_blocklist(&self, from_index: u32, limit: u32) -> Vec<AccountId> {
        require!(limit <= MAX_PAGINATION_LIMIT, ERR_LIMIT_TOO_LARGE);
        let contract = self.contract();
        contract
            .blocklist
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .cloned()
            .collect()
    }

    pub fn is_blocklist_locked(&self) -> bool {
        self.has_pending_or_active_proposals() || self.contract().pending_blocklist_op.is_some()
    }

    // ==================== Configuration ====================

    #[payable]
    pub fn update_quorum_bps(&mut self, new_bps: u16) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            (MIN_QUORUM_BPS..=MAX_QUORUM_BPS).contains(&new_bps),
            ERR_QUORUM_BPS_OUT_OF_RANGE
        );
        let contract = self.contract_mut();
        contract.config.quorum_bps = new_bps;
        Self::emit_config_updated(&contract.config);
    }

    #[payable]
    pub fn update_voting_period_secs(&mut self, new_period_secs: U64) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            !self.has_pending_or_active_proposals(),
            ERR_CONFIG_LOCKED
        );
        require!(
            (MIN_VOTING_PERIOD_SECS..=MAX_VOTING_PERIOD_SECS).contains(&new_period_secs.0),
            ERR_VOTING_PERIOD_OUT_OF_RANGE
        );
        let contract = self.contract_mut();
        contract.config.voting_period_secs = new_period_secs;
        Self::emit_config_updated(&contract.config);
    }

    #[payable]
    pub fn update_pending_expiry_secs(&mut self, new_period_secs: U64) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            (MIN_PENDING_EXPIRY_SECS..=MAX_PENDING_EXPIRY_SECS).contains(&new_period_secs.0),
            ERR_PENDING_EXPIRY_OUT_OF_RANGE
        );
        let contract = self.contract_mut();
        contract.config.pending_expiry_secs = new_period_secs;
        Self::emit_config_updated(&contract.config);
    }

    #[payable]
    pub fn update_verified_accounts_contract(&mut self, new_contract: AccountId) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            !self.has_pending_or_active_proposals(),
            ERR_CONFIG_LOCKED
        );
        let contract = self.contract_mut();
        contract.config.verified_accounts_contract = new_contract;
        Self::emit_config_updated(&contract.config);
    }

    #[payable]
    pub fn update_min_proposal_bond(&mut self, new_min: U128) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            (MIN_BOND_YOCTO..=MAX_BOND_YOCTO).contains(&new_min.0),
            ERR_MIN_BOND_OUT_OF_RANGE
        );
        let contract = self.contract_mut();
        contract.config.min_proposal_bond = new_min;
        Self::emit_config_updated(&contract.config);
    }

    #[payable]
    pub fn update_finalize_grace_period_secs(&mut self, new_period_secs: U64) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            (MIN_GRACE_PERIOD_SECS..=MAX_GRACE_PERIOD_SECS).contains(&new_period_secs.0),
            ERR_GRACE_PERIOD_OUT_OF_RANGE
        );
        let contract = self.contract_mut();
        contract.config.finalize_grace_period_secs = new_period_secs;
        Self::emit_config_updated(&contract.config);
    }

    #[payable]
    pub fn update_max_start_delay_secs(&mut self, new_period_secs: U64) {
        assert_one_yocto();
        self.assert_admin();
        require!(
            new_period_secs.0 <= MAX_START_DELAY_SECS,
            ERR_MAX_START_DELAY_OUT_OF_RANGE
        );
        let contract = self.contract_mut();
        contract.config.max_start_delay_secs = new_period_secs;
        Self::emit_config_updated(&contract.config);
    }

    pub fn get_config(&self) -> Config {
        self.contract().config.clone()
    }

    // ==================== Callbacks (Private) ====================

    #[private]
    pub fn on_snapshot(
        &mut self,
        #[callback_result] snapshot_result: Result<u32, PromiseError>,
        proposal_id: u32,
    ) -> bool {
        let contract = self.contract_mut();

        // Proposal may have been cancelled since creation
        let proposal = match contract.proposals.get(proposal_id) {
            Some(p) => p,
            None => return false,
        };
        if proposal.status != ProposalStatus::Pending {
            return false;
        }
        // Parse promise result
        let verified_count: u32 = match snapshot_result {
            Ok(count) => count,
            Err(_) => {
                env::log_str(ERR_SNAPSHOT_CALLBACK_FAILED);
                let proposal = contract
                    .proposals
                    .get_mut(proposal_id)
                    .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
                proposal.status = ProposalStatus::Failed;
                proposal.failure_kind = Some(FailureKind::SnapshotCallbackFailed);
                GovernanceEvent::ProposalCreationFailed {
                    proposal_id,
                    reason: ProposalCreationFailedReason::SnapshotCallbackFailed,
                }
                .emit();
                return false;
            }
        };

        // Compute effective count (subtract blocklist)
        let effective = (verified_count as u64).saturating_sub(contract.blocklist.len() as u64);

        if effective == 0 {
            env::log_str(ERR_ZERO_SNAPSHOT);
            let proposal = contract
                .proposals
                .get_mut(proposal_id)
                .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
            proposal.status = ProposalStatus::Failed;
            proposal.failure_kind = Some(FailureKind::ZeroSnapshot);
            GovernanceEvent::ProposalCreationFailed {
                proposal_id,
                reason: ProposalCreationFailedReason::ZeroSnapshot,
            }
            .emit();
            return false;
        }

        let quorum_bps = {
            let proposal = contract
                .proposals
                .get(proposal_id)
                .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
            proposal.quorum_bps
        };

        let proposal = contract
            .proposals
            .get_mut(proposal_id)
            .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));
        proposal.snapshot_verified_count = effective;
        proposal.status = ProposalStatus::Active;

        let quorum_required = Self::require_quorum_count(effective, quorum_bps);
        GovernanceEvent::ProposalActivated {
            proposal_id,
            snapshot_verified_count: U64(effective),
            quorum_required: U64(quorum_required),
        }
        .emit();

        true
    }

    #[private]
    pub fn on_vote_verification(
        &mut self,
        #[callback_result] verification_result: Result<Option<VerificationSummary>, PromiseError>,
        proposal_id: u32,
        voter: AccountId,
    ) -> bool {
        let contract = self.contract_mut();

        // Remove pending vote — always clear the lock
        let pending_key = (proposal_id, voter.clone());
        let pending_vote = match contract.pending_votes.remove(&pending_key) {
            Some(pv) => pv,
            None => {
                env::log_str(ERR_PENDING_VOTE_NOT_FOUND_IN_CALLBACK);
                return false;
            }
        };

        let submitted_at = pending_vote.submitted_at;
        let choice = pending_vote.choice;
        let voter_deposit = pending_vote.voter_deposit.0;

        // Decrement pending_vote_count
        let proposal = match contract.proposals.get_mut(proposal_id) {
            Some(p) => p,
            None => {
                // Proposal somehow missing — refund
                if voter_deposit > 0 {
                    Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
                }
                return false;
            }
        };
        proposal.pending_vote_count = proposal.pending_vote_count.saturating_sub(1);

        // Read immutable fields before mutable operations
        let status = proposal.status.clone();
        let created_at = proposal.created_at;
        let start_at = proposal.start_at;
        let ends_at = proposal.ends_at;
        let pid = proposal.id;

        // Check proposal status — reject if not Active
        match status {
            ProposalStatus::Active => {} // good
            ProposalStatus::Cancelled => {
                GovernanceEvent::VoteRejected {
                    proposal_id,
                    voter: voter.clone(),
                    reason: VoteRejectionReason::ProposalCancelled,
                }
                .emit();
                if voter_deposit > 0 {
                    Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
                }
                return false;
            }
            ProposalStatus::Succeeded | ProposalStatus::Failed => {
                GovernanceEvent::VoteRejected {
                    proposal_id,
                    voter: voter.clone(),
                    reason: VoteRejectionReason::PostFinalize,
                }
                .emit();
                if voter_deposit > 0 {
                    Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
                }
                return false;
            }
            ProposalStatus::Pending => {
                // Should not normally happen but reject gracefully
                if voter_deposit > 0 {
                    Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
                }
                return false;
            }
        }

        // Parse promise result
        let verification: Option<VerificationSummary> = match verification_result {
            Ok(v) => v,
            Err(_) => {
                GovernanceEvent::VoteRejected {
                    proposal_id,
                    voter: voter.clone(),
                    reason: VoteRejectionReason::CallbackFailed,
                }
                .emit();
                if voter_deposit > 0 {
                    Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
                }
                return false;
            }
        };

        // Check verification exists
        let summary = match verification {
            Some(s) => s,
            None => {
                GovernanceEvent::VoteRejected {
                    proposal_id,
                    voter: voter.clone(),
                    reason: VoteRejectionReason::NotVerified,
                }
                .emit();
                if voter_deposit > 0 {
                    Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
                }
                return false;
            }
        };

        // Check verified_at <= created_at
        if summary.verified_at > created_at {
            GovernanceEvent::VoteRejected {
                proposal_id,
                voter: voter.clone(),
                reason: VoteRejectionReason::VerifiedAfterCreation,
            }
            .emit();
            if voter_deposit > 0 {
                Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
            }
            return false;
        }

        // Check timing: start_at <= submitted_at <= ends_at
        if submitted_at < start_at || submitted_at > ends_at {
            GovernanceEvent::VoteRejected {
                proposal_id,
                voter: voter.clone(),
                reason: VoteRejectionReason::ProposalExpired,
            }
            .emit();
            if voter_deposit > 0 {
                Promise::new(voter).transfer(NearToken::from_yoctonear(voter_deposit)).detach();
            }
            return false;
        }

        // === Success path ===

        // Flush PendingVote removal and pending_vote_count decrement to trie
        // before measuring baseline, so delta captures only the Vote insertion.
        contract.pending_votes.flush();
        contract.proposals.flush();

        let emit_choice = choice.clone();
        let storage_before = env::storage_usage();

        // Scoped mutable borrow for proposal mutations
        {
            let proposal = contract
                .proposals
                .get_mut(pid)
                .unwrap_or_else(|| env::panic_str(ERR_PROPOSAL_NOT_FOUND));

            proposal.votes.insert(
                voter.clone(),
                Vote {
                    choice,
                    voted_at: submitted_at,
                },
            );

            match emit_choice {
                VoteChoice::Yes => {
                    proposal.yes_votes = proposal
                        .yes_votes
                        .checked_add(1)
                        .unwrap_or_else(|| env::panic_str("yes votes overflow"));
                }
                VoteChoice::No => {
                    proposal.no_votes = proposal
                        .no_votes
                        .checked_add(1)
                        .unwrap_or_else(|| env::panic_str("no votes overflow"));
                }
            }
        }

        contract.proposals.flush();

        let storage_after = env::storage_usage();
        let storage_delta = storage_after.saturating_sub(storage_before);
        let actual_cost = env::storage_byte_cost()
            .saturating_mul(storage_delta as u128)
            .as_yoctonear();
        let refund = voter_deposit.saturating_sub(actual_cost);

        GovernanceEvent::VoteCast {
            proposal_id,
            voter: voter.clone(),
            choice: emit_choice,
            voted_at: U64(submitted_at),
        }
        .emit();

        if refund > 0 {
            Promise::new(voter).transfer(NearToken::from_yoctonear(refund)).detach();
        }

        true
    }

    #[private]
    pub fn on_blocklist_verification(
        &mut self,
        #[callback_result] verification_result: Result<Option<VerificationSummary>, PromiseError>,
        account_id: AccountId,
    ) -> bool {
        let contract = self.contract_mut();

        // Read initiated_by from pending op, then always clear it
        let initiated_by = match contract.pending_blocklist_op.take() {
            Some(op) => op.initiated_by,
            None => return false,
        };

        // Parse promise result
        let verification: Option<VerificationSummary> = match verification_result {
            Ok(v) => v,
            Err(_) => {
                env::log_str(ERR_BLOCKLIST_ACCOUNT_NOT_VERIFIED);
                return false;
            }
        };

        // Check verification exists
        if verification.is_none() {
            env::log_str(ERR_BLOCKLIST_ACCOUNT_NOT_VERIFIED);
            return false;
        }

        // Add to blocklist
        contract.blocklist.insert(account_id.clone());

        GovernanceEvent::BlocklistAdded {
            account_id,
            added_by: initiated_by,
        }
        .emit();

        true
    }
}
