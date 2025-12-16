//! Integration tests for verified-accounts contract using near-workspaces
//!
//! Run with: cargo test --features integration-tests

#![cfg(feature = "integration-tests")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

use borsh::BorshSerialize;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, AccountId, Contract, Worker};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;

/// Path to the compiled WASM file
const WASM_PATH: &str = "./target/near/verified_accounts.wasm";

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
    let secret_key =
        near_crypto::SecretKey::from_str(&secret_key_str).expect("Failed to parse secret key");

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
    NEP413_TAG
        .serialize(&mut tag_bytes)
        .expect("Failed to serialize tag");

    // Borsh serialize the payload
    let mut payload_bytes = Vec::new();
    payload
        .serialize(&mut payload_bytes)
        .expect("Failed to serialize payload");

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
    let result: AccountId = contract.view("get_backend_wallet").await?.json()?;
    assert_eq!(result, *backend.id());

    // Verify initial count is 0
    let count: u64 = contract.view("get_verified_count").await?.json()?;
    assert_eq!(count, 0);

    // Verify contract is not paused initially
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(!is_paused);

    Ok(())
}

/// Test 1.1.4: Verify contract cannot be reinitialized
#[tokio::test]
async fn test_init_cannot_reinitialize() -> anyhow::Result<()> {
    let (_worker, contract, backend) = init().await?;

    // Try to reinitialize the contract - should fail
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .transact()
        .await?;

    assert!(
        result.is_failure(),
        "Reinitialization should fail. Got success instead."
    );

    // Verify error message indicates contract is already initialized
    let failure_msg = format!("{:?}", result.failures());
    assert!(
        failure_msg.contains("already initialized") || failure_msg.contains("The contract has already been initialized"),
        "Expected 'already initialized' error, got: {}",
        failure_msg
    );

    Ok(())
}

/// Test 1.1.5: Initialize with subaccount as backend wallet
#[tokio::test]
async fn test_init_with_subaccount_backend() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;

    // Create a parent account first
    let parent = worker.dev_create_account().await?;

    // Create a subaccount under the parent
    let subaccount = parent
        .create_subaccount("backend")
        .initial_balance(NearToken::from_near(10))
        .transact()
        .await?
        .into_result()?;

    // Deploy contract
    let wasm = std::fs::read(WASM_PATH).expect("Could not find WASM file");
    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize with subaccount as backend wallet
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": subaccount.id()
        }))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Init with subaccount should succeed. Failures: {:?}",
        result.failures()
    );

    // Verify backend wallet is set correctly
    let backend_wallet: AccountId = contract.view("get_backend_wallet").await?.json()?;
    assert_eq!(backend_wallet, *subaccount.id());

    Ok(())
}

/// Test 1.1.6: Initialize with implicit account (64 hex chars) as backend wallet
#[tokio::test]
async fn test_init_with_implicit_account_backend() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;

    // In NEAR, implicit accounts are 64 hex characters representing a public key
    // Dev accounts in sandbox are essentially implicit-like accounts
    let implicit_backend = worker.dev_create_account().await?;

    // Deploy contract
    let wasm = std::fs::read(WASM_PATH).expect("Could not find WASM file");
    let contract = worker.dev_deploy(&wasm).await?;

    // Initialize with the dev account (which has implicit-style ID in sandbox)
    let result = contract
        .call("new")
        .args_json(json!({
            "backend_wallet": implicit_backend.id()
        }))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Init with implicit-style account should succeed. Failures: {:?}",
        result.failures()
    );

    // Verify backend wallet is set correctly
    let backend_wallet: AccountId = contract.view("get_backend_wallet").await?.json()?;
    assert_eq!(backend_wallet, *implicit_backend.id());

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
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
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

    // Pause the contract (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "pause")
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(result.is_success(), "Pause failed: {:?}", result.failures());

    // Verify it's paused
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(is_paused);

    // Unpause the contract (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "unpause")
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(
        result.is_success(),
        "Unpause failed: {:?}",
        result.failures()
    );

    // Verify it's unpaused
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(!is_paused);

    Ok(())
}

