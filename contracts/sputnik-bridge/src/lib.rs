//! # SputnikDAO Bridge Contract
//!
//! A NEAR smart contract that bridges verified accounts to SputnikDAO.
//! It acts as the intermediary between the verified-accounts oracle and
//! an unmodified SputnikDAO instance.
//!
//! # Features
//!
//! - **Add Members**: Verified citizens can be added to SputnikDAO as members
//! - **Create Proposals**: Backend can create text-only proposals on SputnikDAO
//! - **Minimal Permissions**: Bridge has only `add_member_to_role` and `vote` proposal permissions
//! - **Backend Authorization**: All functions require backend wallet as caller
//!
//! # Architecture
//!
//! ```text
//! Backend Wallet -> Bridge Contract -> SputnikDAO
//!                         |
//!                         v
//!                 Verified Accounts
//! ```
//!
//! # Security Model
//!
//! - Backend wallet is the only allowed caller for all write operations
//! - Member additions verify citizenship via cross-contract call first
//! - Bridge has minimal SputnikDAO permissions (cannot transfer funds, etc.)
//! - Citizens vote directly on SputnikDAO, not through the bridge

use near_sdk::assert_one_yocto;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, Gas, NearSchema, PanicOnDefault, Promise, PromiseResult};
use sputnik_dao_interface::{
    ext_sputnik_dao, Action, ProposalInput, ProposalKind, RoleKind, RolePermission, VotePolicy,
    WeightKind, WeightOrRatio,
};
use std::collections::HashMap;
use verified_accounts_interface::ext_verified_accounts;

/// Maximum description length for proposals (prevents storage abuse)
#[cfg(not(feature = "testing"))]
const MAX_DESCRIPTION_LEN: usize = 10_000;
#[cfg(feature = "testing")]
pub const MAX_DESCRIPTION_LEN: usize = 10_000;

/// Gas allocations for cross-contract calls
/// These are optimized to fit within NEAR's 300 TGas transaction limit
/// Each callback reservation includes ~20 TGas execution overhead
#[cfg(not(feature = "testing"))]
const GAS_FOR_VERIFICATION: Gas = Gas::from_tgas(5);
#[cfg(feature = "testing")]
pub const GAS_FOR_VERIFICATION: Gas = Gas::from_tgas(5);

#[cfg(not(feature = "testing"))]
const GAS_FOR_ADD_PROPOSAL: Gas = Gas::from_tgas(30);
#[cfg(feature = "testing")]
pub const GAS_FOR_ADD_PROPOSAL: Gas = Gas::from_tgas(30);

const GAS_FOR_ACT_PROPOSAL: Gas = Gas::from_tgas(30);
const GAS_FOR_GET_POLICY: Gas = Gas::from_tgas(10);

#[cfg(not(feature = "testing"))]
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(20); // Includes execution overhead
#[cfg(feature = "testing")]
pub const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(20); // Includes execution overhead

/// Total gas needed for the quorum update chain after member is added
/// get_policy(10) + add_proposal(30) + get_proposal(10) + act_proposal(30) + callbacks(4*20) = ~160 TGas
const GAS_FOR_QUORUM_UPDATE: Gas = Gas::from_tgas(160);

/// Quorum percentage for Vote proposals (7% of citizens)
/// This is used to calculate the minimum number of votes required
#[cfg(not(feature = "testing"))]
const QUORUM_PERCENT: u64 = 7;
#[cfg(feature = "testing")]
pub const QUORUM_PERCENT: u64 = 7;

/// Calculate quorum: ceil(citizen_count * 7 / 100)
/// Extracted as a helper function for unit testing
#[inline]
#[cfg(not(feature = "testing"))]
fn calculate_quorum(citizen_count: u64) -> u64 {
    if citizen_count == 0 {
        0
    } else {
        citizen_count
            .checked_mul(QUORUM_PERCENT)
            .unwrap_or_else(|| env::panic_str("Quorum calculation overflow"))
            .div_ceil(100)
    }
}

/// Calculate quorum: ceil(citizen_count * 7 / 100)
/// Extracted as a helper function for unit testing
#[inline]
#[cfg(feature = "testing")]
pub fn calculate_quorum(citizen_count: u64) -> u64 {
    if citizen_count == 0 {
        0
    } else {
        citizen_count
            .checked_mul(QUORUM_PERCENT)
            .unwrap_or_else(|| env::panic_str("Quorum calculation overflow"))
            .div_ceil(100)
    }
}

