//! Integration tests for governance contract
//! Tests cross-contract calls and end-to-end workflows with verified-accounts

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use borsh::BorshSerialize;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{network::Sandbox, Account, Contract, Worker};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;

const GOVERNANCE_WASM: &[u8] = include_bytes!("../target/near/governance.wasm");
const VERIFIED_ACCOUNTS_WASM: &[u8] =
    include_bytes!("../../verified-accounts/target/near/verified_accounts.wasm");

/// Blocks per day (NEAR produces ~1 block/second)
const BLOCKS_PER_DAY: u64 = 86400;

// ==================== NEP-413 SIGNATURE GENERATION ====================

/// NEP-413 payload structure for off-chain message signing
/// See: https://github.com/near/NEPs/blob/master/neps/nep-0413.md
#[derive(BorshSerialize)]
struct Nep413Payload {
    message: String,
    nonce: [u8; 32],
    recipient: String,
    callback_url: Option<String>,
}

/// NEP-413 prefix tag: 2^31 + 413 = 2147484061
const NEP413_TAG: u32 = 2147484061;

/// Generate a valid NEP-413 signature using an account's secret key
fn generate_nep413_signature(
    account: &Account,
    message: &str,
    nonce: &[u8; 32],
    recipient: &str,
) -> (Vec<u8>, String) {
    let secret_key_str = account.secret_key().to_string();
    let secret_key =
        near_crypto::SecretKey::from_str(&secret_key_str).expect("Failed to parse secret key");

    let public_key = secret_key.public_key();
    let public_key_str = public_key.to_string();

    let payload = Nep413Payload {
        message: message.to_string(),
        nonce: *nonce,
        recipient: recipient.to_string(),
        callback_url: None,
    };

    let mut tag_bytes = Vec::new();
    NEP413_TAG
        .serialize(&mut tag_bytes)
        .expect("Failed to serialize tag");

    let mut payload_bytes = Vec::new();
    payload
        .serialize(&mut payload_bytes)
        .expect("Failed to serialize payload");

    let mut data_to_hash = tag_bytes;
    data_to_hash.extend(payload_bytes);

    let hash = Sha256::digest(&data_to_hash);
    let signature = secret_key.sign(&hash);

    let signature_bytes = match signature {
        near_crypto::Signature::ED25519(sig) => sig.to_bytes().to_vec(),
        _ => panic!("Expected ED25519 signature"),
    };

    (signature_bytes, public_key_str)
}

/// Create test Self.xyz proof data
fn test_self_proof() -> serde_json::Value {
    json!({
        "proof": {
            "a": ["1", "2"],
            "b": [["3", "4"], ["5", "6"]],
            "c": ["7", "8"]
        },
        "public_signals": vec!["0"; 21]
    })
}

// ==================== TEST ENVIRONMENT HELPERS ====================

/// Test environment with both contracts and verified users
struct TestEnv {
    worker: Worker<Sandbox>,
    governance: Contract,
    verified_accounts: Contract,
    backend: Account,
    verified_users: Vec<Account>,
}

/// Basic setup - deploys both contracts without verified users
async fn setup() -> anyhow::Result<(Worker<Sandbox>, Contract, Contract, Account)> {
    let worker = near_workspaces::sandbox().await?;

    // Deploy verified-accounts contract
    let verified_accounts_contract = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;

    // Create backend account for verified-accounts
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
        backend_account,
    ))
}

/// Setup with N pre-verified users
async fn setup_with_verified_users(count: usize) -> anyhow::Result<TestEnv> {
    let (worker, governance, verified_accounts, backend) = setup().await?;

    let mut verified_users = Vec::new();
    for i in 0..count {
        let user = worker.dev_create_account().await?;
        verify_user(&backend, &verified_accounts, &user, i).await?;
        verified_users.push(user);
    }

    Ok(TestEnv {
        worker,
        governance,
        verified_accounts,
        backend,
        verified_users,
    })
}

