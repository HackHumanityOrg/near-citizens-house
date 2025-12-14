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
const MAX_DESCRIPTION_LEN: usize = 10_000;

/// Gas allocations for cross-contract calls
/// These are optimized to fit within NEAR's 300 TGas transaction limit
/// Each callback reservation includes ~15 TGas execution overhead
const GAS_FOR_VERIFICATION: Gas = Gas::from_tgas(5);
const GAS_FOR_ADD_PROPOSAL: Gas = Gas::from_tgas(30);
const GAS_FOR_ACT_PROPOSAL: Gas = Gas::from_tgas(30);
const GAS_FOR_GET_POLICY: Gas = Gas::from_tgas(10);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(20); // Includes execution overhead

/// Total gas needed for the quorum update chain after member is added
/// get_policy(10) + add_proposal(30) + get_proposal(10) + act_proposal(30) + callbacks(4*20) = ~160 TGas
const GAS_FOR_QUORUM_UPDATE: Gas = Gas::from_tgas(160);

/// Quorum percentage for Vote proposals (7% of citizens)
/// This is used to calculate the minimum number of votes required
const QUORUM_PERCENT: u64 = 7;

/// Calculate quorum: ceil(citizen_count * 7 / 100)
/// Extracted as a helper function for unit testing
#[inline]
fn calculate_quorum(citizen_count: u64) -> u64 {
    if citizen_count == 0 {
        0
    } else {
        citizen_count
            .checked_mul(QUORUM_PERCENT)
            .expect("Quorum calculation overflow")
            .div_ceil(100)
    }
}

/// Event emitted when a member is added
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct MemberAddedEvent {
    pub member_id: String,
    pub role: String,
    pub proposal_id: u64,
}

/// Event emitted when a proposal is created
#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ProposalCreatedEvent {
    pub proposal_id: u64,
    pub description: String,
}