/// Event emitted when a member is added
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct MemberAddedEvent {
    pub member_id: String,
    pub role: String,
    pub proposal_id: u64,
}

/// Event emitted when a proposal is created
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct ProposalCreatedEvent {
    pub proposal_id: u64,
    pub description: String,
}

/// Event emitted when citizen quorum is updated
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct QuorumUpdatedEvent {
    pub citizen_count: u64,
    pub new_quorum: u64,
    pub proposal_id: u64,
}

/// Helper to emit JSON events in NEAR standard format
fn emit_event<T: Serialize>(event_name: &str, data: &T) {
    match near_sdk::serde_json::to_string(data) {
        Ok(json) => {
            env::log_str(&format!(
                "EVENT_JSON:{{\"standard\":\"sputnik-bridge\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}",
                event_name, json
            ));
        }
        Err(e) => {
            env::log_str(&format!(
                "EVENT_ERROR: Failed to serialize event '{}': {}",
                event_name, e
            ));
        }
    }
}

/// Main contract structure
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct SputnikBridge {
    /// The only account allowed to call write functions
    pub backend_wallet: AccountId,
    /// SputnikDAO contract address
    pub sputnik_dao: AccountId,
    /// Verified accounts oracle contract address
    pub verified_accounts_contract: AccountId,
    /// Role name for citizens in SputnikDAO (e.g., "citizen")
    pub citizen_role: String,
}

/// View-only contract info returned by get_info
#[derive(Serialize, Deserialize, NearSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct BridgeInfo {
    pub backend_wallet: AccountId,
    pub sputnik_dao: AccountId,
    pub verified_accounts_contract: AccountId,
    pub citizen_role: String,
}

#[near]
impl SputnikBridge {
    /// Initialize the bridge contract
    ///
    /// # Arguments
    /// * `backend_wallet` - The only account allowed to call write functions
    /// * `sputnik_dao` - SputnikDAO contract address
    /// * `verified_accounts_contract` - Verified accounts oracle contract address
    /// * `citizen_role` - Role name for citizens in SputnikDAO (e.g., "citizen")
    #[init]
    pub fn new(
        backend_wallet: AccountId,
        sputnik_dao: AccountId,
        verified_accounts_contract: AccountId,
        citizen_role: String,
    ) -> Self {
        // Trim whitespace and validate citizen_role is not empty
        let citizen_role = citizen_role.trim().to_string();
        assert!(!citizen_role.is_empty(), "citizen_role must be non-empty");
        Self {
            backend_wallet,
            sputnik_dao,
            verified_accounts_contract,
            citizen_role,
        }
    }

    // ==================== WRITE METHODS ====================

    /// Add a verified citizen as a member to SputnikDAO
    ///
    /// Flow:
    /// 1. Verify caller is backend_wallet
    /// 2. Cross-contract call to verified-accounts to check if account is verified
    /// 3. If verified, create AddMemberToRole proposal on SputnikDAO
    /// 4. Auto-approve the proposal (bridge is the sole council member with this permission)
    ///
    /// # Arguments
    /// * `near_account_id` - The NEAR account to add as a citizen member
    ///
    /// # Panics
    /// * If caller is not backend_wallet
    /// * If account is not verified
    #[payable]
    pub fn add_member(&mut self, near_account_id: AccountId) -> Promise {
        self.assert_backend_wallet();

        // Cross-contract call to verify citizenship
        // Gas chain: verification -> callback_add_member -> add_proposal -> callback_proposal_created
        //            -> act_proposal -> callback_member_added -> quorum_update_chain
        ext_verified_accounts::ext(self.verified_accounts_contract.clone())
            .with_static_gas(GAS_FOR_VERIFICATION)
            .is_account_verified(near_account_id.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(
                        GAS_FOR_ADD_PROPOSAL
                            .saturating_add(GAS_FOR_CALLBACK)
                            .saturating_add(GAS_FOR_ACT_PROPOSAL)
                            .saturating_add(GAS_FOR_CALLBACK)
                            .saturating_add(GAS_FOR_QUORUM_UPDATE),
                    )
                    .with_attached_deposit(env::attached_deposit())
                    .callback_add_member(near_account_id),
            )
    }