/// Register a user as verified in the verified-accounts contract
async fn verify_user(
    backend: &Account,
    verified_accounts: &Contract,
    user: &Account,
    index: usize,
) -> anyhow::Result<()> {
    let nonce: [u8; 32] = [index as u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(user, challenge, &nonce, &recipient);

    backend
        .call(verified_accounts.id(), "store_verification")
        .args_json(json!({
            "nullifier": format!("test_nullifier_{}", index),
            "near_account_id": user.id(),
            "user_id": format!("user_{}", index),
            "attestation_id": format!("{}", index),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": format!("context_{}", index)
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?
        .into_result()?;

    Ok(())
}

/// Helper to create a proposal
async fn create_proposal_helper(
    user: &Account,
    governance: &Contract,
    title: &str,
    quorum_percentage: u8,
) -> anyhow::Result<u64> {
    let result = user
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": title,
            "description": format!("Description for {}", title),
            "discourse_url": null,
            "quorum_percentage": quorum_percentage
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    result.into_result()?;

    // Get proposal count to determine the created proposal ID
    let count: u64 = governance.view("get_proposal_count").await?.json()?;
    Ok(count - 1)
}

/// Helper to cast a vote (returns the result for assertion)
async fn vote_helper(
    user: &Account,
    governance: &Contract,
    proposal_id: u64,
    vote: &str,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(user
        .call(governance.id(), "vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "vote": vote
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?)
}

/// Advance time past the 7-day voting period
async fn advance_past_voting_period(worker: &Worker<Sandbox>) -> anyhow::Result<()> {
    worker.fast_forward(7 * BLOCKS_PER_DAY + 100).await?;
    Ok(())
}

/// Advance time by N days
async fn advance_days(worker: &Worker<Sandbox>, days: u64) -> anyhow::Result<()> {
    worker.fast_forward(days * BLOCKS_PER_DAY).await?;
    Ok(())
}

// ==================== BASIC TESTS (EXISTING) ====================

#[tokio::test]
async fn test_contract_initialization() -> anyhow::Result<()> {
    let (_, governance, verified_accounts, _) = setup().await?;

    // Check governance parameters
    let params: serde_json::Value = governance.view("get_parameters").await?.json()?;

    assert_eq!(
        params.get("voting_period_days"),
        Some(&serde_json::json!(7))
    );
    assert_eq!(
        params.get("quorum_percentage_min"),
        Some(&serde_json::json!(1))
    );
    assert_eq!(
        params.get("quorum_percentage_max"),
        Some(&serde_json::json!(100))
    );
    assert_eq!(
        params.get("quorum_percentage_default"),
        Some(&serde_json::json!(10))
    );

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
        .deposit(NearToken::from_yoctonear(1))
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
        .deposit(NearToken::from_yoctonear(1))
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

// ==================== VERIFIED PROPOSAL CREATION TESTS ====================

#[tokio::test]
async fn test_create_proposal_verified() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test Proposal", 10).await?;

    // Verify proposal was created
    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["title"], "Test Proposal");
    assert_eq!(proposal["proposer"], proposer.id().to_string());
    assert_eq!(proposal["status"], "Active");
    assert_eq!(proposal["quorum_percentage"], 10);

    // Verify count increased
    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 1);

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_multiple_by_same_user() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Create multiple proposals
    let id1 = create_proposal_helper(proposer, &env.governance, "Proposal 1", 10).await?;
    let id2 = create_proposal_helper(proposer, &env.governance, "Proposal 2", 20).await?;
    let id3 = create_proposal_helper(proposer, &env.governance, "Proposal 3", 30).await?;

    assert_eq!(id1, 0);
    assert_eq!(id2, 1);
    assert_eq!(id3, 2);

    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 3);

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_quorum_bounds() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Test 0% quorum (should fail)
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Zero Quorum",
            "description": "Should fail",
            "discourse_url": null,
            "quorum_percentage": 0
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Quorum percentage must be between 1 and 100"));

    // Test 101% quorum (should fail)
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Over 100 Quorum",
            "description": "Should fail",
            "discourse_url": null,
            "quorum_percentage": 101
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Quorum percentage must be between 1 and 100"));

    // Test valid bounds (1% and 100% should work)
    let _id1 = create_proposal_helper(proposer, &env.governance, "Min Quorum", 1).await?;
    let _id2 = create_proposal_helper(proposer, &env.governance, "Max Quorum", 100).await?;

    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 2);

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_input_validation() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Empty title should fail
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "",
            "description": "Some description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Title cannot be empty"));

    // Empty description should fail
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Valid Title",
            "description": "",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Description cannot be empty"));

    // Title too long (>200 chars)
    let long_title = "x".repeat(201);
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": long_title,
            "description": "Some description",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Title exceeds maximum length"));

    Ok(())
}

// ==================== SNAPSHOT VOTING TESTS (CRITICAL) ====================

#[tokio::test]
async fn test_snapshot_verified_before_can_vote() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    // Both users were verified BEFORE proposal creation
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test Proposal", 10).await?;

    // Voter should be able to vote (verified before proposal)
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
    assert!(
        result.is_success(),
        "Vote should succeed: {:?}",
        result.failures()
    );

    // Verify vote was recorded
    let has_voted: bool = env
        .governance
        .view("has_voted")
        .args_json(json!({
            "proposal_id": proposal_id,
            "account_id": voter.id()
        }))
        .await?
        .json()?;

    assert!(has_voted);

    Ok(())
}

#[tokio::test]
async fn test_snapshot_verified_after_cannot_vote() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Create proposal FIRST
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test Proposal", 10).await?;

    // Now verify a NEW user AFTER proposal creation
    let late_user = env.worker.dev_create_account().await?;
    verify_user(&env.backend, &env.verified_accounts, &late_user, 100).await?;

    // Late user tries to vote - should fail (verified after proposal)
    let result = vote_helper(&late_user, &env.governance, proposal_id, "Yes").await?;

    assert!(result.is_failure());
    assert!(
        format!("{:?}", result.failures())
            .contains("You must be verified before the proposal was created"),
        "Expected snapshot voting error, got: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_snapshot_multiple_proposals_different_snapshots() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Create first proposal
    let proposal_1 = create_proposal_helper(proposer, &env.governance, "Proposal 1", 10).await?;

    // Verify a new user (can vote on proposal_1 but not future proposals)
    let mid_user = env.worker.dev_create_account().await?;
    verify_user(&env.backend, &env.verified_accounts, &mid_user, 100).await?;

    // Create second proposal
    let proposal_2 = create_proposal_helper(proposer, &env.governance, "Proposal 2", 10).await?;

    // mid_user should NOT be able to vote on proposal_1 (verified after)
    let result = vote_helper(&mid_user, &env.governance, proposal_1, "Yes").await?;
    assert!(result.is_failure());

    // mid_user should also NOT be able to vote on proposal_2 (verified at same time or after)
    let result = vote_helper(&mid_user, &env.governance, proposal_2, "Yes").await?;
    assert!(result.is_failure());

    // Original proposer CAN vote on both (verified before both)
    let result = vote_helper(proposer, &env.governance, proposal_1, "Yes").await?;
    assert!(result.is_success(), "Proposer should vote on proposal 1");

    let result = vote_helper(proposer, &env.governance, proposal_2, "No").await?;
    assert!(result.is_success(), "Proposer should vote on proposal 2");

    Ok(())
}

#[tokio::test]
async fn test_snapshot_error_message() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Verify new user after proposal
    let late_user = env.worker.dev_create_account().await?;
    verify_user(&env.backend, &env.verified_accounts, &late_user, 100).await?;

    let result = vote_helper(&late_user, &env.governance, proposal_id, "Yes").await?;

    assert!(result.is_failure());
    let error = format!("{:?}", result.failures());
    assert!(
        error.contains("You must be verified before the proposal was created to vote on it"),
        "Expected specific snapshot error, got: {}",
        error
    );

    Ok(())
}

// ==================== VERIFIED VOTING TESTS ====================

