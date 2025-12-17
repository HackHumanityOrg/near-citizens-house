//! Independent Sputnik DAO sanity tests
//!
//! These tests verify the DAO submodule works correctly in isolation,
//! without going through the bridge contract. This ensures the DAO
//! component functions as expected and catches any configuration issues.

use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{network::Sandbox, Account, Contract, Worker};
use serde_json::json;

/// SputnikDAO v2 contract WASM
const SPUTNIKDAO_WASM: &[u8] =
    include_bytes!("../../../sputnik-dao-contract/sputnikdao2/res/sputnikdao2.wasm");

/// Proposal period in nanoseconds (10 seconds for fast testing)
const PROPOSAL_PERIOD_NS: u64 = 10_000_000_000;

/// Create a simple council-based policy for testing
fn create_council_policy(council_member: &str) -> serde_json::Value {
    json!({
        "roles": [
            {
                "name": "all",
                "kind": "Everyone",
                "permissions": ["*:Finalize"],
                "vote_policy": {}
            },
            {
                "name": "council",
                "kind": {
                    "Group": [council_member]
                },
                "permissions": [
                    "*:AddProposal",
                    "*:VoteApprove",
                    "*:VoteReject",
                    "*:VoteRemove"
                ],
                "vote_policy": {}
            }
        ],
        "default_vote_policy": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [1, 2]
        },
        "proposal_bond": "1000000000000000000000000",
        "proposal_period": PROPOSAL_PERIOD_NS.to_string(),
        "bounty_bond": "1000000000000000000000000",
        "bounty_forgiveness_period": "86400000000000"
    })
}

/// Deploy a standalone DAO instance for testing
async fn setup_standalone_dao() -> anyhow::Result<(Worker<Sandbox>, Contract, Account)> {
    let worker = near_workspaces::sandbox().await?;

    // Create council member account
    let council = worker.dev_create_account().await?;

    // Deploy sputnik-dao
    let dao = worker.dev_deploy(SPUTNIKDAO_WASM).await?;
    let policy = create_council_policy(council.id().as_str());

    dao.call("new")
        .args_json(json!({
            "config": {
                "name": "test-dao",
                "purpose": "Sanity testing",
                "metadata": ""
            },
            "policy": policy
        }))
        .transact()
        .await?
        .into_result()?;

    Ok((worker, dao, council))
}

/// Proposal status enum (matches sputnik-dao)
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum ProposalStatus {
    InProgress,
    Approved,
    Rejected,
    Removed,
    Expired,
    Moved,
    Failed,
}

/// Proposal output from sputnik-dao
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProposalOutput {
    pub id: u64,
    pub proposer: String,
    pub description: String,
    pub kind: serde_json::Value,
    pub status: ProposalStatus,
}

// ==================== DAO SANITY TESTS ====================

/// Test 1: DAO deploys and initializes correctly
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Sanity Tests")]
#[allure_severity("critical")]
#[allure_tags("integration", "dao", "sanity")]
#[allure_description(
    "Verifies the SputnikDAO submodule deploys and initializes correctly with council policy."
)]
#[allure_test]
#[tokio::test]
async fn test_dao_deploys_and_initializes() -> anyhow::Result<()> {
    let (_worker, dao, council) = setup_standalone_dao().await?;

    // Verify DAO is initialized by querying config
    let config: serde_json::Value = dao.view("get_config").await?.json()?;

    step("Verify DAO config is set correctly", || {
        assert_eq!(config["name"], "test-dao", "DAO name should be set");
        assert_eq!(
            config["purpose"], "Sanity testing",
            "DAO purpose should be set"
        );
    });

    // Verify policy has the council member
    let policy: serde_json::Value = dao.view("get_policy").await?.json()?;
    let roles = policy["roles"].as_array().expect("roles should be an array");

    let council_role = roles
        .iter()
        .find(|r| r["name"] == "council")
        .expect("council role should exist");

    let group = council_role["kind"]["Group"]
        .as_array()
        .expect("council kind should be Group");

    step("Verify council member is in policy", || {
        assert!(
            group.iter().any(|m| m.as_str() == Some(council.id().as_str())),
            "Council member should be in the group"
        );
    });

    Ok(())
}