/// Event emitted when citizen quorum is updated
#[derive(Serialize)]
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
            env::log_str(&format!("EVENT_ERROR: Failed to serialize event '{}': {}", event_name, e));
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
            description: format!("Add verified citizen {} to {} role", near_account_id, self.citizen_role),
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
    pub fn callback_member_added(&mut self, near_account_id: AccountId, proposal_id: u64) -> Promise {
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
    pub fn callback_quorum_updated(&mut self, citizen_count: u64, new_quorum: u64, proposal_id: u64) {
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

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]
#[allure_rs::allure_suite("Sputnik Bridge Contract")]
mod tests {
    use super::*;
    use allure_rs::prelude::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    use near_sdk::test_utils::get_logs;

    fn get_context(predecessor: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder.predecessor_account_id(predecessor);
        builder
    }

    /// Helper function to assert that a closure panics with the expected message.
    /// This allows panic tests to work with allure_test annotations.
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

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Contract Initialization")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "initialization")]
    #[allure_test]
    #[test]
    fn test_initialization() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = SputnikBridge::new(
            accounts(0), // backend_wallet
            accounts(1), // sputnik_dao
            accounts(2), // verified_accounts_contract
            "citizen".to_string(),
        );

        assert_eq!(contract.get_backend_wallet(), accounts(0));
        assert_eq!(contract.get_sputnik_dao(), accounts(1));
        assert_eq!(contract.get_verified_accounts_contract(), accounts(2));
        assert_eq!(contract.get_citizen_role(), "citizen");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Read Functions")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "query", "view")]
    #[allure_test]
    #[test]
    fn test_get_info() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        let info = contract.get_info();
        assert_eq!(info.backend_wallet, accounts(0));
        assert_eq!(info.sputnik_dao, accounts(1));
        assert_eq!(info.verified_accounts_contract, accounts(2));
        assert_eq!(info.citizen_role, "citizen");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Backend Wallet Management")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "admin", "wallet")]
    #[allure_test]
    #[test]
    fn test_update_backend_wallet() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        contract.update_backend_wallet(accounts(3));
        assert_eq!(contract.get_backend_wallet(), accounts(3));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Backend Wallet Management")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "security", "authorization")]
    #[allure_test]
    #[test]
    fn test_update_backend_wallet_unauthorized() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Switch to different account
        context.predecessor_account_id(accounts(4));
        testing_env!(context.build());

        assert_panic_with(
            || contract.update_backend_wallet(accounts(3)),
            "Only backend wallet can call this function",
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Citizen Role Management")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "admin", "role")]
    #[allure_test]
    #[test]
    fn test_update_citizen_role() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        contract.update_citizen_role("voter".to_string());
        assert_eq!(contract.get_citizen_role(), "voter");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Citizen Role Management")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "security", "authorization")]
    #[allure_test]
    #[test]
    fn test_update_citizen_role_unauthorized() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Switch to different account
        context.predecessor_account_id(accounts(4));
        testing_env!(context.build());

        assert_panic_with(
            || contract.update_citizen_role("voter".to_string()),
            "Only backend wallet can call this function",
        );
    }

    // ==================== QUORUM CALCULATION TESTS (Phase 2.2) ====================
    // Tests for the calculate_quorum helper function

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_0_citizens_equals_0() {
        assert_eq!(super::calculate_quorum(0), 0);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_1_citizen_equals_1() {
        // 1 * 7 / 100 = 0.07 → ceiling = 1
        assert_eq!(super::calculate_quorum(1), 1);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_14_citizens_equals_1() {
        // 14 * 7 / 100 = 0.98 → ceiling = 1
        assert_eq!(super::calculate_quorum(14), 1);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_15_citizens_equals_2() {
        // 15 * 7 / 100 = 1.05 → ceiling = 2
        assert_eq!(super::calculate_quorum(15), 2);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_100_citizens_equals_7() {
        // 100 * 7 / 100 = 7.0 → ceiling = 7
        assert_eq!(super::calculate_quorum(100), 7);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_101_citizens_equals_8() {
        // 101 * 7 / 100 = 7.07 → ceiling = 8
        assert_eq!(super::calculate_quorum(101), 8);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_143_citizens_equals_11() {
        // 143 * 7 / 100 = 10.01 → ceiling = 11
        assert_eq!(super::calculate_quorum(143), 11);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "quorum", "math")]
    #[allure_test]
    #[test]
    fn test_quorum_with_1000_citizens_equals_70() {
        // 1000 * 7 / 100 = 70.0 → ceiling = 70
        assert_eq!(super::calculate_quorum(1000), 70);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "quorum", "math", "algorithm")]
    #[allure_test]
    #[test]
    fn test_quorum_ceiling_division_correctness() {
        // Verify ceiling division works correctly at various boundaries
        // For 7% quorum:
        // - Every 100 citizens adds 7 to quorum (exact)
        // - Any remainder above a multiple of ~14.28 adds 1

        // Test sequence: quorum increases every ~14.3 citizens
        assert_eq!(super::calculate_quorum(1), 1);   // 0.07 → 1
        assert_eq!(super::calculate_quorum(14), 1);  // 0.98 → 1
        assert_eq!(super::calculate_quorum(15), 2);  // 1.05 → 2
        assert_eq!(super::calculate_quorum(28), 2);  // 1.96 → 2
        assert_eq!(super::calculate_quorum(29), 3);  // 2.03 → 3
        assert_eq!(super::calculate_quorum(42), 3);  // 2.94 → 3
        assert_eq!(super::calculate_quorum(43), 4);  // 3.01 → 4
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Calculation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "math", "scale")]
    #[allure_test]
    #[test]
    fn test_quorum_large_numbers() {
        // Test with large citizen counts
        assert_eq!(super::calculate_quorum(10000), 700);
        assert_eq!(super::calculate_quorum(100000), 7000);
        assert_eq!(super::calculate_quorum(1000000), 70000);
    }

    // ==================== BOUNDARY VALUE TESTS (limit-1, limit, limit+1) ====================
    // Tests at exact boundaries where quorum value changes
    // Formula: quorum = ceil(citizen_count * 7 / 100)
    // Quorum changes when citizen_count crosses multiples of 100/7 ≈ 14.2857

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "quorum", "boundary")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_0_to_1() {
        // Boundary: 0 → 1 (special case for zero)
        // limit-1: N/A (can't have negative citizens)
        // limit:   0 citizens → quorum 0
        // limit+1: 1 citizen  → quorum 1
        assert_eq!(super::calculate_quorum(0), 0, "0 citizens should have 0 quorum");
        assert_eq!(super::calculate_quorum(1), 1, "1 citizen should have 1 quorum (ceil(0.07) = 1)");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "quorum", "boundary")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_1_to_2() {
        // Boundary: quorum changes from 1 to 2 at 15 citizens
        // 14 * 7 / 100 = 0.98, ceil = 1
        // 15 * 7 / 100 = 1.05, ceil = 2
        // limit-1: 14 citizens → quorum 1
        // limit:   15 citizens → quorum 2 (first citizen count with quorum 2)
        // limit+1: 16 citizens → quorum 2
        assert_eq!(super::calculate_quorum(14), 1, "14 citizens: ceil(0.98) = 1");
        assert_eq!(super::calculate_quorum(15), 2, "15 citizens: ceil(1.05) = 2");
        assert_eq!(super::calculate_quorum(16), 2, "16 citizens: ceil(1.12) = 2");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "boundary")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_2_to_3() {
        // Boundary: quorum changes from 2 to 3 at 29 citizens
        // 28 * 7 / 100 = 1.96, ceil = 2
        // 29 * 7 / 100 = 2.03, ceil = 3
        // limit-1: 28 citizens → quorum 2
        // limit:   29 citizens → quorum 3 (first citizen count with quorum 3)
        // limit+1: 30 citizens → quorum 3
        assert_eq!(super::calculate_quorum(28), 2, "28 citizens: ceil(1.96) = 2");
        assert_eq!(super::calculate_quorum(29), 3, "29 citizens: ceil(2.03) = 3");
        assert_eq!(super::calculate_quorum(30), 3, "30 citizens: ceil(2.10) = 3");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "boundary")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_6_to_7() {
        // Boundary: quorum changes from 6 to 7 at 86 citizens
        // 85 * 7 / 100 = 5.95, ceil = 6
        // 86 * 7 / 100 = 6.02, ceil = 7
        // limit-1: 85 citizens → quorum 6
        // limit:   86 citizens → quorum 7 (first citizen count with quorum 7)
        // limit+1: 87 citizens → quorum 7
        assert_eq!(super::calculate_quorum(85), 6, "85 citizens: ceil(5.95) = 6");
        assert_eq!(super::calculate_quorum(86), 7, "86 citizens: ceil(6.02) = 7");
        assert_eq!(super::calculate_quorum(87), 7, "87 citizens: ceil(6.09) = 7");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "quorum", "boundary", "percentage")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_exact_7_percent() {
        // Special boundary: exact 7% (100 citizens = 7 quorum exactly)
        // 99 * 7 / 100 = 6.93, ceil = 7
        // 100 * 7 / 100 = 7.00, ceil = 7 (exact)
        // 101 * 7 / 100 = 7.07, ceil = 8
        // limit-1: 99 citizens  → quorum 7
        // limit:   100 citizens → quorum 7 (exact 7%)
        // limit+1: 101 citizens → quorum 8
        assert_eq!(super::calculate_quorum(99), 7, "99 citizens: ceil(6.93) = 7");
        assert_eq!(super::calculate_quorum(100), 7, "100 citizens: exact 7% = 7");
        assert_eq!(super::calculate_quorum(101), 8, "101 citizens: ceil(7.07) = 8");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "quorum", "boundary", "percentage")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_exact_14_percent() {
        // Another exact boundary: 200 citizens = 14 quorum exactly
        // 199 * 7 / 100 = 13.93, ceil = 14
        // 200 * 7 / 100 = 14.00, ceil = 14 (exact)
        // 201 * 7 / 100 = 14.07, ceil = 15
        // limit-1: 199 citizens → quorum 14
        // limit:   200 citizens → quorum 14 (exact 14%)
        // limit+1: 201 citizens → quorum 15
        assert_eq!(super::calculate_quorum(199), 14, "199 citizens: ceil(13.93) = 14");
        assert_eq!(super::calculate_quorum(200), 14, "200 citizens: exact 14% = 14");
        assert_eq!(super::calculate_quorum(201), 15, "201 citizens: ceil(14.07) = 15");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Quorum Boundaries")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "quorum", "boundary", "algorithm")]
    #[allure_test]
    #[test]
    fn test_quorum_boundary_floor_vs_ceil_difference() {
        // Test cases where floor and ceiling would give different results
        // These verify that we're using ceiling, not floor
        // floor(0.07) = 0, ceil(0.07) = 1
        assert_eq!(super::calculate_quorum(1), 1, "1 citizen: floor=0, ceil=1, should be 1");
        // floor(0.98) = 0, ceil(0.98) = 1
        assert_eq!(super::calculate_quorum(14), 1, "14 citizens: floor=0, ceil=1, should be 1");
        // floor(1.05) = 1, ceil(1.05) = 2
        assert_eq!(super::calculate_quorum(15), 2, "15 citizens: floor=1, ceil=2, should be 2");
        // floor(6.93) = 6, ceil(6.93) = 7
        assert_eq!(super::calculate_quorum(99), 7, "99 citizens: floor=6, ceil=7, should be 7");
    }

    // ==================== DESCRIPTION VALIDATION TESTS (Phase 2.1) ====================
    // Note: create_proposal method initiates cross-contract call, so we test validation
    // by checking that the method panics before the cross-contract call for invalid input

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "validation", "proposal")]
    #[allure_test]
    #[test]
    fn test_create_proposal_empty_description_fails() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Empty description should fail before cross-contract call
        assert_panic_with(
            || {
                let _ = contract.create_proposal("".to_string());
            },
            "Description cannot be empty",
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "proposal")]
    #[allure_test]
    #[test]
    fn test_create_proposal_whitespace_only_description_fails() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Whitespace-only description should fail (trimmed to empty)
        assert_panic_with(
            || {
                let _ = contract.create_proposal("   \t\n  ".to_string());
            },
            "Description cannot be empty",
        );
    }

    // ==================== DESCRIPTION LENGTH BOUNDARY TESTS ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "boundary")]
    #[allure_test]
    #[test]
    fn test_description_boundary_limit_minus_1_passes() {
        // 9,999 characters - just under the 10,000 limit
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        let description = "x".repeat(9999);
        assert_eq!(description.len(), 9999);
        // Should pass validation and attempt cross-contract call (will fail in unit test but passes validation)
        let _ = contract.create_proposal(description);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "boundary")]
    #[allure_test]
    #[test]
    fn test_description_boundary_at_limit_passes() {
        // Exactly 10,000 characters - at the limit
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        let description = "x".repeat(10000);
        assert_eq!(description.len(), 10000);
        // Should pass validation and attempt cross-contract call
        let _ = contract.create_proposal(description);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "validation", "boundary")]
    #[allure_test]
    #[test]
    fn test_description_boundary_limit_plus_1_fails() {
        // 10,001 characters - just over the 10,000 limit
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        let too_long = "x".repeat(10001);
        assert_eq!(too_long.len(), 10001);
        assert_panic_with(
            || {
                let _ = contract.create_proposal(too_long);
            },
            "Description exceeds maximum length",
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "validation", "boundary", "edge-case")]
    #[allure_test]
    #[test]
    fn test_description_boundary_single_char_passes() {
        // Single character - minimum valid non-empty description
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Single char should pass validation
        let _ = contract.create_proposal("x".to_string());
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Description Validation")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_create_proposal_description_over_max_fails() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // 10001 characters exceeds the 10000 char limit
        let too_long = "x".repeat(10001);
        assert_panic_with(
            || {
                let _ = contract.create_proposal(too_long);
            },
            "Description exceeds maximum length",
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Access Control")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "security", "authorization")]
    #[allure_test]
    #[test]
    fn test_create_proposal_unauthorized_fails() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Switch to different account
        context.predecessor_account_id(accounts(4));
        testing_env!(context.build());

        assert_panic_with(
            || {
                let _ = contract.create_proposal("Valid proposal".to_string());
            },
            "Only backend wallet can call this function",
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Access Control")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "security", "authorization")]
    #[allure_test]
    #[test]
    fn test_add_member_unauthorized_fails() {
        let mut context = get_context(accounts(0));
        testing_env!(context.build());

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Switch to different account
        context.predecessor_account_id(accounts(4));
        testing_env!(context.build());

        assert_panic_with(
            || {
                let _ = contract.add_member(accounts(5));
            },
            "Only backend wallet can call this function",
        );
    }

    // ==================== EVENT STRUCTURE TESTS (Phase 2.4) ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Events")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "events", "serialization")]
    #[allure_test]
    #[test]
    fn test_member_added_event_serializes_correctly() {
        let event = super::MemberAddedEvent {
            member_id: "alice.near".to_string(),
            role: "citizen".to_string(),
            proposal_id: 42,
        };

        let json = near_sdk::serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"member_id\":\"alice.near\""));
        assert!(json.contains("\"role\":\"citizen\""));
        assert!(json.contains("\"proposal_id\":42"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Events")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "events", "serialization")]
    #[allure_test]
    #[test]
    fn test_proposal_created_event_serializes_correctly() {
        let event = super::ProposalCreatedEvent {
            proposal_id: 123,
            description: "Test proposal description".to_string(),
        };

        let json = near_sdk::serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"proposal_id\":123"));
        assert!(json.contains("\"description\":\"Test proposal description\""));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Events")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "events", "serialization")]
    #[allure_test]
    #[test]
    fn test_quorum_updated_event_serializes_correctly() {
        let event = super::QuorumUpdatedEvent {
            citizen_count: 100,
            new_quorum: 7,
            proposal_id: 456,
        };

        let json = near_sdk::serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"citizen_count\":100"));
        assert!(json.contains("\"new_quorum\":7"));
        assert!(json.contains("\"proposal_id\":456"));
    }

    // ==================== GAS CONSTANT VALIDATION TESTS ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Constants")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "constants", "gas")]
    #[allure_test]
    #[test]
    fn test_gas_constants_are_reasonable() {
        // Verify gas allocations are within expected ranges
        assert!(super::GAS_FOR_VERIFICATION.as_tgas() >= 5);
        assert!(super::GAS_FOR_ADD_PROPOSAL.as_tgas() >= 20);
        assert!(super::GAS_FOR_ACT_PROPOSAL.as_tgas() >= 20);
        assert!(super::GAS_FOR_GET_POLICY.as_tgas() >= 5);
        assert!(super::GAS_FOR_CALLBACK.as_tgas() >= 10);

        // Total gas for quorum update should be reasonable
        assert!(super::GAS_FOR_QUORUM_UPDATE.as_tgas() >= 100);
        assert!(super::GAS_FOR_QUORUM_UPDATE.as_tgas() <= 200);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Constants")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "constants")]
    #[allure_test]
    #[test]
    fn test_max_description_length_constant() {
        // Verify the constant is as documented
        assert_eq!(super::MAX_DESCRIPTION_LEN, 10_000);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Constants")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "constants", "quorum")]
    #[allure_test]
    #[test]
    fn test_quorum_percent_constant() {
        // Verify the quorum percentage is 7%
        assert_eq!(super::QUORUM_PERCENT, 7);
    }

    // ==================== BRIDGE INFO TESTS ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Read Functions")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "query", "view")]
    #[allure_test]
    #[test]
    fn test_bridge_info_contains_all_fields() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "voter".to_string(),
        );

        let info = contract.get_info();
        assert_eq!(info.backend_wallet, accounts(0));
        assert_eq!(info.sputnik_dao, accounts(1));
        assert_eq!(info.verified_accounts_contract, accounts(2));
        assert_eq!(info.citizen_role, "voter");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Read Functions")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "query", "view")]
    #[allure_test]
    #[test]
    fn test_individual_getters_match_get_info() {
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        let info = contract.get_info();
        assert_eq!(contract.get_backend_wallet(), info.backend_wallet);
        assert_eq!(contract.get_sputnik_dao(), info.sputnik_dao);
        assert_eq!(contract.get_verified_accounts_contract(), info.verified_accounts_contract);
        assert_eq!(contract.get_citizen_role(), info.citizen_role);
    }

    // ==================== INVARIANT TESTS (Phase 2) ====================
    // Per OpenZeppelin best practices: verify system-wide invariants

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Invariants")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "invariant", "quorum")]
    #[allure_test]
    #[test]
    fn test_invariant_quorum_percent_valid_range() {
        // Invariant: QUORUM_PERCENT must be > 0 and <= 100
        assert!(QUORUM_PERCENT > 0, "QUORUM_PERCENT must be positive");
        assert!(QUORUM_PERCENT <= 100, "QUORUM_PERCENT must not exceed 100%");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Invariants")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "invariant", "quorum")]
    #[allure_test]
    #[test]
    fn test_invariant_quorum_never_exceeds_citizen_count() {
        // Invariant: For any citizen count N, quorum should be <= N
        // This ensures we never require more votes than possible
        for n in 0..1000 {
            let quorum = calculate_quorum(n);
            assert!(
                quorum <= n,
                "Quorum {} exceeded citizen count {} (invalid invariant)",
                quorum,
                n
            );
        }
    }


    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Invariants")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "invariant", "quorum")]
    #[allure_test]
    #[test]
    fn test_invariant_quorum_monotonic_increasing() {
        // Invariant: Quorum should be monotonically increasing with citizen count
        // i.e., more citizens should never decrease quorum
        let mut prev_quorum = 0u64;
        for n in 0..1000 {
            let quorum = calculate_quorum(n);
            assert!(
                quorum >= prev_quorum,
                "Quorum decreased from {} to {} at citizen count {} (non-monotonic)",
                prev_quorum,
                quorum,
                n
            );
            prev_quorum = quorum;
        }
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Invariants")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "invariant", "initialization")]
    #[allure_test]
    #[test]
    fn test_invariant_all_config_accounts_valid_after_init() {
        // Invariant: All configured account IDs should be valid after initialization
        let context = get_context(accounts(0));
        testing_env!(context.build());

        let contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // All account IDs should be non-empty
        assert!(
            !contract.get_backend_wallet().as_str().is_empty(),
            "Backend wallet should not be empty"
        );
        assert!(
            !contract.get_verified_accounts_contract().as_str().is_empty(),
            "Verified accounts contract should not be empty"
        );
        assert!(
            !contract.get_sputnik_dao().as_str().is_empty(),
            "SputnikDAO contract should not be empty"
        );
        assert!(
            !contract.get_citizen_role().is_empty(),
            "Citizen role should not be empty"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Invariants")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "invariant", "constants")]
    #[allure_test]
    #[test]
    fn test_invariant_max_description_length_positive() {
        // Invariant: MAX_DESCRIPTION_LEN must be positive
        assert!(MAX_DESCRIPTION_LEN > 0, "MAX_DESCRIPTION_LEN must be positive");
    }

    // ==================== CALLBACK TESTS (Phase 3) ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "verification")]
    #[allure_test]
    #[test]
    fn test_callback_add_member_verified() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&true).unwrap()
            )]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should succeed and schedule next promise (add_proposal)
        let _ = contract.callback_add_member(accounts(3));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "verification")]
    #[allure_test]
    #[test]
    fn test_callback_add_member_not_verified() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&false).unwrap()
            )]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        assert_panic_with(
            || {
                let _ = contract.callback_add_member(accounts(3));
            },
            "Account is not verified",
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "proposal")]
    #[allure_test]
    #[test]
    fn test_callback_proposal_created() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&1u64).unwrap()
            )]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should succeed and schedule next promise (act_proposal)
        let _ = contract.callback_proposal_created(accounts(3));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "member")]
    #[allure_test]
    #[test]
    fn test_callback_member_added() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should succeed and emit event + schedule get_policy
        let _ = contract.callback_member_added(accounts(3), 1);

        // Check for event emission
        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected logs to be emitted");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("member_added"), "Expected member_added event");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "policy")]
    #[allure_test]
    #[test]
    fn test_callback_policy_received_for_quorum() {
        let builder = get_context(accounts(0));
        
        // Mock Policy JSON
        let policy_json = near_sdk::serde_json::json!({
            "roles": [
                {
                    "name": "citizen",
                    "kind": { "Group": ["member1.near", "member2.near"] },
                    "permissions": []
                }
            ],
            "proposal_bond": "100"
        });
        
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&policy_json).unwrap()
            )]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // 2 members -> quorum ceil(2 * 0.07) = 1
        // Should succeed and schedule add_proposal (quorum update)
        let _ = contract.callback_policy_received_for_quorum();
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "quorum")]
    #[allure_test]
    #[test]
    fn test_callback_quorum_proposal_created() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&2u64).unwrap()
            )]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should succeed and schedule get_proposal
        let _ = contract.callback_quorum_proposal_created(2, 1);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "quorum")]
    #[allure_test]
    #[test]
    fn test_callback_got_quorum_proposal() {
        let builder = get_context(accounts(0));
        
        // Mock Proposal JSON (ProposalKind::ChangePolicyAddOrUpdateRole)
        // We just need the "kind" field structure
        let proposal_json = near_sdk::serde_json::json!({
            "kind": {
                "ChangePolicyAddOrUpdateRole": {
                    "role": {
                        "name": "citizen",
                        "kind": { "Group": ["member1.near"] },
                        "permissions": [],
                        "vote_policy": {}
                    }
                }
            }
        });

        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&proposal_json).unwrap()
            )]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should extract kind and schedule act_proposal
        let _ = contract.callback_got_quorum_proposal(2, 1, 2);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "quorum")]
    #[allure_test]
    #[test]
    fn test_callback_quorum_updated() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])]
        );

        let mut contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should succeed and emit event
        contract.callback_quorum_updated(2, 1, 2);
        
        // Check for event emission
        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected logs to be emitted");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("quorum_updated"), "Expected quorum_updated event");
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik Bridge Contract")]
    #[allure_story("Callbacks")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "callback", "proposal")]
    #[allure_test]
    #[test]
    fn test_callback_vote_proposal_created() {
        let builder = get_context(accounts(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(
                near_sdk::serde_json::to_vec(&3u64).unwrap()
            )]
        );

        let contract = SputnikBridge::new(
            accounts(0),
            accounts(1),
            accounts(2),
            "citizen".to_string(),
        );

        // Should succeed and emit event
        let _ = contract.callback_vote_proposal_created("desc".to_string());
        
        // Check for event emission
        let logs = get_logs();
        assert!(!logs.is_empty(), "Expected logs to be emitted");
        assert!(logs[0].contains("EVENT_JSON"), "Expected JSON event");
        assert!(logs[0].contains("proposal_created"), "Expected proposal_created event");
    }
}