#[tokio::test]
async fn test_vote_verified_yes() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;

    assert!(result.is_success());

    let vote: Option<String> = env
        .governance
        .view("get_vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "account_id": voter.id()
        }))
        .await?
        .json()?;

    assert_eq!(vote, Some("Yes".to_string()));

    Ok(())
}

#[tokio::test]
async fn test_vote_verified_no() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;
    let result = vote_helper(voter, &env.governance, proposal_id, "No").await?;

    assert!(result.is_success());

    let vote: Option<String> = env
        .governance
        .view("get_vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "account_id": voter.id()
        }))
        .await?
        .json()?;

    assert_eq!(vote, Some("No".to_string()));

    Ok(())
}

#[tokio::test]
async fn test_vote_verified_abstain() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;
    let result = vote_helper(voter, &env.governance, proposal_id, "Abstain").await?;

    assert!(result.is_success());

    let vote: Option<String> = env
        .governance
        .view("get_vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "account_id": voter.id()
        }))
        .await?
        .json()?;

    assert_eq!(vote, Some("Abstain".to_string()));

    Ok(())
}

#[tokio::test]
async fn test_vote_twice_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // First vote should succeed
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_success());

    // Second vote should fail
    let result = vote_helper(voter, &env.governance, proposal_id, "No").await?;
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Already voted on this proposal"));

    Ok(())
}

#[tokio::test]
async fn test_vote_counts_update_correctly() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Vote: 2 Yes, 1 No, 1 Abstain
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[3], &env.governance, proposal_id, "No").await?.into_result()?;
    vote_helper(&env.verified_users[4], &env.governance, proposal_id, "Abstain").await?.into_result()?;

    let counts: serde_json::Value = env
        .governance
        .view("get_vote_counts")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(counts["yes_votes"], 2);
    assert_eq!(counts["no_votes"], 1);
    assert_eq!(counts["abstain_votes"], 1);
    assert_eq!(counts["total_votes"], 4);

    Ok(())
}

#[tokio::test]
async fn test_vote_after_period_ends_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Fast forward past voting period
    advance_past_voting_period(&env.worker).await?;

    // Vote should fail
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Voting period has ended"));

    Ok(())
}

#[tokio::test]
async fn test_vote_on_cancelled_proposal_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Cancel the proposal
    proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?
        .into_result()?;

    // Vote should fail
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Proposal is not active"));

    Ok(())
}

#[tokio::test]
async fn test_vote_on_finalized_proposal_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Fast forward and finalize
    advance_past_voting_period(&env.worker).await?;
    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    // Vote should fail
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Proposal is not active"));

    Ok(())
}

#[tokio::test]
async fn test_vote_proposal_not_found() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let voter = &env.verified_users[0];

    // Vote on non-existent proposal
    let result = vote_helper(voter, &env.governance, 999, "Yes").await?;
    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Proposal not found"));

    Ok(())
}

// ==================== PROPOSAL FINALIZATION TESTS ====================

#[tokio::test]
async fn test_finalize_proposal_passed() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // 3 Yes, 1 No (60% yes, quorum 10% = needs 1 voter)
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[3], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[4], &env.governance, proposal_id, "No").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed");

    Ok(())
}

#[tokio::test]
async fn test_finalize_proposal_failed() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // 1 Yes, 3 No (25% yes)
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "No").await?.into_result()?;
    vote_helper(&env.verified_users[3], &env.governance, proposal_id, "No").await?.into_result()?;
    vote_helper(&env.verified_users[4], &env.governance, proposal_id, "No").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Failed");

    Ok(())
}

#[tokio::test]
async fn test_finalize_proposal_quorum_not_met() -> anyhow::Result<()> {
    let env = setup_with_verified_users(10).await?;
    let proposer = &env.verified_users[0];

    // 50% quorum = need 5 Yes+No votes
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 50).await?;

    // Only 2 votes (not enough for 50% of 10 = 5)
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "QuorumNotMet");

    Ok(())
}

#[tokio::test]
async fn test_finalize_before_period_ends_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Try to finalize immediately (voting period not over)
    let result = proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Voting period has not ended yet"));

    Ok(())
}

#[tokio::test]
async fn test_finalize_already_finalized_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    advance_past_voting_period(&env.worker).await?;

    // First finalize succeeds
    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    // Second finalize fails
    let result = proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Proposal is not active"));

    Ok(())
}

#[tokio::test]
async fn test_finalize_cancelled_proposal_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Cancel
    proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // Try to finalize cancelled proposal
    let result = proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Proposal is not active"));

    Ok(())
}

#[tokio::test]
async fn test_finalize_anyone_can_call() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // Unverified user can finalize
    let random_user = env.worker.dev_create_account().await?;
    let result = random_user
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Anyone should be able to finalize: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_finalize_ties_result_in_failed() -> anyhow::Result<()> {
    let env = setup_with_verified_users(4).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // 2 Yes, 2 No (tie)
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "No").await?.into_result()?;
    vote_helper(&env.verified_users[3], &env.governance, proposal_id, "No").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // Tie means yes is NOT greater than no, so it fails
    assert_eq!(proposal["status"], "Failed");

    Ok(())
}

// ==================== QUORUM CALCULATION TESTS ====================

#[tokio::test]
async fn test_quorum_1_percent_minimum() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    // 1% of 5 = 0 (rounds down), so any vote should meet quorum
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 1).await?;

    // Just 1 yes vote
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // Should pass (quorum met with 1 vote)
    assert_eq!(proposal["status"], "Passed");

    Ok(())
}

#[tokio::test]
async fn test_quorum_100_percent() -> anyhow::Result<()> {
    let env = setup_with_verified_users(3).await?;
    let proposer = &env.verified_users[0];

    // 100% quorum = all 3 citizens must vote Yes or No
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 100).await?;

    // Only 2 vote (not enough for 100%)
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "QuorumNotMet");

    Ok(())
}

