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

#[cfg(test)]
#[allure_rs::allure_suite("Sputnik DAO Interface")]
mod tests {
    use super::*;
    use allure_rs::prelude::*;

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("ProposalInput Type")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "serialization", "proposals")]
    #[allure_test]
    #[test]
    fn test_proposal_input_serialization() {
        let input = ProposalInput {
            description: "Test proposal".to_string(),
            kind: ProposalKind::Vote,
        };

        // Test JSON serialization
        let json = near_sdk::serde_json::to_string(&input).unwrap();
        assert!(json.contains("Test proposal"));
        assert!(json.contains("Vote"));

        // Verify it can be deserialized
        let decoded: ProposalInput = near_sdk::serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.description, input.description);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("ProposalKind Type")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "serialization", "membership")]
    #[allure_test]
    #[test]
    fn test_add_member_to_role_serialization() {
        let input = ProposalInput {
            description: "Add new member".to_string(),
            kind: ProposalKind::AddMemberToRole {
                member_id: "alice.near".parse().unwrap(),
                role: "citizen".to_string(),
            },
        };

        let json = near_sdk::serde_json::to_string(&input).unwrap();
        assert!(json.contains("alice.near"));
        assert!(json.contains("citizen"));
        assert!(json.contains("AddMemberToRole"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("Action Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "voting")]
    #[allure_test]
    #[test]
    fn test_action_serialization() {
        let action = Action::VoteApprove;
        let json = near_sdk::serde_json::to_string(&action).unwrap();
        assert!(json.contains("VoteApprove"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("ProposalKind Type")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "serialization", "policy")]
    #[allure_test]
    #[test]
    fn test_change_policy_add_or_update_role_serialization() {
        use std::collections::HashMap;

        let mut vote_policy = HashMap::new();
        vote_policy.insert(
            "vote".to_string(),
            VotePolicy {
                weight_kind: WeightKind::RoleWeight,
                quorum: U128(0),
                threshold: WeightOrRatio::Ratio(7, 100),
            },
        );

        let input = ProposalInput {
            description: "Update citizen role threshold".to_string(),
            kind: ProposalKind::ChangePolicyAddOrUpdateRole {
                role: RolePermission {
                    name: "citizen".to_string(),
                    kind: RoleKind::Group(vec!["alice.near".parse().unwrap()]),
                    permissions: vec!["vote:VoteApprove".to_string()],
                    vote_policy,
                },
            },
        };

        let json = near_sdk::serde_json::to_string(&input).unwrap();
        assert!(json.contains("ChangePolicyAddOrUpdateRole"));
        assert!(json.contains("citizen"));
        assert!(json.contains("alice.near"));

        // Verify it can be deserialized
        let decoded: ProposalInput = near_sdk::serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.description, input.description);
    }

    // ==================== ADDITIONAL TYPE SERIALIZATION TESTS (Phase 3) ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("Action Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "voting")]
    #[allure_test]
    #[test]
    fn test_all_action_variants_serialization() {
        // Test all Action variants serialize correctly
        let actions = vec![
            (Action::VoteApprove, "VoteApprove"),
            (Action::VoteReject, "VoteReject"),
            (Action::VoteRemove, "VoteRemove"),
            (Action::Finalize, "Finalize"),
            (Action::MoveToHub, "MoveToHub"),
        ];

        for (action, expected_str) in actions {
            let json = near_sdk::serde_json::to_string(&action).unwrap();
            assert!(
                json.contains(expected_str),
                "Action {:?} should serialize to contain '{}'",
                action,
                expected_str
            );
        }
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("ProposalKind Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "membership")]
    #[allure_test]
    #[test]
    fn test_remove_member_from_role_serialization() {
        let kind = ProposalKind::RemoveMemberFromRole {
            member_id: "bob.near".parse().unwrap(),
            role: "council".to_string(),
        };

        let json = near_sdk::serde_json::to_string(&kind).unwrap();
        assert!(json.contains("RemoveMemberFromRole"));
        assert!(json.contains("bob.near"));
        assert!(json.contains("council"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("RoleKind Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "roles")]
    #[allure_test]
    #[test]
    fn test_role_kind_everyone_serialization() {
        let kind = RoleKind::Everyone;
        let json = near_sdk::serde_json::to_string(&kind).unwrap();
        assert!(json.contains("Everyone"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("RoleKind Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "roles")]
    #[allure_test]
    #[test]
    fn test_role_kind_group_serialization() {
        let kind = RoleKind::Group(vec![
            "alice.near".parse().unwrap(),
            "bob.near".parse().unwrap(),
            "carol.near".parse().unwrap(),
        ]);

        let json = near_sdk::serde_json::to_string(&kind).unwrap();
        assert!(json.contains("alice.near"));
        assert!(json.contains("bob.near"));
        assert!(json.contains("carol.near"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("VotePolicy Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "voting")]
    #[allure_test]
    #[test]
    fn test_weight_kind_serialization() {
        let role_weight = WeightKind::RoleWeight;
        let token_weight = WeightKind::TokenWeight;

        let json1 = near_sdk::serde_json::to_string(&role_weight).unwrap();
        let json2 = near_sdk::serde_json::to_string(&token_weight).unwrap();

        assert!(json1.contains("RoleWeight"));
        assert!(json2.contains("TokenWeight"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("VotePolicy Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "voting")]
    #[allure_test]
    #[test]
    fn test_weight_or_ratio_weight_serialization() {
        let weight = WeightOrRatio::Weight(U128(1000));
        let json = near_sdk::serde_json::to_string(&weight).unwrap();
        assert!(json.contains("1000"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("VotePolicy Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "voting")]
    #[allure_test]
    #[test]
    fn test_weight_or_ratio_ratio_serialization() {
        let ratio = WeightOrRatio::Ratio(1, 2);
        let json = near_sdk::serde_json::to_string(&ratio).unwrap();
        // Ratio serializes as [1,2] due to #[serde(untagged)]
        assert!(json.contains("1"));
        assert!(json.contains("2"));
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("VotePolicy Type")]
    #[allure_severity("critical")]
    #[allure_tags("unit", "serialization", "voting")]
    #[allure_test]
    #[test]
    fn test_vote_policy_serialization() {
        let policy = VotePolicy {
            weight_kind: WeightKind::RoleWeight,
            quorum: U128(7),
            threshold: WeightOrRatio::Ratio(1, 2),
        };

        let json = near_sdk::serde_json::to_string(&policy).unwrap();
        assert!(json.contains("RoleWeight"));
        assert!(json.contains("\"7\"")); // U128 serializes as string

        // Test roundtrip
        let decoded: VotePolicy = near_sdk::serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.quorum.0, 7);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("ProposalInput Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "borsh")]
    #[allure_test]
    #[test]
    fn test_proposal_input_borsh_roundtrip() {
        let input = ProposalInput {
            description: "Test proposal for Borsh".to_string(),
            kind: ProposalKind::Vote,
        };

        let borsh = near_sdk::borsh::to_vec(&input).unwrap();
        let decoded: ProposalInput = near_sdk::borsh::from_slice(&borsh).unwrap();
        assert_eq!(decoded.description, input.description);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("RolePermission Type")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "serialization", "borsh")]
    #[allure_test]
    #[test]
    fn test_role_permission_borsh_roundtrip() {
        use std::collections::HashMap;

        let role = RolePermission {
            name: "citizen".to_string(),
            kind: RoleKind::Group(vec!["alice.near".parse().unwrap()]),
            permissions: vec![
                "vote:VoteApprove".to_string(),
                "vote:VoteReject".to_string(),
            ],
            vote_policy: HashMap::new(),
        };

        let borsh = near_sdk::borsh::to_vec(&role).unwrap();
        let decoded: RolePermission = near_sdk::borsh::from_slice(&borsh).unwrap();
        assert_eq!(decoded.name, role.name);
        assert_eq!(decoded.permissions.len(), 2);
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("RoleKind Type")]
    #[allure_severity("minor")]
    #[allure_tags("unit", "serialization", "edge-case")]
    #[allure_test]
    #[test]
    fn test_empty_group_serialization() {
        let kind = RoleKind::Group(vec![]);
        let json = near_sdk::serde_json::to_string(&kind).unwrap();

        let decoded: RoleKind = near_sdk::serde_json::from_str(&json).unwrap();
        if let RoleKind::Group(members) = decoded {
            assert!(members.is_empty());
        } else {
            panic!("Expected Group variant");
        }
    }

    // ==================== NEGATIVE DESERIALIZATION TESTS ====================

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_proposal_kind_unknown_variant_deserialization_fails() {
        // Unknown enum variant should fail deserialization
        let json = r#"{"UnknownVariant":{}}"#;
        let result: Result<ProposalKind, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail for unknown ProposalKind variant"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_action_invalid_string_deserialization_fails() {
        // Invalid Action variant should fail deserialization
        let json = r#""InvalidAction""#;
        let result: Result<Action, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail for invalid Action string"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_weight_or_ratio_empty_array_fails() {
        // WeightOrRatio with empty array should fail
        let json = r#"[]"#;
        let result: Result<WeightOrRatio, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail for empty WeightOrRatio array"
        );
    }

    #[allure_epic("Smart Contracts")]
    #[allure_feature("Sputnik DAO Interface")]
    #[allure_story("Validation")]
    #[allure_severity("normal")]
    #[allure_tags("unit", "validation", "negative")]
    #[allure_test]
    #[test]
    fn test_role_permission_missing_name_fails() {
        // RolePermission without required 'name' field should fail
        let json = r#"{"kind":"Everyone","permissions":[],"vote_policy":{}}"#;
        let result: Result<RolePermission, _> = near_sdk::serde_json::from_str(json);
        assert!(
            result.is_err(),
            "Deserialization should fail when 'name' is missing"
        );
    }
}
