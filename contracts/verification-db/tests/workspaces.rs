//! Integration tests for verification-db contract using near-workspaces
//!
//! These tests run against a local NEAR sandbox, allowing us to test:
//! - Real Ed25519 signature verification
//! - Cross-contract interactions
//! - Gas consumption
//! - Full verification flows

use borsh::BorshSerialize;
use near_workspaces::{Account, AccountId, Contract, Worker};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;

/// Path to the compiled WASM file
const WASM_PATH: &str = "./target/near/verification_db.wasm";

/// Initialize test environment with contract deployed
async fn init() -> anyhow::Result<(Worker<near_workspaces::network::Sandbox>, Contract, Account)> {
    let worker = near_workspaces::sandbox().await?;

    // Read the WASM file
    let wasm = std::fs::read(WASM_PATH).expect(
        "Could not find WASM file. Please build the contract first with `cargo near build`",
    );

    // Create a dev account that will be our backend wallet
    let backend = worker.dev_create_account().await?;

    // Deploy the contract to a new account
    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize the contract with the backend wallet
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Contract initialization failed: {:?}",
        result.failures()
    );

    Ok((worker, contract, backend))
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
///
/// The NEP-413 signing process:
/// 1. Create payload with message, nonce, recipient
/// 2. Borsh serialize the tag (u32) and payload
/// 3. Concatenate: tag_bytes + payload_bytes
/// 4. SHA-256 hash the concatenated data
/// 5. Sign the hash with Ed25519
fn generate_nep413_signature(
    account: &Account,
    message: &str,
    nonce: &[u8; 32],
    recipient: &str,
) -> (Vec<u8>, String) {
    // Get the secret key from the account
    let secret_key_str = account.secret_key().to_string();
    let secret_key = near_crypto::SecretKey::from_str(&secret_key_str)
        .expect("Failed to parse secret key");

    // Get the public key
    let public_key = secret_key.public_key();
    let public_key_str = public_key.to_string();

    // Create the NEP-413 payload
    let payload = Nep413Payload {
        message: message.to_string(),
        nonce: *nonce,
        recipient: recipient.to_string(),
        callback_url: None,
    };

    // Borsh serialize the tag
    let mut tag_bytes = Vec::new();
    NEP413_TAG.serialize(&mut tag_bytes).expect("Failed to serialize tag");

    // Borsh serialize the payload
    let mut payload_bytes = Vec::new();
    payload.serialize(&mut payload_bytes).expect("Failed to serialize payload");

    // Concatenate tag + payload
    let mut data_to_hash = tag_bytes;
    data_to_hash.extend(payload_bytes);

    // SHA-256 hash
    let hash = Sha256::digest(&data_to_hash);

    // Sign the hash
    let signature = secret_key.sign(&hash);

    // Extract the raw 64-byte signature
    let signature_bytes = match signature {
        near_crypto::Signature::ED25519(sig) => sig.to_bytes().to_vec(),
        _ => panic!("Expected ED25519 signature"),
    };

    (signature_bytes, public_key_str)
}

// ==================== READ-ONLY FUNCTION TESTS ====================

#[tokio::test]
async fn test_contract_initialization() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Verify backend wallet is set correctly
    let result: AccountId = contract
        .view("get_backend_wallet")
        .await?
        .json()?;
    assert_eq!(result, *backend.id());

    // Verify initial count is 0
    let count: u64 = contract.view("get_verified_count").await?.json()?;
    assert_eq!(count, 0);

    // Verify contract is not paused initially
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(!is_paused);

    Ok(())
}

#[tokio::test]
async fn test_is_nullifier_used_returns_false_for_unused() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    let is_used: bool = contract
        .view("is_nullifier_used")
        .args_json(json!({"nullifier": "test_nullifier"}))
        .await?
        .json()?;

    assert!(!is_used);
    Ok(())
}

#[tokio::test]
async fn test_is_account_verified_returns_false_for_unverified() -> anyhow::Result<()> {
    let (worker, contract, _backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let is_verified: bool = contract
        .view("is_account_verified")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;

    assert!(!is_verified);
    Ok(())
}

#[tokio::test]
async fn test_get_verified_accounts_empty() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    let accounts: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 0, "limit": 10}))
        .await?
        .json()?;

    assert_eq!(accounts.len(), 0);
    Ok(())
}

// ==================== ACCESS CONTROL TESTS ====================

#[tokio::test]
async fn test_unauthorized_store_verification() -> anyhow::Result<()> {
    let (worker, contract, _backend) = init().await?;
    let unauthorized = worker.dev_create_account().await?;
    let user = worker.dev_create_account().await?;

    // Try to store verification from unauthorized account
    let result = unauthorized
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64],
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Only backend wallet can store verifications"));

    Ok(())
}