#[tokio::test]
async fn test_update_backend_wallet() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let new_backend = worker.dev_create_account().await?;

    // Update backend wallet (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "update_backend_wallet")
        .args_json(json!({"new_backend_wallet": new_backend.id()}))
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(
        result.is_success(),
        "Update backend wallet failed: {:?}",
        result.failures()
    );

    // Verify new backend wallet
    let current_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;
    assert_eq!(current_backend, *new_backend.id());

    // Old backend can no longer pause (with 1 yocto deposit)
    let result = backend
        .call(contract.id(), "pause")
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(result.is_failure());

    // New backend can pause (with 1 yocto deposit)
    let result = new_backend
        .call(contract.id(), "pause")
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(
        result.is_success(),
        "New backend pause failed: {:?}",
        result.failures()
    );

    Ok(())
}

// ==================== PAUSED CONTRACT TESTS ====================

#[tokio::test]
async fn test_store_verification_when_paused() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Pause the contract (requires 1 yocto deposit)
    let result = backend
        .call(contract.id(), "pause")
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(result.is_success(), "Pause failed: {:?}", result.failures());

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

    let (signature1, public_key1) =
        generate_nep413_signature(&user, challenge, &nonce1, &recipient);
    let (signature2, public_key2) =
        generate_nep413_signature(&user, challenge, &nonce2, &recipient);

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
        .view("get_account_with_proof")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;

    // Verify the returned data
    assert_eq!(
        account_data.get("user_id"),
        Some(&serde_json::json!("test_user_id"))
    );
    assert_eq!(
        account_data.get("attestation_id"),
        Some(&serde_json::json!("1"))
    );
    assert_eq!(
        account_data.get("user_context_data"),
        Some(&serde_json::json!("custom_context_data"))
    );
    assert!(account_data
        .get("verified_at")
        .is_some_and(|v| v.is_number()));

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
    let (worker, contract, backend) = init().await?;

    // Create 105 verified accounts to test the 100-item cap
    for i in 0..105 {
        let user = worker.dev_create_account().await?;
        let nonce: [u8; 32] = [i as u8; 32];
        let challenge = "Identify myself";
        let recipient = user.id().to_string();

        let (signature, public_key) =
            generate_nep413_signature(&user, challenge, &nonce, &recipient);

        backend
            .call(contract.id(), "store_verification")
            .args_json(json!({
                "nullifier": format!("pagination_cap_nullifier_{}", i),
                "near_account_id": user.id(),
                "user_id": format!("user_{}", i),
                "attestation_id": format!("{}", i % 10),
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
            .await?
            .into_result()?;
    }

    // Verify we have 105 accounts
    let count: u64 = contract.view("get_verified_count").await?.json()?;
    assert_eq!(count, 105, "Should have 105 verified accounts");

    // Request more than 100 items - should be capped at 100
    let accounts: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 0, "limit": 200}))
        .await?
        .json()?;

    // The contract should cap limit at 100 internally
    assert_eq!(
        accounts.len(),
        100,
        "Pagination should cap at 100 items even when requesting 200"
    );

    // Verify we can get the remaining 5 accounts
    let remaining: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 100, "limit": 10}))
        .await?
        .json()?;

    assert_eq!(remaining.len(), 5, "Should get remaining 5 accounts");

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

// ==================== SIGNATURE REPLAY ATTACK PREVENTION TESTS ====================

