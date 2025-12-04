//! Shared test utilities for sputnik-bridge integration tests
//!
//! Provides helpers for deploying contracts, creating verified users,
//! generating NEP-413 signatures, and manipulating test time.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use borsh::BorshSerialize;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{network::Sandbox, Account, Contract, Worker};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::str::FromStr;

// ==================== WASM BYTECODE ====================

/// Bridge contract WASM
pub const BRIDGE_WASM: &[u8] = include_bytes!("../target/near/sputnik_bridge.wasm");

/// Verified accounts contract WASM
pub const VERIFIED_ACCOUNTS_WASM: &[u8] =
    include_bytes!("../../verified-accounts/target/near/verified_accounts.wasm");

/// SputnikDAO v2 contract WASM
pub const SPUTNIKDAO_WASM: &[u8] =
    include_bytes!("../../sputnik-dao-contract/sputnikdao2/res/sputnikdao2.wasm");

// ==================== CONSTANTS ====================

/// NEP-413 prefix tag: 2^31 + 413 = 2147484061
pub const NEP413_TAG: u32 = 2147484061;

/// Proposal period in nanoseconds (10 seconds for fast testing)
pub const PROPOSAL_PERIOD_NS: u64 = 10_000_000_000;

/// Proposal bond (1 NEAR - must match attached deposit)
pub const PROPOSAL_BOND: u128 = 1_000_000_000_000_000_000_000_000;

// ==================== DATA STRUCTURES ====================

/// NEP-413 payload structure for off-chain message signing
#[derive(BorshSerialize)]
pub struct Nep413Payload {
    pub message: String,
    pub nonce: [u8; 32],
    pub recipient: String,
    pub callback_url: Option<String>,
}

/// Bridge info structure (must match contract)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeInfo {
    pub backend_wallet: String,
    pub sputnik_dao: String,
    pub verified_accounts_contract: String,
    pub citizen_role: String,
}

/// DAO Config structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaoConfig {
    pub name: String,
    pub purpose: String,
    pub metadata: String,
}

/// Vote policy for DAO
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotePolicy {
    pub weight_kind: String,
    pub quorum: String,
    pub threshold: (u64, u64),
}

/// Role permission for DAO policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RolePermission {
    pub name: String,
    pub kind: serde_json::Value,
    pub permissions: HashSet<String>,
    pub vote_policy: serde_json::Value,
}

/// DAO Policy structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Policy {
    pub roles: Vec<RolePermission>,
    pub default_vote_policy: VotePolicy,
    pub proposal_bond: String,
    pub proposal_period: String,
    pub bounty_bond: String,
    pub bounty_forgiveness_period: String,
}

/// Proposal status enum (matches sputnik-dao)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalOutput {
    pub id: u64,
    pub proposer: String,
    pub description: String,
    pub kind: serde_json::Value,
    pub status: ProposalStatus,
    pub vote_counts: serde_json::Value,
    pub votes: serde_json::Value,
    pub submission_time: String,
}

/// Test environment with all contracts deployed
pub struct TestEnv {
    pub worker: Worker<Sandbox>,
    pub sputnik_dao: Contract,
    pub verified_accounts: Contract,
    pub bridge: Contract,
    pub backend: Account,
    pub users: Vec<Account>,
}

impl TestEnv {
    /// Safely get a user by index, panics with helpful message if out of bounds
    pub fn user(&self, index: usize) -> &Account {
        self.users.get(index).unwrap_or_else(|| {
            panic!(
                "User index {} out of bounds. Only {} users available.",
                index,
                self.users.len()
            )
        })
    }
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
    BorshSerialize::serialize(&NEP413_TAG, &mut tag_bytes).expect("Failed to serialize tag");

    let mut payload_bytes = Vec::new();
    BorshSerialize::serialize(&payload, &mut payload_bytes).expect("Failed to serialize payload");

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

/// Create test Self.xyz proof data (mock Groth16 proof)
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

// ==================== POLICY CREATION ====================

/// Create a test DAO policy with short proposal period
///
/// The policy matches production dao-policy.json structure:
/// - "bridge" role - contains bridge contract, can add add_member_to_role and vote proposals
/// - "citizen" role - empty initially, can vote on all proposal types
/// - "all" role (Everyone) - can only finalize proposals
///
/// NOTE: sputnik-dao uses lowercase snake_case for proposal kind labels internally:
/// - add_member_to_role (not AddMemberToRole)
/// - vote (not Vote)
pub fn create_test_policy(bridge_account_id: &str) -> serde_json::Value {
    json!({
        "roles": [
            {
                "name": "bridge",
                "kind": {
                    "Group": [bridge_account_id]
                },
                "permissions": [
                    "add_member_to_role:AddProposal",
                    "add_member_to_role:VoteApprove",
                    "vote:AddProposal"
                ],
                "vote_policy": {}
            },
            {
                "name": "citizen",
                "kind": {
                    "Group": []
                },
                "permissions": [
                    "*:VoteApprove",
                    "*:VoteReject"
                ],
                "vote_policy": {}
            },
            {
                "name": "all",
                "kind": "Everyone",
                "permissions": ["*:Finalize"],
                "vote_policy": {}
            }
        ],
        "default_vote_policy": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [1, 2]
        },
        "proposal_bond": PROPOSAL_BOND.to_string(),
        "proposal_period": PROPOSAL_PERIOD_NS.to_string(),
        "bounty_bond": PROPOSAL_BOND.to_string(),
        "bounty_forgiveness_period": PROPOSAL_PERIOD_NS.to_string()
    })
}