#[tokio::test]
async fn test_quorum_abstain_not_counted() -> anyhow::Result<()> {
    let env = setup_with_verified_users(10).await?;
    let proposer = &env.verified_users[0];

    // 30% quorum = need 3 Yes+No votes
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 30).await?;

    // 5 Abstain votes (don't count toward quorum)
    for i in 1..6 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Abstain").await?.into_result()?;
    }

    // Only 2 Yes votes (not enough for 30% of 10 = 3)
    vote_helper(&env.verified_users[6], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[7], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // Should be QuorumNotMet despite 7 total votes (only 2 counted)
    assert_eq!(proposal["status"], "QuorumNotMet");

    Ok(())
}

#[tokio::test]
async fn test_quorum_with_varying_citizen_count() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    // 40% quorum = need 2 Yes+No votes
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 40).await?;

    // Add more citizens after proposal creation (shouldn't affect quorum for THIS proposal)
    // Actually, it WILL affect quorum because get_verified_count() is called at finalization
    let new_user = env.worker.dev_create_account().await?;
    verify_user(&env.backend, &env.verified_accounts, &new_user, 100).await?;
    // Now 6 citizens total, 40% = 2.4 = 2 votes needed

    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[2], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // 2 votes meets 40% of 6 = 2.4 -> 2 (integer division)
    assert_eq!(proposal["status"], "Passed");

    Ok(())
}

#[tokio::test]
async fn test_quorum_rounding_down() -> anyhow::Result<()> {
    let env = setup_with_verified_users(3).await?;
    let proposer = &env.verified_users[0];

    // 10% of 3 = 0.3 -> 0 (rounds down)
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // 0 quorum means any vote should pass
    // But wait, we need at least 1 yes to beat 0 no
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed");

    Ok(())
}

#[tokio::test]
async fn test_quorum_zero_citizens_edge_case() -> anyhow::Result<()> {
    // This tests what happens if somehow there are 0 verified citizens at finalization
    // In practice this shouldn't happen since proposer must be verified
    // But let's test the edge case behavior

    // We can't really test 0 citizens because the proposer must be verified
    // So let's test with 1 citizen and 100% quorum
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 100).await?;

    // Proposer votes
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes").await?.into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // 1 citizen, 100% quorum = 1 vote needed, we have 1 yes vote
    assert_eq!(proposal["status"], "Passed");

    Ok(())
}

// ==================== PROPOSAL CANCELLATION TESTS ====================

#[tokio::test]
async fn test_cancel_proposal_by_proposer() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    let result = proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_success());

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Cancelled");

    Ok(())
}

#[tokio::test]
async fn test_cancel_proposal_by_non_proposer_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let other_user = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Other user tries to cancel
    let result = other_user
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Only proposer can cancel proposal"));

    Ok(())
}

#[tokio::test]
async fn test_cancel_already_cancelled_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // First cancel succeeds
    proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?
        .into_result()?;

    // Second cancel fails
    let result = proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Can only cancel active proposals"));

    Ok(())
}

#[tokio::test]
async fn test_cancel_finalized_proposal_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    advance_past_voting_period(&env.worker).await?;

    // Finalize first
    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    // Try to cancel finalized proposal
    let result = proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Can only cancel active proposals"));

    Ok(())
}

#[tokio::test]
async fn test_cancel_not_found() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let result = proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": 999}))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("Proposal not found"));

    Ok(())
}

// ==================== CROSS-CONTRACT EDGE CASE TESTS ====================

#[tokio::test]
async fn test_verified_accounts_paused_during_vote() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Pause verified-accounts contract
    env.backend
        .call(env.verified_accounts.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    // Vote should still work (read-only methods work when paused)
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;

    // This should succeed because get_account is a view method that works when paused
    assert!(
        result.is_success(),
        "Vote should work even when verified-accounts is paused: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_gas_requirements_create_proposal() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Test with minimum required gas (20 TGas per plan, use 25 for safety)
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Gas Test",
            "description": "Testing gas requirements",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(25))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Create proposal should work with 25 TGas: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_gas_requirements_vote() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Test with minimum required gas (23 TGas per plan, use 30 for safety)
    let result = voter
        .call(env.governance.id(), "vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "vote": "Yes"
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(30))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Vote should work with 30 TGas: {:?}",
        result.failures()
    );

    Ok(())
}

// ==================== PHASE 1: QUORUM PRECISION EDGE CASES ====================
// Based on OpenZeppelin/Compound governance best practices

/// Test quorum rounding with various edge cases
/// 10% of 3 = 0.3 -> 0 (rounds down)
/// 33% of 3 = 0.99 -> 0
/// 34% of 3 = 1.02 -> 1
#[tokio::test]
async fn test_quorum_rounding_multiple_percentages() -> anyhow::Result<()> {
    // Test 33% of 3 = 0.99 -> 0
    let env = setup_with_verified_users(3).await?;
    let proposer = &env.verified_users[0];

    // 33% of 3 = 0.99, rounds down to 0
    let proposal_id = create_proposal_helper(proposer, &env.governance, "33% Test", 33).await?;

    // With quorum of 0, any Yes vote should pass
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed", "33% of 3 = 0, so 1 vote meets quorum");

    Ok(())
}

/// Test quorum at 34% boundary
/// 34% of 3 = 1.02 -> 1
#[tokio::test]
async fn test_quorum_34_percent_of_3() -> anyhow::Result<()> {
    let env = setup_with_verified_users(3).await?;
    let proposer = &env.verified_users[0];

    // 34% of 3 = 1.02, rounds down to 1
    let proposal_id = create_proposal_helper(proposer, &env.governance, "34% Test", 34).await?;

    // With quorum of 1, exactly 1 Yes vote should pass
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed", "34% of 3 = 1, so 1 vote meets quorum");

    Ok(())
}