    /// Callback after verification check for add_member
    #[private]
    #[payable]
    pub fn callback_add_member(&mut self, near_account_id: AccountId) -> Promise {
        // Check verification result
        let is_verified = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice::<bool>(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize verification status")),
            _ => env::panic_str("Verification check failed"),
        };

        if !is_verified {
            env::panic_str("Account is not verified - cannot add to DAO");
        }

        // Create AddMemberToRole proposal on SputnikDAO
        let proposal = ProposalInput {
            description: format!(
                "Add verified citizen {} to {} role",
                near_account_id, self.citizen_role
            ),
            kind: ProposalKind::AddMemberToRole {
                member_id: near_account_id.clone(),
                role: self.citizen_role.clone(),
            },
        };

        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_ADD_PROPOSAL)
            .with_attached_deposit(env::attached_deposit())
            .add_proposal(proposal)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(
                        GAS_FOR_ACT_PROPOSAL
                            .saturating_add(GAS_FOR_CALLBACK)
                            .saturating_add(GAS_FOR_QUORUM_UPDATE),
                    )
                    .callback_proposal_created(near_account_id),
            )
    }

    /// Callback after proposal is created - auto-approve it
    #[private]
    pub fn callback_proposal_created(&mut self, near_account_id: AccountId) -> Promise {
        // Get proposal ID from result
        let proposal_id = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice::<u64>(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize proposal ID")),
            _ => env::panic_str("Failed to create proposal"),
        };

        // Auto-approve the proposal (bridge has VoteApprove permission for AddMemberToRole)
        // Note: SputnikDAO requires the proposal kind to be passed and validates it matches
        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_ACT_PROPOSAL)
            .act_proposal(
                proposal_id,
                Action::VoteApprove,
                ProposalKind::AddMemberToRole {
                    member_id: near_account_id.clone(),
                    role: self.citizen_role.clone(),
                },
                None,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK.saturating_add(GAS_FOR_QUORUM_UPDATE))
                    .callback_member_added(near_account_id, proposal_id),
            )
    }

    /// Callback after member addition is approved - now update the quorum
    #[private]
    pub fn callback_member_added(
        &mut self,
        near_account_id: AccountId,
        proposal_id: u64,
    ) -> Promise {
        // Check act_proposal succeeded
        match env::promise_result(0) {
            PromiseResult::Successful(_) => {
                // Emit success event
                emit_event(
                    "member_added",
                    &MemberAddedEvent {
                        member_id: near_account_id.to_string(),
                        role: self.citizen_role.clone(),
                        proposal_id,
                    },
                );
            }
            _ => env::panic_str("Failed to approve member addition proposal"),
        }

        // Query the DAO policy to get the updated citizen count for quorum calculation
        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_GET_POLICY)
            .get_policy()
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(
                        GAS_FOR_QUORUM_UPDATE.saturating_sub(GAS_FOR_GET_POLICY), // Remaining gas for chain
                    )
                    .callback_policy_received_for_quorum(),
            )
    }

    /// Callback after receiving DAO policy - calculate and update quorum
    #[private]
    pub fn callback_policy_received_for_quorum(&mut self) -> Promise {
        // Parse policy from result
        let policy_json: near_sdk::serde_json::Value = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize policy")),
            _ => env::panic_str("Failed to get policy"),
        };

        // Extract citizen role info and proposal bond
        let roles = policy_json
            .get("roles")
            .and_then(|r| r.as_array())
            .unwrap_or_else(|| env::panic_str("Failed to parse roles"));

        let proposal_bond: u128 = policy_json
            .get("proposal_bond")
            .and_then(|b| b.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| env::panic_str("Failed to parse proposal_bond"));

        // Find citizen role and extract member list + permissions
        let mut citizen_members: Vec<AccountId> = Vec::new();
        let mut citizen_permissions: Vec<String> = Vec::new();

        for role in roles {
            if role.get("name").and_then(|n| n.as_str()) == Some(&self.citizen_role) {
                // Extract group members
                if let Some(kind) = role.get("kind") {
                    if let Some(group) = kind.get("Group").and_then(|g| g.as_array()) {
                        for member in group {
                            if let Some(account_str) = member.as_str() {
                                if let Ok(account_id) = account_str.parse::<AccountId>() {
                                    citizen_members.push(account_id);
                                }
                            }
                        }
                    }
                }
                // Extract permissions
                if let Some(perms) = role.get("permissions").and_then(|p| p.as_array()) {
                    for perm in perms {
                        if let Some(perm_str) = perm.as_str() {
                            citizen_permissions.push(perm_str.to_string());
                        }
                    }
                }
                break;
            }
        }

        // Calculate new quorum: ceil(citizen_count * 7 / 100)
        let citizen_count = citizen_members.len() as u64;
        let new_quorum = calculate_quorum(citizen_count);

        // Build the updated citizen role with new quorum for Vote proposals
        // Vote policy: 50% threshold + dynamic quorum based on 7% of citizens
        let mut vote_policy_map: HashMap<String, VotePolicy> = HashMap::new();
        vote_policy_map.insert(
            "vote".to_string(),
            VotePolicy {
                weight_kind: WeightKind::RoleWeight,
                quorum: U128(new_quorum as u128),
                threshold: WeightOrRatio::Ratio(1, 2), // 50% of citizens
            },
        );

        let updated_role = RolePermission {
            name: self.citizen_role.clone(),
            kind: RoleKind::Group(citizen_members),
            permissions: citizen_permissions,
            vote_policy: vote_policy_map,
        };

        // Create ChangePolicyAddOrUpdateRole proposal
        let proposal = ProposalInput {
            description: format!(
                "Update {} role quorum to {} ({}% of {} citizens)",
                self.citizen_role, new_quorum, QUORUM_PERCENT, citizen_count
            ),
            kind: ProposalKind::ChangePolicyAddOrUpdateRole { role: updated_role },
        };

        env::log_str(&format!(
            "Updating quorum: citizen_count={}, new_quorum={}",
            citizen_count, new_quorum
        ));

        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_ADD_PROPOSAL)
            .with_attached_deposit(near_sdk::NearToken::from_yoctonear(proposal_bond))
            .add_proposal(proposal)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(
                        GAS_FOR_GET_POLICY
                            .saturating_add(GAS_FOR_ACT_PROPOSAL)
                            .saturating_add(GAS_FOR_CALLBACK)
                            .saturating_add(GAS_FOR_CALLBACK),
                    )
                    .callback_quorum_proposal_created(citizen_count, new_quorum),
            )
    }

    /// Callback after quorum update proposal is created - query the proposal to get exact kind
    #[private]
    pub fn callback_quorum_proposal_created(
        &mut self,
        citizen_count: u64,
        new_quorum: u64,
    ) -> Promise {
        // Get proposal ID from result
        let proposal_id = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice::<u64>(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize proposal ID")),
            _ => env::panic_str("Failed to create quorum update proposal"),
        };

        // Query get_proposal to get the exact stored kind (avoids HashSet ordering issues)
        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_GET_POLICY) // get_proposal uses similar gas
            .get_proposal(proposal_id)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_ACT_PROPOSAL.saturating_add(GAS_FOR_CALLBACK))
                    .callback_got_quorum_proposal(citizen_count, new_quorum, proposal_id),
            )
    }

    /// Callback after getting the proposal - use stored kind for act_proposal
    #[private]
    pub fn callback_got_quorum_proposal(
        &mut self,
        citizen_count: u64,
        new_quorum: u64,
        proposal_id: u64,
    ) -> Promise {
        // Parse the proposal from result
        let proposal_json: near_sdk::serde_json::Value = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize proposal")),
            _ => env::panic_str("Failed to get proposal"),
        };

        // Extract the kind from the proposal
        let kind_json = proposal_json
            .get("kind")
            .unwrap_or_else(|| env::panic_str("Proposal missing kind field"));

        // Deserialize the kind into our ProposalKind type
        let kind: ProposalKind = near_sdk::serde_json::from_value(kind_json.clone())
            .unwrap_or_else(|_| env::panic_str("Failed to deserialize proposal kind"));

        // Auto-approve the proposal using the exact stored kind
        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_ACT_PROPOSAL)
            .act_proposal(proposal_id, Action::VoteApprove, kind, None)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .callback_quorum_updated(citizen_count, new_quorum, proposal_id),
            )
    }

    /// Final callback after quorum is updated
    #[private]
    pub fn callback_quorum_updated(
        &mut self,
        citizen_count: u64,
        new_quorum: u64,
        proposal_id: u64,
    ) {
        match env::promise_result(0) {
            PromiseResult::Successful(_) => {
                emit_event(
                    "quorum_updated",
                    &QuorumUpdatedEvent {
                        citizen_count,
                        new_quorum,
                        proposal_id,
                    },
                );
            }
            _ => env::panic_str("Failed to approve quorum update proposal"),
        }
    }

    /// Create a text-only proposal on SputnikDAO
    ///
    /// This creates a Vote proposal (governance/discussion only, no on-chain action).
    /// The bridge does not verify the proposer - backend is trusted to have already
    /// verified the request off-chain.
    ///
    /// # Arguments
    /// * `description` - Proposal description (markdown)
    ///
    /// # Returns
    /// Promise that resolves to the proposal ID
    ///
    /// # Panics
    /// * If caller is not backend_wallet
    /// * If description exceeds maximum length
    #[payable]
    pub fn create_proposal(&mut self, description: String) -> Promise {
        self.assert_backend_wallet();

        // Input validation - trim whitespace and check for empty
        let description = description.trim().to_string();
        if description.is_empty() {
            env::panic_str("Description cannot be empty");
        }
        if description.len() > MAX_DESCRIPTION_LEN {
            env::panic_str("Description exceeds maximum length");
        }

        // Create Vote proposal on SputnikDAO
        let proposal = ProposalInput {
            description: description.clone(),
            kind: ProposalKind::Vote,
        };

        ext_sputnik_dao::ext(self.sputnik_dao.clone())
            .with_static_gas(GAS_FOR_ADD_PROPOSAL)
            .with_attached_deposit(env::attached_deposit())
            .add_proposal(proposal)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .callback_vote_proposal_created(description),
            )
    }

    /// Callback after vote proposal is created
    #[private]
    pub fn callback_vote_proposal_created(&self, description: String) -> u64 {
        // Get proposal ID from result
        let proposal_id = match env::promise_result(0) {
            PromiseResult::Successful(data) => near_sdk::serde_json::from_slice::<u64>(&data)
                .unwrap_or_else(|_| env::panic_str("Failed to deserialize proposal ID")),
            _ => env::panic_str("Failed to create proposal"),
        };

        // Emit event
        emit_event(
            "proposal_created",
            &ProposalCreatedEvent {
                proposal_id,
                description,
            },
        );

        proposal_id
    }

    // ==================== ADMIN METHODS ====================

    /// Update the backend wallet address
    ///
    /// # Arguments
    /// * `new_backend_wallet` - New backend wallet address
    ///
    /// # Panics
    /// * If caller is not current backend_wallet
    #[payable]
    pub fn update_backend_wallet(&mut self, new_backend_wallet: AccountId) {
        assert_one_yocto();
        self.assert_backend_wallet();
        self.backend_wallet = new_backend_wallet;
    }

    /// Update the citizen role name
    ///
    /// # Arguments
    /// * `new_role` - New role name
    ///
    /// # Panics
    /// * If caller is not backend_wallet
    /// * If new_role is empty
    #[payable]
    pub fn update_citizen_role(&mut self, new_role: String) {
        assert_one_yocto();
        self.assert_backend_wallet();
        let new_role_trimmed = new_role.trim().to_string();
        assert!(!new_role_trimmed.is_empty(), "new_role must be non-empty");
        self.citizen_role = new_role_trimmed;
    }

    // ==================== VIEW METHODS ====================

    /// Get bridge contract info
    pub fn get_info(&self) -> BridgeInfo {
        BridgeInfo {
            backend_wallet: self.backend_wallet.clone(),
            sputnik_dao: self.sputnik_dao.clone(),
            verified_accounts_contract: self.verified_accounts_contract.clone(),
            citizen_role: self.citizen_role.clone(),
        }
    }

    /// Get the backend wallet address
    pub fn get_backend_wallet(&self) -> AccountId {
        self.backend_wallet.clone()
    }

    /// Get the SputnikDAO contract address
    pub fn get_sputnik_dao(&self) -> AccountId {
        self.sputnik_dao.clone()
    }

    /// Get the verified accounts contract address
    pub fn get_verified_accounts_contract(&self) -> AccountId {
        self.verified_accounts_contract.clone()
    }

    /// Get the citizen role name
    pub fn get_citizen_role(&self) -> String {
        self.citizen_role.clone()
    }

    // ==================== INTERNAL METHODS ====================

    /// Assert that caller is the backend wallet
    fn assert_backend_wallet(&self) {
        if env::predecessor_account_id() != self.backend_wallet {
            env::panic_str("Only backend wallet can call this function");
        }
    }
}