#[tokio::test]
async fn test_signature_replay_rejected() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // Generate a valid NEP-413 signature
    let nonce: [u8; 32] = [42u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // First verification should succeed
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "replay_test_nullifier_1",
            "near_account_id": user.id(),
            "user_id": "user1",
            "attestation_id": "1",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature.clone(),
                "public_key": public_key.clone(),
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient.clone()
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

    // Now try to replay the EXACT SAME signature with a DIFFERENT nullifier
    // In a scenario where the account check might be bypassed, the signature tracking
    // provides a second layer of defense. In practice, the account check ("NEAR account
    // already verified") will catch this first, but signature tracking adds defense-in-depth.
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "replay_test_nullifier_2", // Different nullifier - trying to bypass nullifier check
            "near_account_id": user.id(),           // Same account
            "user_id": "user1",
            "attestation_id": "2",
            "signature_data": {
                "account_id": user.id(),            // Same account
                "signature": signature.clone(),     // SAME signature!
                "public_key": public_key.clone(),   // Same public key
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "context2"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    // This should fail - the signature tracking or account check will catch it
    assert!(result.is_failure());
    let failure_msg = format!("{:?}", result.failures());
    // Multiple layers of defense - any of these would block the replay:
    // - "Signature already used" (signature tracking - our new defense)
    // - "NEAR account already verified" (existing account check)
    assert!(
        failure_msg.contains("Signature already used")
            || failure_msg.contains("NEAR account already verified"),
        "Expected replay to be rejected by defense-in-depth, got: {}",
        failure_msg
    );

    Ok(())
}

#[tokio::test]
async fn test_batch_size_limit_enforced() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // Create more than 100 account IDs
    let too_many_accounts: Vec<String> =
        (0..101).map(|i| format!("account{}.testnet", i)).collect();

    // Call are_accounts_verified with too many accounts - should fail
    let result = contract
        .view("are_accounts_verified")
        .args_json(json!({"account_ids": too_many_accounts}))
        .await;

    // View call should fail due to assertion
    assert!(result.is_err(), "Expected batch size limit to be enforced");

    Ok(())
}

// ==================== EDGE CASE TESTS ====================

#[tokio::test]
async fn test_max_length_user_context_data() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let nonce: [u8; 32] = [99u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Create user_context_data at exactly the max limit (4096 bytes)
    let max_context = "x".repeat(4096);

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "max_context_nullifier",
            "near_account_id": user.id(),
            "user_id": "max_context_user",
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
            "user_context_data": max_context
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Should accept user_context_data at exactly 4096 bytes. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_unicode_in_user_context_data() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let nonce: [u8; 32] = [100u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    // Create user_context_data with unicode characters
    let unicode_context = "Hello 世界! Привет мир! 🌍🚀✨ Ελληνικά العربية";

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "unicode_context_nullifier",
            "near_account_id": user.id(),
            "user_id": "unicode_context_user",
            "attestation_id": "2",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": unicode_context
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Should accept unicode in user_context_data. Failures: {:?}",
        result.failures()
    );

    // Verify the unicode data was stored correctly
    let account: serde_json::Value = contract
        .view("get_account_with_proof")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;

    assert!(
        account.get("user_context_data").is_some(),
        "Should have user_context_data"
    );

    Ok(())
}