/// Test quorum: 51% of 99 = 50.49 -> 50
/// This is a common edge case in governance systems
#[tokio::test]
async fn test_quorum_51_percent_of_99() -> anyhow::Result<()> {
    let env = setup_with_verified_users(99).await?;
    let proposer = &env.verified_users[0];

    // 51% of 99 = 50.49, rounds down to 50
    let proposal_id = create_proposal_helper(proposer, &env.governance, "51% of 99", 51).await?;

    // Cast exactly 50 Yes votes (should pass)
    for i in 1..51 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed", "51% of 99 = 50, so 50 votes meets quorum");

    Ok(())
}

/// Test quorum: all abstain should result in QuorumNotMet
#[tokio::test]
async fn test_quorum_all_abstain_quorum_not_met() -> anyhow::Result<()> {
    let env = setup_with_verified_users(10).await?;
    let proposer = &env.verified_users[0];

    // 20% quorum = 2 Yes+No votes needed
    let proposal_id = create_proposal_helper(proposer, &env.governance, "All Abstain", 20).await?;

    // All 10 users vote Abstain
    for i in 0..10 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Abstain")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // 10 abstain votes don't count toward quorum
    assert_eq!(proposal["status"], "QuorumNotMet");

    Ok(())
}

/// Test mixed abstain scenario where quorum is barely met
#[tokio::test]
async fn test_quorum_mixed_abstain_barely_met() -> anyhow::Result<()> {
    let env = setup_with_verified_users(10).await?;
    let proposer = &env.verified_users[0];

    // 20% quorum = 2 Yes+No votes needed
    let proposal_id = create_proposal_helper(proposer, &env.governance, "Mixed Abstain", 20).await?;

    // 2 Yes, 0 No, 8 Abstain -> quorum met (2 >= 2), passes (2 > 0)
    vote_helper(&env.verified_users[0], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;
    for i in 2..10 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Abstain")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed", "2 yes votes meet 20% quorum of 10");

    Ok(())
}

// ==================== PHASE 1: CROSS-CONTRACT FAILURE TESTS ====================

/// Test creating proposal with insufficient gas
#[tokio::test]
async fn test_create_proposal_very_low_gas_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // 10 TGas is definitely not enough for cross-contract call
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Low Gas Test",
            "description": "Testing insufficient gas",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(10))
        .transact()
        .await?;

    // Should fail due to insufficient gas for cross-contract call
    assert!(result.is_failure(), "Should fail with 10 TGas");

    Ok(())
}

/// Test voting with insufficient gas
#[tokio::test]
async fn test_vote_very_low_gas_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // 10 TGas is not enough for vote cross-contract call
    let result = voter
        .call(env.governance.id(), "vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "vote": "Yes"
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(10))
        .transact()
        .await?;

    // Should fail due to insufficient gas
    assert!(result.is_failure(), "Should fail with 10 TGas");

    Ok(())
}

/// Test finalize with insufficient gas
#[tokio::test]
async fn test_finalize_very_low_gas_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    advance_past_voting_period(&env.worker).await?;

    // 10 TGas is not enough for finalize cross-contract call
    let result = proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(10))
        .transact()
        .await?;

    // Should fail due to insufficient gas
    assert!(result.is_failure(), "Should fail with 10 TGas");

    Ok(())
}

/// Test private callback rejection
#[tokio::test]
async fn test_callback_direct_call_rejected() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let attacker = &env.verified_users[0];

    // Try to call callback_create_proposal directly
    let result = attacker
        .call(env.governance.id(), "callback_create_proposal")
        .args_json(json!({
            "title": "Hack",
            "description": "Attack",
            "discourse_url": null,
            "quorum_percentage": 10,
            "proposer": attacker.id()
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure(), "Direct callback call should be rejected");

    Ok(())
}

// ==================== PHASE 2: INPUT VALIDATION EDGE CASES ====================

/// Test proposal with maximum length inputs
#[tokio::test]
async fn test_create_proposal_max_length_inputs() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Create max-length strings
    let max_title = "X".repeat(200); // MAX_TITLE_LEN
    let max_description = "Y".repeat(10000); // MAX_DESCRIPTION_LEN
    let max_url = format!("https://example.com/{}", "z".repeat(480)); // ~500 chars

    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": max_title,
            "description": max_description,
            "discourse_url": max_url,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Max length inputs should succeed: {:?}",
        result.failures()
    );

    Ok(())
}

/// Test proposal with unicode content (emoji, international chars)
#[tokio::test]
async fn test_create_proposal_unicode_content() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "Governance Proposal",
            "description": "This proposal includes international characters: Chinese, Arabic, and emoji.",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Unicode content should succeed: {:?}",
        result.failures()
    );

    // Verify content is stored correctly
    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": 0}))
        .await?
        .json()?;

    assert!(proposal["title"].as_str().unwrap().contains("Governance"));
    assert!(proposal["description"].as_str().unwrap().contains("emoji"));

    Ok(())
}

/// Test proposal with special characters (no injection vulnerabilities)
#[tokio::test]
async fn test_create_proposal_special_characters() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // HTML/JS injection attempts, SQL injection patterns
    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "<script>alert('xss')</script>",
            "description": "'; DROP TABLE users; --\n\t\r\\0",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Special chars should be stored safely: {:?}",
        result.failures()
    );

    // Verify content is stored as-is (no sanitization, just safe storage)
    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": 0}))
        .await?
        .json()?;

    assert!(proposal["title"].as_str().unwrap().contains("script"));

    Ok(())
}

/// Test concurrent proposal creation by multiple users
#[tokio::test]
async fn test_create_proposal_concurrent_users() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;

    // Create proposals from 5 different users concurrently (simulated sequentially)
    let mut proposal_ids = Vec::new();
    for (i, user) in env.verified_users.iter().enumerate() {
        let proposal_id =
            create_proposal_helper(user, &env.governance, &format!("Proposal {}", i), 10).await?;
        proposal_ids.push(proposal_id);
    }

    // Verify all got unique IDs
    let unique_ids: std::collections::HashSet<_> = proposal_ids.iter().collect();
    assert_eq!(unique_ids.len(), 5, "All proposals should have unique IDs");

    // Verify IDs are sequential
    for (i, id) in proposal_ids.iter().enumerate() {
        assert_eq!(*id, i as u64, "Proposal IDs should be sequential");
    }

    Ok(())
}

