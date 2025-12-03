//! Shared test utilities and fixtures for governance contract tests
//!
//! This module provides reusable helpers for setting up test environments,
//! creating verified users, managing proposals, and parsing events.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic, dead_code)]

use borsh::BorshSerialize;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{network::Sandbox, Account, Contract, Worker};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;

// ==================== CONSTANTS ====================

/// WASM bytecode for governance contract
pub const GOVERNANCE_WASM: &[u8] = include_bytes!("../target/near/governance.wasm");

/// WASM bytecode for verified-accounts contract
pub const VERIFIED_ACCOUNTS_WASM: &[u8] =
    include_bytes!("../../verified-accounts/target/near/verified_accounts.wasm");

/// Blocks per day (NEAR produces ~1 block/second)
pub const BLOCKS_PER_DAY: u64 = 86400;

/// NEP-413 prefix tag: 2^31 + 413 = 2147484061
pub const NEP413_TAG: u32 = 2147484061;

/// Maximum title length
pub const MAX_TITLE_LEN: usize = 200;

/// Maximum description length
pub const MAX_DESCRIPTION_LEN: usize = 10_000;

/// Maximum discourse URL length
pub const MAX_DISCOURSE_URL_LEN: usize = 500;

/// Maximum batch size for queries
pub const MAX_BATCH_SIZE: usize = 100;

// ==================== DATA STRUCTURES ====================

/// NEP-413 payload structure for off-chain message signing
#[derive(BorshSerialize)]
pub struct Nep413Payload {
    pub message: String,
    pub nonce: [u8; 32],
    pub recipient: String,
    pub callback_url: Option<String>,
}

/// Vote choice enum (must match contract)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Vote {
    Yes,
    No,
    Abstain,
}

/// Proposal status enum (must match contract)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ProposalStatus {
    Active,
    Passed,
    Failed,
    QuorumNotMet,
    Cancelled,
}

/// Vote counts structure (must match contract)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct VoteCounts {
    pub yes_votes: u64,
    pub no_votes: u64,
    pub abstain_votes: u64,
    pub total_votes: u64,
}

/// Proposal structure (must match contract)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proposal {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub proposer: String,
    pub discourse_url: Option<String>,
    pub created_at: u64,
    pub voting_ends_at: u64,
    pub status: ProposalStatus,
    pub quorum_percentage: u8,
}

/// Test environment with both contracts and verified users
pub struct TestEnv {
    pub worker: Worker<Sandbox>,
    pub governance: Contract,
    pub verified_accounts: Contract,
    pub backend: Account,
    pub verified_users: Vec<Account>,
}

// ==================== EVENT STRUCTURES ====================

/// Event emitted when a proposal is created
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalCreatedEvent {
    pub proposal_id: u64,
    pub proposer: String,
    pub title: String,
}

/// Event emitted when a vote is cast
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteCastEvent {
    pub proposal_id: u64,
    pub voter: String,
    pub vote: String,
}

/// Event emitted when a proposal is finalized
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalCancelledEvent {
    pub proposal_id: u64,
    pub cancelled_by: String,
}

// ==================== NEP-413 SIGNATURE GENERATION ====================