/// Test 2: Council member can create and approve a proposal
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Sanity Tests")]
#[allure_severity("critical")]
#[allure_tags("integration", "dao", "proposal", "voting")]
#[allure_description(
    "Verifies that a council member can create a Vote proposal and approve it through the DAO."
)]
#[allure_test]
#[tokio::test]
async fn test_dao_proposal_lifecycle_without_bridge() -> anyhow::Result<()> {
    let (_worker, dao, council) = setup_standalone_dao().await?;

    // Create a Vote proposal as council member
    let result = council
        .call(dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "Test proposal created directly",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    step("Verify council can create proposal", || {
        assert!(
            result.is_success(),
            "Council should be able to create proposal"
        );
    });

    // Get the proposal ID from return value
    let proposal_id: u64 = result.json()?;

    step("Verify first proposal has ID 0", || {
        assert_eq!(proposal_id, 0, "First proposal should have ID 0");
    });

    // Verify proposal is InProgress
    let proposal: ProposalOutput = dao
        .view("get_proposal")
        .args_json(json!({ "id": proposal_id }))
        .await?
        .json()?;

    step("Verify proposal is InProgress with correct description", || {
        assert_eq!(
            proposal.status,
            ProposalStatus::InProgress,
            "Proposal should be InProgress"
        );
        assert_eq!(
            proposal.description, "Test proposal created directly",
            "Proposal description should match"
        );
    });

    // Council member votes to approve
    let vote_result = council
        .call(dao.id(), "act_proposal")
        .args_json(json!({
            "id": proposal_id,
            "action": "VoteApprove",
            "proposal": "Vote",
            "memo": null
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    step("Verify council vote succeeds", || {
        assert!(
            vote_result.is_success(),
            "Vote should succeed: {:?}",
            vote_result.failures()
        );
    });

    // Verify proposal is now Approved (single council member = 100% approval)
    let proposal_after: ProposalOutput = dao
        .view("get_proposal")
        .args_json(json!({ "id": proposal_id }))
        .await?
        .json()?;

    step("Verify proposal is Approved after council vote", || {
        assert_eq!(
            proposal_after.status,
            ProposalStatus::Approved,
            "Proposal should be Approved after council vote"
        );
    });

    Ok(())
}

/// Test 3: Non-council member cannot create proposals (without permission)
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Sanity Tests")]
#[allure_severity("critical")]
#[allure_tags("integration", "dao", "security", "authorization")]
#[allure_description(
    "Verifies that a non-council member cannot create proposals when they lack the AddProposal permission."
)]
#[allure_test]
#[tokio::test]
async fn test_dao_non_council_cannot_create_proposal() -> anyhow::Result<()> {
    let (worker, dao, _council) = setup_standalone_dao().await?;

    // Create a random user (not in council)
    let random_user = worker.dev_create_account().await?;

    // Try to create a proposal as non-council member
    // The 'all' role only has Finalize permission, not AddProposal
    let result = random_user
        .call(dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "Unauthorized proposal attempt",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    step("Verify non-council member cannot create proposal", || {
        assert!(
            result.is_failure(),
            "Non-council member should not be able to create proposal"
        );
    });

    Ok(())
}

/// Test 4: DAO tracks proposal count correctly
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Sanity Tests")]
#[allure_severity("normal")]
#[allure_tags("integration", "dao", "state")]
#[allure_description("Verifies the DAO correctly tracks proposal IDs and counts.")
]
#[allure_test]
#[tokio::test]
async fn test_dao_proposal_counting() -> anyhow::Result<()> {
    let (_worker, dao, council) = setup_standalone_dao().await?;

    // Get initial last proposal ID (should fail or return 0 if no proposals)
    let initial_id: u64 = dao.view("get_last_proposal_id").await?.json()?;

    step("Verify initial proposal count is 0", || {
        assert_eq!(initial_id, 0, "Initial last proposal ID should be 0");
    });

    // Create first proposal
    let result1 = council
        .call(dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "First proposal",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    let id1: u64 = result1.json()?;

    step("Verify first proposal created with ID 0", || {
        assert!(result1.is_success(), "First proposal should succeed");
        assert_eq!(id1, 0, "First proposal ID should be 0");
    });

    // Create second proposal
    let result2 = council
        .call(dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "Second proposal",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    let id2: u64 = result2.json()?;

    step("Verify second proposal created with ID 1", || {
        assert!(result2.is_success(), "Second proposal should succeed");
        assert_eq!(id2, 1, "Second proposal ID should be 1");
    });

    // Verify last proposal ID updated
    let final_id: u64 = dao.view("get_last_proposal_id").await?.json()?;

    step("Verify final proposal count is 2", || {
        assert_eq!(final_id, 2, "Last proposal ID should be 2 after creating 2 proposals");
    });

    Ok(())
}

/// Test 5: Council member can reject a proposal
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Sanity Tests")]
#[allure_severity("normal")]
#[allure_tags("integration", "dao", "voting")]
#[allure_description("Verifies that a council member can vote to reject a proposal.")
]
#[allure_test]
#[tokio::test]
async fn test_dao_proposal_rejection() -> anyhow::Result<()> {
    let (_worker, dao, council) = setup_standalone_dao().await?;

    // Create a Vote proposal
    let result = council
        .call(dao.id(), "add_proposal")
        .args_json(json!({
            "proposal": {
                "description": "Proposal to reject",
                "kind": "Vote"
            }
        }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    let proposal_id: u64 = result.json()?;

    // Council member votes to reject
    let vote_result = council
        .call(dao.id(), "act_proposal")
        .args_json(json!({
            "id": proposal_id,
            "action": "VoteReject",
            "proposal": "Vote",
            "memo": null
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    step("Verify reject vote succeeds", || {
        assert!(
            vote_result.is_success(),
            "Reject vote should succeed: {:?}",
            vote_result.failures()
        );
    });

    // Verify proposal is now Rejected
    let proposal_after: ProposalOutput = dao
        .view("get_proposal")
        .args_json(json!({ "id": proposal_id }))
        .await?
        .json()?;

    step("Verify proposal is Rejected after council vote", || {
        assert_eq!(
            proposal_after.status,
            ProposalStatus::Rejected,
            "Proposal should be Rejected after council vote"
        );
    });

    Ok(())
}