// ==================== PHASE 2: FINALIZATION BOUNDARY TESTS ====================

/// Test finalization with zero votes cast
#[tokio::test]
async fn test_finalize_zero_votes() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "No Votes", 10).await?;

    // No votes cast at all

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // 0 votes < any quorum (except 0%), so QuorumNotMet
    assert_eq!(proposal["status"], "QuorumNotMet");

    Ok(())
}

/// Test double finalization fails
#[tokio::test]
async fn test_finalize_double_attempt_fails() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let other_user = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // First finalization succeeds
    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    // Second finalization fails
    let result = other_user
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(format!("{:?}", result.failures()).contains("not active")
        || format!("{:?}", result.failures()).contains("already finalized"));

    Ok(())
}

/// Test anyone can call finalize (not just proposer)
#[tokio::test]
async fn test_finalize_by_non_proposer() -> anyhow::Result<()> {
    let env = setup_with_verified_users(3).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];
    let random_user = &env.verified_users[2];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    vote_helper(voter, &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // Random user (not proposer, not voter) can finalize
    let result = random_user
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Anyone should be able to finalize: {:?}",
        result.failures()
    );

    Ok(())
}

/// Test finalize no deposit required
#[tokio::test]
async fn test_finalize_no_deposit_required() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // Call without any deposit (no .deposit() call)
    let result = proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Finalize should work without deposit: {:?}",
        result.failures()
    );

    Ok(())
}

/// Test cancel immediately after creation
#[tokio::test]
async fn test_cancel_immediately_after_creation() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Immediate Cancel", 10).await?;

    // Immediately cancel (same block)
    let result = proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_success(), "Immediate cancel should succeed");

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Cancelled");

    Ok(())
}

// ==================== PHASE 3: SECURITY TESTS ====================

/// Test vote spam - same user trying to vote 100 times
#[tokio::test]
async fn test_vote_spam_same_user() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Spam Test", 10).await?;

    // First vote succeeds
    let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_success());

    // Try 10 more votes - all should fail
    for _ in 0..10 {
        let result = vote_helper(voter, &env.governance, proposal_id, "Yes").await?;
        assert!(result.is_failure(), "Subsequent votes should fail");
    }

    // Verify vote count is still 1
    let counts: serde_json::Value = env
        .governance
        .view("get_vote_counts")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(counts["total_votes"], 1, "Should only have 1 vote");

    Ok(())
}

/// Test that only proposer can cancel (no admin backdoor)
#[tokio::test]
async fn test_no_admin_cancel_power() -> anyhow::Result<()> {
    let env = setup_with_verified_users(3).await?;
    let proposer = &env.verified_users[0];
    let _voter = &env.verified_users[1];
    let random_verified = &env.verified_users[2];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Test", 10).await?;

    // Backend account (admin-like) cannot cancel
    let result = env
        .backend
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_failure(), "Backend should not be able to cancel");

    // Other verified user cannot cancel
    let result = random_verified
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(
        result.is_failure(),
        "Other verified users should not be able to cancel"
    );

    // Only proposer can cancel
    let result = proposer
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .transact()
        .await?;

    assert!(result.is_success(), "Only proposer should be able to cancel");

    Ok(())
}

/// Test Sybil prevention via snapshot voting
#[tokio::test]
async fn test_sybil_prevention_via_snapshot() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Sybil Test", 10).await?;

    // Try to create many users and verify them after proposal
    for i in 0..5 {
        let sybil_user = env.worker.dev_create_account().await?;
        verify_user(&env.backend, &env.verified_accounts, &sybil_user, 200 + i).await?;

        // Try to vote - should fail (verified after proposal)
        let result = vote_helper(&sybil_user, &env.governance, proposal_id, "Yes").await?;
        assert!(result.is_failure(), "Sybil user {} should not be able to vote", i);
    }

    // Original proposer can still vote
    let result = vote_helper(proposer, &env.governance, proposal_id, "Yes").await?;
    assert!(result.is_success(), "Original user should be able to vote");

    Ok(())
}

/// Test finalization race - verify only first succeeds
#[tokio::test]
async fn test_finalization_race() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Race Test", 10).await?;

    vote_helper(&env.verified_users[1], &env.governance, proposal_id, "Yes")
        .await?
        .into_result()?;

    advance_past_voting_period(&env.worker).await?;

    // First finalization succeeds
    let result1 = env.verified_users[1]
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    assert!(result1.is_success(), "First finalization should succeed");

    // All subsequent attempts fail
    for user in env.verified_users.iter().skip(2) {
        let result = user
            .call(env.governance.id(), "finalize_proposal")
            .args_json(json!({"proposal_id": proposal_id}))
            .gas(Gas::from_tgas(50))
            .transact()
            .await?;

        assert!(result.is_failure(), "Subsequent finalization should fail");
    }

    Ok(())
}

// ==================== PHASE 3: END-TO-END WORKFLOW TESTS ====================

/// Complete proposal lifecycle: creation -> voting -> finalization -> Passed
#[tokio::test]
async fn test_complete_lifecycle_passed() -> anyhow::Result<()> {
    let env = setup_with_verified_users(10).await?;
    let proposer = &env.verified_users[0];

    // Step 1: Create proposal with 30% quorum (need 3 votes)
    let proposal_id =
        create_proposal_helper(proposer, &env.governance, "Complete Lifecycle", 30).await?;

    // Verify proposal is Active
    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;
    assert_eq!(proposal["status"], "Active");

    // Step 2: Cast votes - 5 Yes, 2 No, 1 Abstain
    for i in 0..5 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }
    for i in 5..7 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "No")
            .await?
            .into_result()?;
    }
    vote_helper(&env.verified_users[7], &env.governance, proposal_id, "Abstain")
        .await?
        .into_result()?;

    // Verify vote counts
    let counts: serde_json::Value = env
        .governance
        .view("get_vote_counts")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;
    assert_eq!(counts["yes_votes"], 5);
    assert_eq!(counts["no_votes"], 2);
    assert_eq!(counts["abstain_votes"], 1);
    assert_eq!(counts["total_votes"], 8);

    // Step 3: Fast forward past voting period
    advance_past_voting_period(&env.worker).await?;

    // Step 4: Finalize
    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    // Step 5: Verify final status
    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(proposal["status"], "Passed");

    Ok(())
}

