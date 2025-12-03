//! Integration tests for governance contract
//! Tests cross-contract calls and end-to-end workflows

use near_sdk::AccountId;
use near_workspaces::{network::Sandbox, Contract, Worker};
use serde_json::json;

const GOVERNANCE_WASM: &[u8] =
    include_bytes!("../target/near/governance.wasm");
const VERIFIED_ACCOUNTS_WASM: &[u8] = include_bytes!(
    "../../verified-accounts/target/near/verified_accounts.wasm"
);

/// Helper to setup test environment with both contracts
async fn setup() -> anyhow::Result<(Worker<Sandbox>, Contract, Contract, AccountId)> {
    let worker = near_workspaces::sandbox().await?;

    // Deploy verified-accounts contract
    let verified_accounts_contract = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;

    // Initialize verified-accounts contract
    let backend_account = worker.dev_create_account().await?;
    verified_accounts_contract
        .call("new")
        .args_json(json!({
            "backend_wallet": backend_account.id()
        }))
        .transact()
        .await?
        .into_result()?;

    // Deploy governance contract
    let governance_contract = worker.dev_deploy(GOVERNANCE_WASM).await?;

    // Initialize governance contract with reference to verified-accounts
    governance_contract
        .call("new")
        .args_json(json!({
            "verified_accounts_contract": verified_accounts_contract.id()
        }))
        .transact()
        .await?
        .into_result()?;

    Ok((
        worker,
        governance_contract,
        verified_accounts_contract,
        backend_account.id().to_string().parse()?,
    ))
}

#[tokio::test]
async fn test_contract_initialization() -> anyhow::Result<()> {
    let (_, governance, verified_accounts, _) = setup().await?;

    // Check governance parameters
    let params: serde_json::Value = governance.view("get_parameters").await?.json()?;

    assert_eq!(params.get("voting_period_days"), Some(&serde_json::json!(7)));
    // Quorum is now per-proposal, so we check the bounds and default
    assert_eq!(params.get("quorum_percentage_min"), Some(&serde_json::json!(1)));
    assert_eq!(params.get("quorum_percentage_max"), Some(&serde_json::json!(100)));
    assert_eq!(params.get("quorum_percentage_default"), Some(&serde_json::json!(10)));

    // Check verified accounts reference
    let va_contract: String = governance
        .view("get_verified_accounts_contract")
        .await?
        .json()?;

    assert_eq!(va_contract, verified_accounts.id().to_string());

    // Check proposal count is zero
    let count: u64 = governance.view("get_proposal_count").await?.json()?;

    assert_eq!(count, 0);

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_not_verified() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    // Create unverified user
    let unverified_user = worker.dev_create_account().await?;

    // Try to create proposal (should fail - not verified)
    let result = unverified_user
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Test Proposal",
            "description": "This should fail",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;

    // Should fail with "Only verified citizens can create proposals"
    assert!(result.is_failure());

    // Proposal count should still be 0
    let count: u64 = governance.view("get_proposal_count").await?.json()?;

    assert_eq!(count, 0);

    Ok(())
}

#[tokio::test]
async fn test_vote_not_verified() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    // Create unverified user
    let unverified_user = worker.dev_create_account().await?;

    // Try to vote (should fail - not verified)
    let result = unverified_user
        .call(governance.id(), "vote")
        .args_json(json!({
            "proposal_id": 0,
            "vote": "Yes"
        }))
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;

    // Should fail with "Only verified citizens can vote"
    assert!(result.is_failure());

    Ok(())
}

#[tokio::test]
async fn test_get_proposals_empty() -> anyhow::Result<()> {
    let (_, governance, _, _) = setup().await?;

    // Get proposals (should be empty)
    let proposals: Vec<serde_json::Value> = governance
        .view("get_proposals")
        .args_json(json!({
            "from_index": 0,
            "limit": 50,
            "status": null
        }))
        .await?
        .json()?;

    assert_eq!(proposals.len(), 0);

    Ok(())
}

#[tokio::test]
async fn test_get_proposal_not_found() -> anyhow::Result<()> {
    let (_, governance, _, _) = setup().await?;

    // Get non-existent proposal
    let proposal: Option<serde_json::Value> = governance
        .view("get_proposal")
        .args_json(json!({
            "proposal_id": 999
        }))
        .await?
        .json()?;

    assert!(proposal.is_none());

    Ok(())
}

#[tokio::test]
async fn test_get_vote_counts_default() -> anyhow::Result<()> {
    let (_, governance, _, _) = setup().await?;

    // Get vote counts for non-existent proposal (should return defaults)
    let counts: serde_json::Value = governance
        .view("get_vote_counts")
        .args_json(json!({
            "proposal_id": 0
        }))
        .await?
        .json()?;

    assert_eq!(counts.get("yes_votes"), Some(&serde_json::json!(0)));
    assert_eq!(counts.get("no_votes"), Some(&serde_json::json!(0)));
    assert_eq!(counts.get("abstain_votes"), Some(&serde_json::json!(0)));
    assert_eq!(counts.get("total_votes"), Some(&serde_json::json!(0)));

    Ok(())
}

#[tokio::test]
async fn test_has_voted_false() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    let user = worker.dev_create_account().await?;

    // Check if user has voted (should be false)
    let has_voted: bool = governance
        .view("has_voted")
        .args_json(json!({
            "proposal_id": 0,
            "account_id": user.id()
        }))
        .await?
        .json()?;

    assert!(!has_voted);

    Ok(())
}

#[tokio::test]
async fn test_get_vote_none() -> anyhow::Result<()> {
    let (worker, governance, _, _) = setup().await?;

    let user = worker.dev_create_account().await?;

    // Get vote (should be None)
    let vote: Option<String> = governance
        .view("get_vote")
        .args_json(json!({
            "proposal_id": 0,
            "account_id": user.id()
        }))
        .await?
        .json()?;

    assert!(vote.is_none());

    Ok(())
}

// Note: Full end-to-end tests with actual verification would require
// implementing a mock verified-accounts contract or setting up the full
// verification flow. These basic tests verify the contract structure,
// cross-contract call patterns, and view methods work correctly.

// Additional tests to implement with proper verification setup:
// - test_create_proposal_verified
// - test_vote_verified
// - test_vote_twice_fails
// - test_finalize_proposal
// - test_quorum_not_met
// - test_proposal_passed
// - test_proposal_failed
// - test_cancel_proposal