#[tokio::test]
async fn test_nonce_all_zeros() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // All-zeros nonce (edge case - weak randomness, but should still be accepted)
    let nonce: [u8; 32] = [0u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "zero_nonce_nullifier",
            "near_account_id": user.id(),
            "user_id": "zero_nonce_user",
            "attestation_id": "3",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "zero_nonce_context"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    // All-zeros nonce is valid (though weak) - the contract should accept it
    // Security note: In practice, nonces should be cryptographically random
    assert!(
        result.is_success(),
        "Should accept all-zeros nonce (weak but valid). Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_nonce_all_max_bytes() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // All-0xFF nonce (max byte values)
    let nonce: [u8; 32] = [0xFFu8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "max_nonce_nullifier",
            "near_account_id": user.id(),
            "user_id": "max_nonce_user",
            "attestation_id": "4",
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce.to_vec(),
                "recipient": recipient
            },
            "self_proof": test_self_proof(),
            "user_context_data": "max_nonce_context"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "Should accept all-0xFF nonce. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

// ==================== UNIQUENESS CONSTRAINT TESTS ====================

/// Test 2.6.4: Allow same user_id for different accounts (not a unique constraint)
#[tokio::test]
async fn test_allow_same_user_id_different_accounts() -> anyhow::Result<()> {
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

    // First verification with user_id "same_user"
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "unique_nullifier_1",
            "near_account_id": user1.id(),
            "user_id": "same_user",  // Same user_id
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

    // Second verification with same user_id but different account
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "unique_nullifier_2",  // Different nullifier
            "near_account_id": user2.id(),       // Different account
            "user_id": "same_user",              // Same user_id!
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

    // Should succeed - user_id is not a unique constraint
    assert!(
        result.is_success(),
        "Same user_id for different accounts should be allowed. Failures: {:?}",
        result.failures()
    );

    // Verify both accounts are verified
    let verified1: bool = contract
        .view("is_account_verified")
        .args_json(json!({"near_account_id": user1.id()}))
        .await?
        .json()?;
    let verified2: bool = contract
        .view("is_account_verified")
        .args_json(json!({"near_account_id": user2.id()}))
        .await?
        .json()?;
    assert!(verified1 && verified2);

    Ok(())
}

/// Test 2.6.5: Allow same attestation_id for different accounts (not a unique constraint)
#[tokio::test]
async fn test_allow_same_attestation_id_different_accounts() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;

    // Generate valid signatures for both users
    let nonce1: [u8; 32] = [3u8; 32];
    let nonce2: [u8; 32] = [4u8; 32];
    let challenge = "Identify myself";

    let (signature1, public_key1) =
        generate_nep413_signature(&user1, challenge, &nonce1, user1.id().as_str());
    let (signature2, public_key2) =
        generate_nep413_signature(&user2, challenge, &nonce2, user2.id().as_str());

    // First verification with attestation_id "1"
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "attestation_test_nullifier_1",
            "near_account_id": user1.id(),
            "user_id": "user_1",
            "attestation_id": "1",  // Same attestation_id
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

    // Second verification with same attestation_id but different account
    let result = backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "attestation_test_nullifier_2",  // Different nullifier
            "near_account_id": user2.id(),                 // Different account
            "user_id": "user_2",
            "attestation_id": "1",                         // Same attestation_id!
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

    // Should succeed - attestation_id is not a unique constraint
    assert!(
        result.is_success(),
        "Same attestation_id for different accounts should be allowed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

/// Test 2.7.2: Pause allows read operations (is_account_verified still works when paused)
#[tokio::test]
async fn test_pause_allows_read_operations() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let user = worker.dev_create_account().await?;

    // First verify a user
    let nonce: [u8; 32] = [5u8; 32];
    let challenge = "Identify myself";
    let recipient = user.id().to_string();

    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    backend
        .call(contract.id(), "store_verification")
        .args_json(json!({
            "nullifier": "pause_read_test_nullifier",
            "near_account_id": user.id(),
            "user_id": "pause_read_user",
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
            "user_context_data": "context"
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?
        .into_result()?;

    // Pause the contract
    backend
        .call(contract.id(), "pause")
        .deposit(near_workspaces::types::NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    // Verify contract is paused
    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(is_paused, "Contract should be paused");

    // Read operations should still work while paused
    let is_verified: bool = contract
        .view("is_account_verified")
        .args_json(json!({"near_account_id": user.id()}))
        .await?
        .json()?;
    assert!(is_verified, "Should return true for verified account even when paused");

    let count: u64 = contract.view("get_verified_count").await?.json()?;
    assert_eq!(count, 1, "Count should be accessible when paused");

    let accounts: Vec<serde_json::Value> = contract
        .view("get_verified_accounts")
        .args_json(json!({"from_index": 0, "limit": 10}))
        .await?
        .json()?;
    assert_eq!(accounts.len(), 1, "get_verified_accounts should work when paused");

    Ok(())
}