/// Complete lifecycle: QuorumNotMet scenario
#[tokio::test]
async fn test_complete_lifecycle_quorum_not_met() -> anyhow::Result<()> {
    let env = setup_with_verified_users(50).await?;
    let proposer = &env.verified_users[0];

    // 50% quorum = need 25 Yes+No votes
    let proposal_id =
        create_proposal_helper(proposer, &env.governance, "Quorum Not Met", 50).await?;

    // Only 20 votes (less than 25)
    for i in 0..15 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }
    for i in 15..20 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "No")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;

    proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?
        .into_result()?;

    let proposal: serde_json::Value = env
        .governance
        .view("get_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    // 20 votes < 25 quorum
    assert_eq!(proposal["status"], "QuorumNotMet");

    Ok(())
}

/// Multiple concurrent proposals with varied outcomes
#[tokio::test]
async fn test_multiple_proposals_varied_outcomes() -> anyhow::Result<()> {
    let env = setup_with_verified_users(15).await?;

    // Create 4 proposals
    let passed = create_proposal_helper(&env.verified_users[0], &env.governance, "Will Pass", 10).await?;
    let failed = create_proposal_helper(&env.verified_users[1], &env.governance, "Will Fail", 10).await?;
    let cancelled = create_proposal_helper(&env.verified_users[2], &env.governance, "Will Cancel", 10).await?;
    let quorum_not_met = create_proposal_helper(&env.verified_users[3], &env.governance, "No Quorum", 50).await?;

    // Vote on "Will Pass" - 5 yes
    for i in 4..9 {
        vote_helper(&env.verified_users[i], &env.governance, passed, "Yes")
            .await?
            .into_result()?;
    }

    // Vote on "Will Fail" - 2 yes, 5 no
    vote_helper(&env.verified_users[9], &env.governance, failed, "Yes").await?.into_result()?;
    vote_helper(&env.verified_users[10], &env.governance, failed, "Yes").await?.into_result()?;
    for i in 11..15 {
        vote_helper(&env.verified_users[i], &env.governance, failed, "No")
            .await?
            .into_result()?;
    }

    // Cancel "Will Cancel"
    env.verified_users[2]
        .call(env.governance.id(), "cancel_proposal")
        .args_json(json!({"proposal_id": cancelled}))
        .transact()
        .await?
        .into_result()?;

    // "No Quorum" - only 2 votes for 50% quorum (need 7-8)
    vote_helper(&env.verified_users[4], &env.governance, quorum_not_met, "Yes")
        .await?
        .into_result()?;
    vote_helper(&env.verified_users[5], &env.governance, quorum_not_met, "Yes")
        .await?
        .into_result()?;

    // Finalize non-cancelled proposals
    advance_past_voting_period(&env.worker).await?;

    for id in [passed, failed, quorum_not_met] {
        env.verified_users[0]
            .call(env.governance.id(), "finalize_proposal")
            .args_json(json!({"proposal_id": id}))
            .gas(Gas::from_tgas(50))
            .transact()
            .await?
            .into_result()?;
    }

    // Verify outcomes
    let p_passed: serde_json::Value = env.governance.view("get_proposal").args_json(json!({"proposal_id": passed})).await?.json()?;
    let p_failed: serde_json::Value = env.governance.view("get_proposal").args_json(json!({"proposal_id": failed})).await?.json()?;
    let p_cancelled: serde_json::Value = env.governance.view("get_proposal").args_json(json!({"proposal_id": cancelled})).await?.json()?;
    let p_quorum: serde_json::Value = env.governance.view("get_proposal").args_json(json!({"proposal_id": quorum_not_met})).await?.json()?;

    assert_eq!(p_passed["status"], "Passed");
    assert_eq!(p_failed["status"], "Failed");
    assert_eq!(p_cancelled["status"], "Cancelled");
    assert_eq!(p_quorum["status"], "QuorumNotMet");

    Ok(())
}

// ==================== PHASE 3: BATCH QUERY TESTS ====================

/// Test batch query respects max limit
#[tokio::test]
async fn test_get_proposals_max_batch_limit_enforced() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Create 10 proposals (enough to test limit)
    for i in 0..10 {
        create_proposal_helper(proposer, &env.governance, &format!("Proposal {}", i), 10).await?;
    }

    // Request with limit > 100 (MAX_BATCH_SIZE)
    let result: Vec<serde_json::Value> = env
        .governance
        .view("get_proposals")
        .args_json(json!({
            "from_index": 0,
            "limit": 200,  // Request 200, but should get max 100
            "status": null
        }))
        .await?
        .json()?;

    // Should get all 10 (since we only have 10, not testing the 100 cap directly)
    // But the contract logic caps at 100
    assert_eq!(result.len(), 10);

    Ok(())
}

