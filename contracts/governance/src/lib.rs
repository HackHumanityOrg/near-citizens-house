//! # Governance Contract
//!
//! A NEAR smart contract implementing one-person-one-vote (1p1v) governance
//! for verified citizens. Leverages the verified-accounts contract for Sybil resistance.
//!
//! # Features
//!
//! - **True 1p1v**: Each verified citizen gets exactly one vote per proposal
//! - **Sybil Resistant**: Integrates with verified-accounts oracle via cross-contract calls
//! - **Per-Proposal Quorum**: Proposers set quorum percentage (1-100%) at creation
//! - **Abstain Votes**: Yes/No/Abstain options, where Abstain doesn't count toward quorum
//! - **Snapshot Voting**: Only accounts verified before proposal creation can vote
//! - **Majority Voting**: Proposals pass with >50% yes votes (among Yes/No votes)
//! - **7-Day Voting Period**: Fixed voting window for all proposals
//! - **Immutable**: No upgrade mechanism for maximum security and trust
//!
//! # Security Model
//!
//! ## Cross-Contract Verification
//! - All write operations verify citizenship via verified-accounts contract
//! - Two-step pattern: verify → callback to complete action
//! - Prevents non-citizens from creating proposals or voting
//! - Snapshot voting: voters must be verified before proposal creation
//!
//! ## Input Validation
//! - Title max 200 characters
//! - Description max 10,000 characters
//! - Discourse URL max 500 characters
//! - Quorum percentage 1-100%
//! - Prevents storage abuse
//!
//! ## State Validation
//! - Cannot vote twice on same proposal
//! - Cannot vote after voting period ends
//! - Cannot finalize before voting period ends
//! - Proposals can only be finalized once
//!
//! ## Event Emission
//! - All state changes emit events for transparency
//! - Enables off-chain indexing and analytics

#![allow(clippy::too_many_arguments)]

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near, AccountId, BorshStorageKey, Gas, NearSchema, PanicOnDefault, Promise, PromiseResult,
};
use verified_accounts_interface::ext_verified_accounts;

/// Maximum input lengths (prevents storage abuse)
const MAX_TITLE_LEN: usize = 200;
const MAX_DESCRIPTION_LEN: usize = 10_000;
const MAX_DISCOURSE_URL_LEN: usize = 500;

/// Maximum proposals per batch query (prevents gas exhaustion)
const MAX_BATCH_SIZE: usize = 100;

/// Voting period in nanoseconds (7 days)
const VOTING_PERIOD_NS: u64 = 7 * 24 * 60 * 60 * 1_000_000_000;

/// Storage key prefixes for collections
#[derive(BorshStorageKey, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub enum StorageKey {
    Proposals,
    Votes,
    VoteCounts,
}

/// Vote choice
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, NearSchema,
)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum Vote {
    Yes,
    No,
    Abstain,
}

/// Proposal status
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Debug, NearSchema,
)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub enum ProposalStatus {
    Active,
    Passed,
    Failed,
    QuorumNotMet,
    Cancelled,
}

/// Vote counts for a proposal
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
#[derive(Default)]
pub struct VoteCounts {
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub total_votes: u64,
}

/// Proposal record stored on-chain
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, NearSchema)]
#[abi(json)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct Proposal {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub proposer: AccountId,
    pub discourse_url: Option<String>,
    pub created_at: u64,
    pub voting_ends_at: u64,
    pub status: ProposalStatus,
    pub quorum_percentage: u8,
}

/// Event emitted when a proposal is created
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProposalCreatedEvent {
    pub proposal_id: u64,
    pub proposer: String,
    pub title: String,
}

/// Event emitted when a vote is cast
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct VoteCastEvent {
    pub proposal_id: u64,
    pub voter: String,
    pub vote: String,
}

/// Event emitted when a proposal is finalized
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProposalFinalizedEvent {
    pub proposal_id: u64,
    pub status: String,
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub total_votes: u64,
    pub quorum_required: u64,
    pub quorum_percentage: u8,
}

/// Event emitted when a proposal is cancelled
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProposalCancelledEvent {
    pub proposal_id: u64,
    pub cancelled_by: String,
}

/// Helper to emit JSON events in NEAR standard format
fn emit_event<T: Serialize>(event_name: &str, data: &T) {
    if let Ok(json) = near_sdk::serde_json::to_string(data) {
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"near-governance\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}",
            event_name, json
        ));
    }
}