// ==================== TEST ENVIRONMENT SETUP ====================

/// Full setup - deploys sputnik-dao, verified-accounts, and bridge contracts
pub async fn setup() -> anyhow::Result<TestEnv> {
    let worker = near_workspaces::sandbox().await?;

    // Create backend account
    let backend = worker.dev_create_account().await?;

    // Deploy verified-accounts contract
    let verified_accounts = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;
    verified_accounts
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .transact()
        .await?
        .into_result()?;

    // Deploy bridge contract first (we need its ID for DAO policy)
    let bridge = worker.dev_deploy(BRIDGE_WASM).await?;

    // Deploy sputnik-dao with policy including bridge in council
    let sputnik_dao = worker.dev_deploy(SPUTNIKDAO_WASM).await?;
    let policy = create_test_policy(bridge.id().as_str());

    sputnik_dao
        .call("new")
        .args_json(json!({
            "config": {
                "name": "test-dao",
                "purpose": "Integration testing",
                "metadata": ""
            },
            "policy": policy
        }))
        .transact()
        .await?
        .into_result()?;

    // Initialize bridge contract
    bridge
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id(),
            "sputnik_dao": sputnik_dao.id(),
            "verified_accounts_contract": verified_accounts.id(),
            "citizen_role": "citizen"
        }))
        .transact()
        .await?
        .into_result()?;

    Ok(TestEnv {
        worker,
        sputnik_dao,
        verified_accounts,
        bridge,
        backend,
        users: Vec::new(),
    })
}

/// Setup with N user accounts created (not verified yet)
pub async fn setup_with_users(count: usize) -> anyhow::Result<TestEnv> {
    let mut env = setup().await?;

    for _ in 0..count {
        let user = env.worker.dev_create_account().await?;
        env.users.push(user);
    }

    Ok(env)
}

// ==================== VERIFICATION HELPERS ====================

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

/// Check if a user is verified
pub async fn is_user_verified(
    verified_accounts: &Contract,
    user: &Account,
) -> anyhow::Result<bool> {
    Ok(verified_accounts
        .view("is_account_verified")
        .args_json(json!({ "near_account_id": user.id() }))
        .await?
        .json()?)
}

// ==================== BRIDGE HELPERS ====================

/// Add a verified member to the DAO via the bridge
pub async fn add_member_via_bridge(
    backend: &Account,
    bridge: &Contract,
    user: &Account,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(backend
        .call(bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user.id() }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(200))
        .transact()
        .await?)
}

/// Create a Vote proposal via the bridge
pub async fn create_proposal_via_bridge(
    backend: &Account,
    bridge: &Contract,
    description: &str,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(backend
        .call(bridge.id(), "create_proposal")
        .args_json(json!({ "description": description }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?)
}

// ==================== DAO HELPERS ====================

/// Get the last proposal ID from the DAO
pub async fn get_last_proposal_id(dao: &Contract) -> anyhow::Result<u64> {
    Ok(dao.view("get_last_proposal_id").await?.json()?)
}

/// Get a proposal by ID
pub async fn get_proposal(dao: &Contract, proposal_id: u64) -> anyhow::Result<ProposalOutput> {
    Ok(dao
        .view("get_proposal")
        .args_json(json!({ "id": proposal_id }))
        .await?
        .json()?)
}

/// Get the DAO policy
pub async fn get_dao_policy(dao: &Contract) -> anyhow::Result<serde_json::Value> {
    Ok(dao.view("get_policy").await?.json()?)
}

/// Vote on a proposal in the DAO
pub async fn vote_on_proposal(
    voter: &Account,
    dao: &Contract,
    proposal_id: u64,
    action: &str,
    proposal_kind: serde_json::Value,
) -> anyhow::Result<ExecutionFinalResult> {
    Ok(voter
        .call(dao.id(), "act_proposal")
        .args_json(json!({
            "id": proposal_id,
            "action": action,
            "proposal": proposal_kind,
            "memo": null
        }))
        .gas(Gas::from_tgas(50))
        .transact()
        .await?)
}

/// Check if account is in a specific role
pub async fn is_account_in_role(
    dao: &Contract,
    account_id: &str,
    role_name: &str,
) -> anyhow::Result<bool> {
    let policy: serde_json::Value = get_dao_policy(dao).await?;

    if let Some(roles) = policy.get("roles").and_then(|r| r.as_array()) {
        for role in roles {
            if role.get("name").and_then(|n| n.as_str()) == Some(role_name) {
                if let Some(kind) = role.get("kind") {
                    if let Some(group) = kind.get("Group").and_then(|g| g.as_array()) {
                        return Ok(group.iter().any(|m| m.as_str() == Some(account_id)));
                    }
                }
            }
        }
    }

    Ok(false)
}

// ==================== EVENT PARSING ====================

/// Event wrapper structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventWrapper {
    pub standard: String,
    pub version: String,
    pub event: String,
    pub data: serde_json::Value,
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

/// Parse events from transaction logs
pub fn parse_events(logs: &[String]) -> Vec<EventWrapper> {
    logs.iter()
        .filter_map(|log| {
            if let Some(json_str) = log.strip_prefix("EVENT_JSON:") {
                serde_json::from_str(json_str).ok()
            } else {
                None
            }
        })
        .collect()
}

/// Check if result contains expected error message
pub fn contains_error(result: &ExecutionFinalResult, expected: &str) -> bool {
    if result.is_success() {
        return false;
    }

    for failure in result.failures() {
        let failure_str = format!("{:?}", failure);
        if failure_str.contains(expected) {
            return true;
        }
    }

    false
}