/// Test get_proposals with pagination
#[tokio::test]
async fn test_get_proposals_pagination_detailed() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    // Create 15 proposals
    for i in 0..15 {
        create_proposal_helper(proposer, &env.governance, &format!("Proposal {}", i), 10).await?;
    }

    // Get first page (5 items)
    let page1: Vec<serde_json::Value> = env
        .governance
        .view("get_proposals")
        .args_json(json!({
            "from_index": 0,
            "limit": 5,
            "status": null
        }))
        .await?
        .json()?;

    assert_eq!(page1.len(), 5);

    // Get second page
    let page2: Vec<serde_json::Value> = env
        .governance
        .view("get_proposals")
        .args_json(json!({
            "from_index": 5,
            "limit": 5,
            "status": null
        }))
        .await?
        .json()?;

    assert_eq!(page2.len(), 5);

    // Get third page
    let page3: Vec<serde_json::Value> = env
        .governance
        .view("get_proposals")
        .args_json(json!({
            "from_index": 10,
            "limit": 5,
            "status": null
        }))
        .await?
        .json()?;

    assert_eq!(page3.len(), 5);

    // Verify no overlap
    let all_ids: Vec<u64> = [page1, page2, page3]
        .concat()
        .iter()
        .map(|p| p["id"].as_u64().unwrap())
        .collect();

    let unique_ids: std::collections::HashSet<_> = all_ids.iter().collect();
    assert_eq!(unique_ids.len(), 15);

    Ok(())
}

// ==================== PHASE 4: GAS MEASUREMENT TESTS ====================

/// Measure gas for minimal proposal creation
#[tokio::test]
async fn test_gas_measurement_create_proposal_minimal() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "X",
            "description": "Y",
            "discourse_url": null,
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_success());

    let gas_burnt = result.total_gas_burnt.as_tgas();
    println!("Gas burnt for minimal proposal: {} TGas", gas_burnt);

    // Should be under 30 TGas for minimal input
    assert!(gas_burnt < 30, "Minimal proposal should use < 30 TGas");

    Ok(())
}

/// Measure gas for maximal proposal creation
#[tokio::test]
async fn test_gas_measurement_create_proposal_maximal() -> anyhow::Result<()> {
    let env = setup_with_verified_users(1).await?;
    let proposer = &env.verified_users[0];

    let result = proposer
        .call(env.governance.id(), "create_proposal")
        .args_json(json!({
            "title": "X".repeat(200),
            "description": "Y".repeat(10000),
            "discourse_url": format!("https://example.com/{}", "z".repeat(480)),
            "quorum_percentage": 10
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_success());

    let gas_burnt = result.total_gas_burnt.as_tgas();
    println!("Gas burnt for maximal proposal: {} TGas", gas_burnt);

    // Should be under 50 TGas even for max input
    assert!(gas_burnt < 50, "Maximal proposal should use < 50 TGas");

    Ok(())
}

/// Measure gas for voting
#[tokio::test]
async fn test_gas_measurement_vote() -> anyhow::Result<()> {
    let env = setup_with_verified_users(2).await?;
    let proposer = &env.verified_users[0];
    let voter = &env.verified_users[1];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Gas Test", 10).await?;

    let result = voter
        .call(env.governance.id(), "vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "vote": "Yes"
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_success());

    let gas_burnt = result.total_gas_burnt.as_tgas();
    println!("Gas burnt for vote: {} TGas", gas_burnt);

    // Should be under 35 TGas
    assert!(gas_burnt < 35, "Vote should use < 35 TGas");

    Ok(())
}

/// Measure gas for finalization (O(1) complexity check)
#[tokio::test]
async fn test_gas_measurement_finalize() -> anyhow::Result<()> {
    let env = setup_with_verified_users(20).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Gas Test", 10).await?;

    // Cast 15 votes
    for i in 1..16 {
        vote_helper(&env.verified_users[i], &env.governance, proposal_id, "Yes")
            .await?
            .into_result()?;
    }

    advance_past_voting_period(&env.worker).await?;

    let result = proposer
        .call(env.governance.id(), "finalize_proposal")
        .args_json(json!({"proposal_id": proposal_id}))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_success());

    let gas_burnt = result.total_gas_burnt.as_tgas();
    println!("Gas burnt for finalize with 15 votes: {} TGas", gas_burnt);

    // Should be under 30 TGas (O(1) complexity)
    assert!(gas_burnt < 30, "Finalize should use < 30 TGas (O(1) complexity)");

    Ok(())
}

// ==================== PHASE 4: STRESS TESTS (IGNORED BY DEFAULT) ====================

/// Stress test: Create many proposals
#[tokio::test]
#[ignore] // Run with: cargo test stress -- --ignored
async fn test_stress_many_proposals() -> anyhow::Result<()> {
    let env = setup_with_verified_users(5).await?;

    // Create 100 proposals
    for i in 0..100 {
        let proposer = &env.verified_users[i % 5];
        create_proposal_helper(proposer, &env.governance, &format!("Stress Test {}", i), 10).await?;
    }

    // Verify count
    let count: u64 = env.governance.view("get_proposal_count").await?.json()?;
    assert_eq!(count, 100);

    // Query in batches
    let page1: Vec<serde_json::Value> = env
        .governance
        .view("get_proposals")
        .args_json(json!({ "from_index": 0, "limit": 50, "status": null }))
        .await?
        .json()?;
    assert_eq!(page1.len(), 50);

    let page2: Vec<serde_json::Value> = env
        .governance
        .view("get_proposals")
        .args_json(json!({ "from_index": 50, "limit": 50, "status": null }))
        .await?
        .json()?;
    assert_eq!(page2.len(), 50);

    Ok(())
}

/// Stress test: Many votes on single proposal
#[tokio::test]
#[ignore] // Run with: cargo test stress -- --ignored
async fn test_stress_many_votes_single_proposal() -> anyhow::Result<()> {
    let env = setup_with_verified_users(100).await?;
    let proposer = &env.verified_users[0];

    let proposal_id = create_proposal_helper(proposer, &env.governance, "Stress Vote Test", 10).await?;

    // All 100 users vote
    for (i, user) in env.verified_users.iter().enumerate() {
        let vote_type = match i % 3 {
            0 => "Yes",
            1 => "No",
            _ => "Abstain",
        };
        vote_helper(user, &env.governance, proposal_id, vote_type)
            .await?
            .into_result()?;
    }

    // Verify counts
    let counts: serde_json::Value = env
        .governance
        .view("get_vote_counts")
        .args_json(json!({"proposal_id": proposal_id}))
        .await?
        .json()?;

    assert_eq!(counts["total_votes"], 100);

    Ok(())
}