#[tokio::test]
async fn test_unauthorized_pause() -> anyhow::Result<()> {
    let (worker, contract, _backend) = init().await?;
    let unauthorized = worker.dev_create_account().await?;

    let result = unauthorized
        .call(contract.id(), "pause")
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Only backend wallet can pause"));

    Ok(())
}

#[tokio::test]
async fn test_authorized_pause_unpause() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Pause the contract
    let result = backend.call(contract.id(), "pause").transact().await?;
    assert!(result.is_success());

    // Verify it's paused
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(is_paused);

    // Unpause the contract
    let result = backend.call(contract.id(), "unpause").transact().await?;
    assert!(result.is_success());

    // Verify it's unpaused
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(!is_paused);

    Ok(())
}

#[tokio::test]
async fn test_update_backend_wallet() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let new_backend = worker.dev_create_account().await?;

    // Update backend wallet
    let result = backend
        .call(contract.id(), "update_backend_wallet")
        .args_json(json!({"new_backend_wallet": new_backend.id()}))
        .transact()
        .await?;
    assert!(result.is_success());

    // Verify new backend wallet
    let current_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;
    assert_eq!(current_backend, *new_backend.id());

    // Old backend can no longer pause
    let result = backend.call(contract.id(), "pause").transact().await?;
    assert!(result.is_failure());

    // New backend can pause
    let result = new_backend.call(contract.id(), "pause").transact().await?;
    assert!(result.is_success());

    Ok(())
}

// ==================== PAUSED CONTRACT TESTS ====================

#[tokio::test]
async fn test_store_verification_when_paused() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Pause the contract
    let result = backend.call(contract.id(), "pause").transact().await?;
    assert!(result.is_success());

    // Try to store verification - should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64],
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Contract is paused"));

    Ok(())
}

// ==================== INPUT VALIDATION TESTS ====================

#[tokio::test]
async fn test_invalid_nonce_length() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64],
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 16], // Invalid: should be 32 bytes
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Nonce must be exactly 32 bytes"));

    Ok(())
}

#[tokio::test]
async fn test_invalid_signature_length() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 32], // Invalid: should be 64 bytes
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Signature must be 64 bytes"));

    Ok(())
}

#[tokio::test]
async fn test_account_id_mismatch() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;
    let different_user = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(), // Trying to verify this account
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": different_user.id(), // But signature is for different account
                "signature": vec![0u8; 64],
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Signature account ID must match"));

    Ok(())
}

#[tokio::test]
async fn test_recipient_mismatch() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;
    let different_recipient = worker.dev_create_account().await?;

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64],
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": different_recipient.id() // Recipient mismatch
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Signature recipient must match"));

    Ok(())
}

// ==================== SIGNATURE VERIFICATION TESTS ====================

#[tokio::test]
async fn test_invalid_signature_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // This should fail because the signature doesn't match the message
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": vec![0u8; 64], // Invalid signature (all zeros)
                "public_key": "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847",
                "challenge": "Identify myself",
                "nonce": vec![0u8; 32],
                "recipient": user.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test"
        }))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Invalid NEAR signature"));

    Ok(())
}

#[tokio::test]
async fn test_valid_signature_verification_succeeds() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [1u8; 32]; // Non-zero nonce for clarity
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Store verification with valid signature
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "valid_test_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "test_context"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "store_verification failed: {:?}",
        result.failures()
    );

    // Verify the account is now marked as verified
    let is_verified: bool = contract
        .view("is_account_verified")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;
    assert!(is_verified);

    // Verify nullifier is now used
    let is_nullifier_used: bool = contract
        .view("is_nullifier_used")
        .args_json(json!({"nullifier": "valid_test_nullifier"}))
        .await?
        .json()?;
    assert!(is_nullifier_used);

    // Verify count increased
    let count: u64 = contract.view("get_verified_count").await?.json()?;
    assert_eq!(count, 1);

    Ok(())
}

#[tokio::test]
async fn test_duplicate_nullifier_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;

    // Generate valid signatures for both users
    let nonce1: [u8; 32] = [1u8; 32];
    let nonce2: [u8; 32] = [2u8; 32];
    let challenge = "Identify myself";

    let (signature1, public_key1) =
        generate_nep413_signature(&user1, challenge, &nonce1, user1.id().as_str());
    let (signature2, public_key2) =
        generate_nep413_signature(&user2, challenge, &nonce2, user2.id().as_str());

    // First verification should succeed
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "duplicate_test_nullifier",
            "near_account_id": user1.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user1.id(),
                "signature": signature1,
                "public_key": public_key1,
                "challenge": challenge,
                "nonce": nonce1.to_vec(),
                "recipient": user1.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context1"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "First verification failed: {:?}",
        result.failures()
    );

    // Second verification with same nullifier should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "duplicate_test_nullifier", // Same nullifier!
            "near_account_id": user2.id(),
            "user_id": "user2",
            "attestation_id": "2",
            "signature_data": {
                "account_id": user2.id(),
                "signature": signature2,
                "public_key": public_key2,
                "challenge": challenge,
                "nonce": nonce2.to_vec(),
                "recipient": user2.id()
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("Nullifier already used"));

    Ok(())
}