/// Main contract structure
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct GovernanceContract {
    /// Reference to verified-accounts contract for citizenship checks
    pub verified_accounts_contract: AccountId,
    /// All proposals indexed by ID
    pub proposals: UnorderedMap<u64, Proposal>,
    /// Tracks which accounts have voted on which proposals
    /// Key: (proposal_id, account_id) -> Vote
    pub votes: LookupMap<(u64, AccountId), Vote>,
    /// Cached vote counts per proposal for efficiency
    pub vote_counts: UnorderedMap<u64, VoteCounts>,
    /// Next proposal ID (auto-increment)
    pub next_proposal_id: u64,
}

#[near]
impl GovernanceContract {
    /// Initialize contract with reference to verified-accounts contract
    #[init]
    pub fn new(verified_accounts_contract: AccountId) -> Self {
        Self {
            verified_accounts_contract,
            proposals: UnorderedMap::new(StorageKey::Proposals),
            votes: LookupMap::new(StorageKey::Votes),
            vote_counts: UnorderedMap::new(StorageKey::VoteCounts),
            next_proposal_id: 0,
        }
    }

    // ==================== WRITE METHODS (Require Verification) ====================

    /// Create a new proposal (requires verified citizenship)
    /// Returns a Promise that resolves to the proposal ID
    #[payable]
    pub fn create_proposal(
        &mut self,
        title: String,
        description: String,
        discourse_url: Option<String>,
        quorum_percentage: u8,
    ) -> Promise {
        // Cross-contract call to verify citizenship
        // Gas allocation: 5 TGas for is_account_verified (simple storage lookup)
        // Increase if verified-accounts contract adds complexity
        ext_verified_accounts::ext(self.verified_accounts_contract.clone())
            .with_static_gas(Gas::from_tgas(5))
            .is_account_verified(env::predecessor_account_id())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(15))
                    .callback_create_proposal(
                        env::predecessor_account_id(),
                        title,
                        description,
                        discourse_url,
                        quorum_percentage,
                    ),
            )
    }

    /// Callback to complete proposal creation after verification check
    #[private]
    pub fn callback_create_proposal(
        &mut self,
        proposer: AccountId,
        title: String,
        description: String,
        discourse_url: Option<String>,
        quorum_percentage: u8,
    ) -> u64 {
        // Check verification result
        let is_verified = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice::<bool>(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize verification status")),
            _ => env::panic_str("Verification check failed"),
        };

        if !is_verified {
            env::panic_str("Only verified citizens can create proposals");
        }

        // Input validation
        if title.is_empty() {
            env::panic_str("Title cannot be empty");
        }
        if title.len() > MAX_TITLE_LEN {
            env::panic_str("Title exceeds maximum length of 200 characters");
        }
        if description.is_empty() {
            env::panic_str("Description cannot be empty");
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            env::panic_str("Description exceeds maximum length of 10,000 characters");
        }
        if let Some(ref url) = discourse_url {
            if url.len() > MAX_DISCOURSE_URL_LEN {
                env::panic_str("Discourse URL exceeds maximum length of 500 characters");
            }
        }
        // Validate quorum percentage (1-100)
        if quorum_percentage < 1 || quorum_percentage > 100 {
            env::panic_str("Quorum percentage must be between 1 and 100");
        }

        // Create proposal
        let id = self.next_proposal_id;
        self.next_proposal_id += 1;

        let now = env::block_timestamp();
        let proposal = Proposal {
            id,
            title: title.clone(),
            description,
            proposer: proposer.clone(),
            discourse_url,
            created_at: now,
            voting_ends_at: now + VOTING_PERIOD_NS,
            status: ProposalStatus::Active,
            quorum_percentage,
        };

        self.proposals.insert(&id, &proposal);

        // Initialize vote counts
        self.vote_counts.insert(&id, &VoteCounts::default());

        // Emit event
        emit_event(
            "proposal_created",
            &ProposalCreatedEvent {
                proposal_id: id,
                proposer: proposer.to_string(),
                title,
            },
        );

        id
    }

    /// Cast a vote on a proposal (requires verified citizenship)
    /// Uses snapshot voting: only accounts verified before proposal creation can vote
    #[payable]
    pub fn vote(&mut self, proposal_id: u64, vote: Vote) -> Promise {
        // Cross-contract call to get account verification info (for snapshot check)
        // Gas allocation: 8 TGas for get_account (returns struct with proof data excluded)
        // Increase if VerifiedAccountInfo grows significantly
        ext_verified_accounts::ext(self.verified_accounts_contract.clone())
            .with_static_gas(Gas::from_tgas(8))
            .get_account(env::predecessor_account_id())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(15))
                    .callback_vote(env::predecessor_account_id(), proposal_id, vote),
            )
    }

    /// Callback to complete vote after verification check
    /// Uses snapshot voting: voters must be verified before proposal creation
    #[private]
    pub fn callback_vote(&mut self, voter: AccountId, proposal_id: u64, vote: Vote) {
        // Parse verification info from promise result (Option<VerifiedAccountInfo>)
        // NEAR cross-contract calls use JSON serialization by default
        let verified_info: Option<verified_accounts_interface::VerifiedAccountInfo> =
            match env::promise_result(0) {
                PromiseResult::Successful(data) => near_sdk::serde_json::from_slice(&data)
                    .unwrap_or_else(|_| env::panic_str("Failed to deserialize verification info")),
                _ => env::panic_str("Failed to get verification info"),
            };

        // Check account is verified
        let account_info = verified_info
            .unwrap_or_else(|| env::panic_str("Only verified citizens can vote"));

        // Get proposal
        let proposal = self
            .proposals
            .get(&proposal_id)
            .unwrap_or_else(|| env::panic_str("Proposal not found"));

        // Snapshot voting: voter must have been verified BEFORE proposal creation
        // Using strict greater-than to allow same-block verification (edge case)
        if account_info.verified_at > proposal.created_at {
            env::panic_str(
                "You must be verified before the proposal was created to vote on it",
            );
        }

        // Validate proposal state
        if proposal.status != ProposalStatus::Active {
            env::panic_str("Proposal is not active");
        }

        if env::block_timestamp() >= proposal.voting_ends_at {
            env::panic_str("Voting period has ended");
        }

        // Check if already voted
        let vote_key = (proposal_id, voter.clone());
        if self.votes.get(&vote_key).is_some() {
            env::panic_str("Already voted on this proposal");
        }

        // Record vote
        self.votes.insert(&vote_key, &vote);

        // Update vote counts
        let mut counts = self.vote_counts.get(&proposal_id).unwrap_or_default();

        match vote {
            Vote::Yes => counts.yes_votes += 1,
            Vote::No => counts.no_votes += 1,
            Vote::Abstain => counts.abstain_votes += 1,
        }
        counts.total_votes += 1;

        self.vote_counts.insert(&proposal_id, &counts);

        // Emit event
        emit_event(
            "vote_cast",
            &VoteCastEvent {
                proposal_id,
                voter: voter.to_string(),
                vote: match vote {
                    Vote::Yes => "Yes".to_string(),
                    Vote::No => "No".to_string(),
                    Vote::Abstain => "Abstain".to_string(),
                },
            },
        );
    }

    /// Finalize a proposal after voting period ends
    /// Anyone can call this to finalize an expired proposal
    pub fn finalize_proposal(&mut self, proposal_id: u64) -> Promise {
        // Get total verified citizens count via cross-contract call
        // Gas allocation: 5 TGas for get_verified_count (simple u64 return)
        ext_verified_accounts::ext(self.verified_accounts_contract.clone())
            .with_static_gas(Gas::from_tgas(5))
            .get_verified_count()
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(15))
                    .callback_finalize_proposal(proposal_id),
            )
    }

    /// Callback to complete finalization after getting citizen count
    #[private]
    pub fn callback_finalize_proposal(&mut self, proposal_id: u64) {
        // Get total citizens from promise result
        let total_citizens = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice::<u64>(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize citizens count")),
            _ => env::panic_str("Failed to get verified citizens count"),
        };

        // Prevent quorum bypass when no citizens are registered
        if total_citizens == 0 {
            env::panic_str("Cannot finalize proposal: no verified citizens registered");
        }

        // Get proposal
        let mut proposal = self
            .proposals
            .get(&proposal_id)
            .unwrap_or_else(|| env::panic_str("Proposal not found"));

        // Validate can finalize
        if proposal.status != ProposalStatus::Active {
            env::panic_str("Proposal is not active");
        }

        if env::block_timestamp() < proposal.voting_ends_at {
            env::panic_str("Voting period has not ended yet");
        }

        // Get vote counts
        let counts = self.vote_counts.get(&proposal_id).unwrap_or_default();

        // Calculate quorum requirement using proposal's quorum percentage
        let quorum_required =
            (total_citizens * u64::from(proposal.quorum_percentage)) / 100;

        // Only Yes + No votes count toward quorum (Abstain does not)
        let quorum_votes = counts.yes_votes + counts.no_votes;

        // Determine final status
        proposal.status = if quorum_votes < quorum_required {
            ProposalStatus::QuorumNotMet
        } else if counts.yes_votes > counts.no_votes {
            ProposalStatus::Passed
        } else {
            ProposalStatus::Failed
        };

        self.proposals.insert(&proposal_id, &proposal);

        // Emit event
        emit_event(
            "proposal_finalized",
            &ProposalFinalizedEvent {
                proposal_id,
                status: format!("{:?}", proposal.status),
                yes_votes: counts.yes_votes,
                no_votes: counts.no_votes,
                abstain_votes: counts.abstain_votes,
                total_votes: counts.total_votes,
                quorum_required,
                quorum_percentage: proposal.quorum_percentage,
            },
        );
    }

    /// Cancel a proposal (only proposer can cancel)
    pub fn cancel_proposal(&mut self, proposal_id: u64) {
        let mut proposal = self
            .proposals
            .get(&proposal_id)
            .unwrap_or_else(|| env::panic_str("Proposal not found"));

        // Only proposer can cancel
        if env::predecessor_account_id() != proposal.proposer {
            env::panic_str("Only proposer can cancel proposal");
        }

        // Can only cancel active proposals
        if proposal.status != ProposalStatus::Active {
            env::panic_str("Can only cancel active proposals");
        }

        proposal.status = ProposalStatus::Cancelled;
        self.proposals.insert(&proposal_id, &proposal);

        // Emit event
        emit_event(
            "proposal_cancelled",
            &ProposalCancelledEvent {
                proposal_id,
                cancelled_by: env::predecessor_account_id().to_string(),
            },
        );
    }

    // ==================== READ METHODS (Public) ====================

    /// Get a single proposal by ID
    pub fn get_proposal(&self, proposal_id: u64) -> Option<Proposal> {
        self.proposals.get(&proposal_id)
    }

    /// Get vote counts for a proposal
    pub fn get_vote_counts(&self, proposal_id: u64) -> VoteCounts {
        self.vote_counts.get(&proposal_id).unwrap_or_default()
    }

    /// Get a user's vote on a proposal
    pub fn get_vote(&self, proposal_id: u64, account_id: AccountId) -> Option<Vote> {
        self.votes.get(&(proposal_id, account_id))
    }

    /// Check if a user has voted on a proposal
    pub fn has_voted(&self, proposal_id: u64, account_id: AccountId) -> bool {
        self.votes.get(&(proposal_id, account_id)).is_some()
    }

    /// Get paginated list of proposals with optional status filter
    pub fn get_proposals(
        &self,
        from_index: u64,
        limit: u64,
        status: Option<ProposalStatus>,
    ) -> Vec<Proposal> {
        let limit = std::cmp::min(limit, MAX_BATCH_SIZE as u64) as usize;
        let from_index = from_index as usize;

        // Filter by status first, then apply pagination
        self.proposals
            .iter()
            .filter(|(_, proposal)| {
                status.as_ref().map_or(true, |s| &proposal.status == s)
            })
            .map(|(_, proposal)| proposal)
            .skip(from_index)
            .take(limit)
            .collect()
    }

    /// Get total number of proposals
    pub fn get_proposal_count(&self) -> u64 {
        self.proposals.len()
    }

    /// Get the verified accounts contract address
    pub fn get_verified_accounts_contract(&self) -> AccountId {
        self.verified_accounts_contract.clone()
    }

    /// Get governance parameters
    /// Note: quorum_percentage is now per-proposal, not a global parameter
    pub fn get_parameters(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({
            "voting_period_days": 7,
            "quorum_percentage_min": 1,
            "quorum_percentage_max": 100,
            "quorum_percentage_default": 10,
        })
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    #[test]
    fn test_initialization() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = GovernanceContract::new(accounts(1));
        assert_eq!(contract.get_verified_accounts_contract(), accounts(1));
        assert_eq!(contract.get_proposal_count(), 0);
    }

    #[test]
    fn test_get_parameters() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = GovernanceContract::new(accounts(1));
        let params = contract.get_parameters();

        assert_eq!(params["voting_period_days"], 7);
        assert_eq!(params["quorum_percentage_min"], 1);
        assert_eq!(params["quorum_percentage_max"], 100);
        assert_eq!(params["quorum_percentage_default"], 10);
    }

    #[test]
    fn test_vote_counts_default() {
        let counts = VoteCounts::default();
        assert_eq!(counts.yes_votes, 0);
        assert_eq!(counts.no_votes, 0);
        assert_eq!(counts.abstain_votes, 0);
        assert_eq!(counts.total_votes, 0);
    }
}
