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

use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near, AccountId, Gas, NearSchema, PanicOnDefault, Promise, PromiseResult};
use sputnik_dao_interface::{ext_sputnik_dao, Action, ProposalInput, ProposalKind};
use verified_accounts_interface::ext_verified_accounts;

/// Maximum description length for proposals (prevents storage abuse)
const MAX_DESCRIPTION_LEN: usize = 10_000;

/// Gas allocations for cross-contract calls
const GAS_FOR_VERIFICATION: Gas = Gas::from_tgas(5);
const GAS_FOR_ADD_PROPOSAL: Gas = Gas::from_tgas(50);
const GAS_FOR_ACT_PROPOSAL: Gas = Gas::from_tgas(50);
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(20);

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

/// Helper to emit JSON events in NEAR standard format
fn emit_event<T: Serialize>(event_name: &str, data: &T) {
    if let Ok(json) = near_sdk::serde_json::to_string(data) {
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"sputnik-bridge\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}",
            event_name, json
        ));
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
        ext_verified_accounts::ext(self.verified_accounts_contract.clone())
            .with_static_gas(GAS_FOR_VERIFICATION)
            .is_account_verified(near_account_id.clone())
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_ADD_PROPOSAL.saturating_add(GAS_FOR_ACT_PROPOSAL).saturating_add(GAS_FOR_CALLBACK))
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
                    .with_static_gas(GAS_FOR_ACT_PROPOSAL.saturating_add(GAS_FOR_CALLBACK))
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
                    .with_static_gas(GAS_FOR_CALLBACK)
                    .callback_member_added(near_account_id, proposal_id),
            )
    }

    /// Final callback after member is added
    #[private]
    pub fn callback_member_added(&mut self, near_account_id: AccountId, proposal_id: u64) {
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

        // Input validation
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
    #[payable]
    pub fn update_citizen_role(&mut self, new_role: String) {
        self.assert_backend_wallet();
        self.citizen_role = new_role;
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

    #[test]
    #[should_panic(expected = "Only backend wallet can call this function")]
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

        contract.update_backend_wallet(accounts(3));
    }

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

    #[test]
    #[should_panic(expected = "Only backend wallet can call this function")]
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

        contract.update_citizen_role("voter".to_string());
    }
}