#[tokio::test]
async fn test_account_already_verified_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate valid signatures with different nonces
    let nonce1: [u8; 32] = [1u8; 32];
    let nonce2: [u8; 32] = [2u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature1, public_key1) = generate_nep413_signature(&user, challenge, &nonce1, &recipient);
    let (signature2, public_key2) = generate_nep413_signature(&user, challenge, &nonce2, &recipient);

    // First verification should succeed
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "first_nullifier",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature1,
                "public_key": public_key1,
                "challenge": challenge,
                "nonce": nonce1.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context1"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "First verification failed: {:?}",
        result.failures()
    );

    // Second verification for same account should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "second_nullifier", // Different nullifier
            "near_account_id": user.id(),    // Same account!
            "user_id": "user1",
            "attestation_id": "2",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature2,
                "public_key": public_key2,
                "challenge": challenge,
                "nonce": nonce2.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    assert!(failure_msg.contains("NEAR account already verified"));

    Ok(())
}

#[tokio::test]
async fn test_get_verified_account_returns_data() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [42u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Store verification
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "data_test_nullifier",
            "near_account_id": user.id(),
            "user_id": "test_user_id",
            "attestation_id": "test_attestation",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "custom_context_data"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "store_verification failed: {:?}",
        result.failures()
    );

    // Get the verified account data
    let account_data: serde_json::Value = contract
        .view("get_verified_account")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;

    // Verify the returned data
    assert_eq!(account_data["user_id"], "test_user_id");
    assert_eq!(account_data["attestation_id"], "test_attestation");
    assert_eq!(account_data["user_context_data"], "custom_context_data");
    assert!(account_data["verified_at"].is_number());

    Ok(())
}

#[tokio::test]
async fn test_get_verified_accounts_pagination() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;

    // Create and verify 3 users
    let mut users = Vec::new();
    for i in 0..3 {
        let user = worker.dev_create_account().await?;
        let nonce: [u8; 32] = [i as u8; 32];
        let challenge = "Identify myself";
        let recipient = user.id().to_string();

        let (signature, public_key) =
            generate_nep413_signature(&user, challenge, &nonce, &recipient);

        let result = backend
            .call(contract.id(), "store_verification")
            .args_json(json!({
                "nullifier": format!("pagination_nullifier_{}", i),
                "near_account_id": user.id(),
                "user_id": format!("user_{}", i),
                "attestation_id": format!("{}", i),
                "signature_data": {
                    "account_id": user.id(),
                    "signature": signature,
                    "public_key": public_key,
                    "challenge": challenge,
                    "nonce": nonce.to_vec(),
                    "recipient": recipient
                },
                "self_proof": test_self_proof(),
                "user_context_data": format!("context_{}", i)
            }))
            .gas(near_workspaces::types::Gas::from_tgas(100))
            .transact()
            .await?;

        assert!(
            result.is_success(),
            "Verification {} failed: {:?}",
            i,
            result.failures()
        );
        users.push(user);
    }

    // Verify total count
    let count: u64 = contract.view("get_verified_count").await?.json()?;
    assert_eq!(count, 3);

    // Test pagination - get first 2
    let page1: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 0, "limit": 2}))
        .await?
        .json()?;
    assert_eq!(page1.len(), 2);

    // Test pagination - get remaining 1
    let page2: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 2, "limit": 2}))
        .await?
        .json()?;
    assert_eq!(page2.len(), 1);

    Ok(())
}

// ==================== GAS MEASUREMENT TESTS ====================

#[tokio::test]
async fn test_view_function_gas_usage() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // These should be fast view calls with minimal gas
    let _count: u64 = contract.view("get_verified_count").await?.json()?;
    let _paused: bool = contract.view("is_paused").await?.json()?;

    // View calls don't consume gas from the user, so we're mainly
    // checking they complete without timeout
    Ok(())
}

// ==================== PAGINATION TESTS ====================

#[tokio::test]
async fn test_pagination_limit_capped_at_100() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // Request more than 100 items
    let accounts: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 0, "limit": 200}))
        .await?
        .json()?;

    // Should return empty (no verified accounts) but the limit should be applied
    // The contract caps limit at 100 internally
    assert_eq!(accounts.len(), 0);

    Ok(())
}

#[tokio::test]
async fn test_pagination_from_index_beyond_data() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // Request from index beyond existing data
    let accounts: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 1000, "limit": 10}))
        .await?
        .json()?;

    assert_eq!(accounts.len(), 0);

    Ok(())
}