/// Generate a valid NEP-413 signature using an account's secret key
pub fn generate_nep413_signature(
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
    BorshSerialize::serialize(&NEP413_TAG, &mut tag_bytes)
        .expect("Failed to serialize tag");

    let mut payload_bytes = Vec::new();
    BorshSerialize::serialize(&payload, &mut payload_bytes)
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
pub fn test_self_proof() -> serde_json::Value {
    json!({
        "proof": {
            "a": ["1", "2"],
            "b": [["3", "4"], ["5", "6"]],
            "c": ["7", "8"]
        },
        "public_signals": vec!["0"; 21]
    })
}

// ==================== TEST ENVIRONMENT SETUP ====================

/// Basic setup - deploys both contracts without verified users
pub async fn setup() -> anyhow::Result<(Worker<Sandbox>, Contract, Contract, Account)> {
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
pub async fn setup_with_verified_users(count: usize) -> anyhow::Result<TestEnv> {
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

/// Setup with a proposal already created
pub async fn setup_with_proposal(
    verified_user_count: usize,
    quorum_percentage: u8,
) -> anyhow::Result<(TestEnv, u64)> {
    let env = setup_with_verified_users(verified_user_count).await?;

    // Create a proposal with the first verified user
    let proposal_id = create_proposal_helper(
        &env.verified_users[0],
        &env.governance,
        "Test Proposal",
        quorum_percentage,
    )
    .await?;

    Ok((env, proposal_id))
}

/// Register a user as verified in the verified-accounts contract
pub async fn verify_user(
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

// ==================== PROPOSAL HELPERS ====================

/// Helper to create a proposal
pub async fn create_proposal_helper(
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

/// Helper to create a proposal with full options
pub async fn create_proposal_full(
    user: &Account,
    governance: &Contract,
    title: &str,
    description: &str,
    discourse_url: Option<&str>,
    quorum_percentage: u8,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(user
        .call(governance.id(), "create_proposal")
        .args_json(json!({
            "title": title,
            "description": description,
            "discourse_url": discourse_url,
            "quorum_percentage": quorum_percentage
        }))
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?)
}

/// Helper to get a proposal by ID
pub async fn get_proposal(governance: &Contract, proposal_id: u64) -> anyhow::Result<Option<Proposal>> {
    Ok(governance
        .view("get_proposal")
        .args_json(json!({ "proposal_id": proposal_id }))
        .await?
        .json()?)
}

/// Helper to get vote counts for a proposal
pub async fn get_vote_counts(governance: &Contract, proposal_id: u64) -> anyhow::Result<VoteCounts> {
    Ok(governance
        .view("get_vote_counts")
        .args_json(json!({ "proposal_id": proposal_id }))
        .await?
        .json()?)
}

// ==================== VOTING HELPERS ====================

/// Helper to cast a vote (returns the result for assertion)
pub async fn vote_helper(
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

/// Helper to check if a user has voted
pub async fn has_voted(
    governance: &Contract,
    proposal_id: u64,
    account_id: &str,
) -> anyhow::Result<bool> {
    Ok(governance
        .view("has_voted")
        .args_json(json!({
            "proposal_id": proposal_id,
            "account_id": account_id
        }))
        .await?
        .json()?)
}

/// Helper to get a user's vote
pub async fn get_vote(
    governance: &Contract,
    proposal_id: u64,
    account_id: &str,
) -> anyhow::Result<Option<Vote>> {
    Ok(governance
        .view("get_vote")
        .args_json(json!({
            "proposal_id": proposal_id,
            "account_id": account_id
        }))
        .await?
        .json()?)
}

// ==================== FINALIZATION HELPERS ====================

/// Helper to finalize a proposal
pub async fn finalize_proposal(
    user: &Account,
    governance: &Contract,
    proposal_id: u64,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(user
        .call(governance.id(), "finalize_proposal")
        .args_json(json!({ "proposal_id": proposal_id }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?)
}

/// Helper to cancel a proposal
pub async fn cancel_proposal(
    user: &Account,
    governance: &Contract,
    proposal_id: u64,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(user
        .call(governance.id(), "cancel_proposal")
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?)
}

// ==================== TIME MANIPULATION ====================

/// Advance time past the 7-day voting period
pub async fn advance_past_voting_period(worker: &Worker<Sandbox>) -> anyhow::Result<()> {
    worker.fast_forward(7 * BLOCKS_PER_DAY + 100).await?;
    Ok(())
}

/// Advance time by N days
pub async fn advance_days(worker: &Worker<Sandbox>, days: u64) -> anyhow::Result<()> {
    worker.fast_forward(days * BLOCKS_PER_DAY).await?;
    Ok(())
}

/// Advance time by N blocks
pub async fn advance_blocks(worker: &Worker<Sandbox>, blocks: u64) -> anyhow::Result<()> {
    worker.fast_forward(blocks).await?;
    Ok(())
}

// ==================== EVENT PARSING ====================

/// Parse events from transaction logs
pub fn parse_events<T: for<'de> Deserialize<'de>>(logs: &[String]) -> Vec<T> {
    logs.iter()
        .filter_map(|log| {
            if log.starts_with("EVENT_JSON:") {
                let json_str = &log["EVENT_JSON:".len()..];
                serde_json::from_str(json_str).ok()
            } else {
                None
            }
        })
        .collect()
}

/// Extract EVENT_JSON logs from execution result
pub fn extract_event_logs(result: &ExecutionFinalResult) -> Vec<String> {
    result
        .logs()
        .iter()
        .filter(|log| log.starts_with("EVENT_JSON:"))
        .map(|s| s.to_string())
        .collect()
}

/// Check if result contains expected error message
pub fn contains_error(result: &ExecutionFinalResult, expected: &str) -> bool {
    if result.is_success() {
        return false;
    }

    // Check in failure messages
    for failure in result.failures() {
        let failure_str = format!("{:?}", failure);
        if failure_str.contains(expected) {
            return true;
        }
    }

    false
}

/// Assert that a result failed with a specific error message
pub fn assert_failure_with(result: &ExecutionFinalResult, expected_error: &str) {
    assert!(
        result.is_failure(),
        "Expected failure but got success. Looking for: {}",
        expected_error
    );

    let found = contains_error(result, expected_error);
    assert!(
        found,
        "Expected error message '{}' not found. Failures: {:?}",
        expected_error,
        result.failures()
    );
}

// ==================== QUORUM CALCULATION ====================

/// Pure function to calculate quorum requirement (mirrors contract logic)
pub fn calculate_quorum(total_citizens: u64, quorum_percentage: u8) -> u64 {
    (total_citizens * quorum_percentage as u64) / 100
}

/// Pure function to determine proposal outcome (mirrors contract logic)
#[derive(Debug, Clone, PartialEq)]
pub enum ProposalOutcome {
    Passed,
    Failed,
    QuorumNotMet,
}

pub fn compute_outcome(
    yes_votes: u64,
    no_votes: u64,
    _abstain_votes: u64, // Abstain doesn't count toward quorum
    quorum_percentage: u8,
    total_citizens: u64,
) -> ProposalOutcome {
    let quorum_required = calculate_quorum(total_citizens, quorum_percentage);
    let quorum_votes = yes_votes + no_votes; // Abstain NOT included

    if quorum_votes < quorum_required {
        ProposalOutcome::QuorumNotMet
    } else if yes_votes > no_votes {
        ProposalOutcome::Passed
    } else {
        ProposalOutcome::Failed
    }
}

// ==================== STRING GENERATION ====================

/// Generate a string of exact length
pub fn string_of_length(len: usize) -> String {
    "x".repeat(len)
}

/// Generate a string just over the limit
pub fn string_over_limit(limit: usize) -> String {
    "x".repeat(limit + 1)
}
