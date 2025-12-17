//! Shared test utilities for verified-accounts integration tests
//!
//! Provides helpers for deploying contracts, creating test accounts,
//! generating NEP-413 signatures, and test data utilities.

#![allow(dead_code)] // Shared helpers - not all functions used by every test file

use borsh::BorshSerialize;
use near_workspaces::{Account, Contract, Worker};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;

/// Path to the compiled WASM file
pub const WASM_PATH: &str = "./target/near/verified_accounts.wasm";

/// NEP-413 prefix tag: 2^31 + 413 = 2147484061
pub const NEP413_TAG: u32 = 2147484061;

/// NEP-413 payload structure for off-chain message signing
/// See: https://github.com/near/NEPs/blob/master/neps/nep-0413.md
#[derive(BorshSerialize)]
pub struct Nep413Payload {
    pub message: String,
    pub nonce: [u8; 32],
    pub recipient: String,
    pub callback_url: Option<String>,
}

/// Initialize test environment with contract deployed
pub async fn init() -> anyhow::Result<(Worker<near_workspaces::network::Sandbox>, Contract, Account)> {
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

/// Generate a valid NEP-413 signature using an account's secret key
///
/// The NEP-413 signing process:
/// 1. Create payload with message, nonce, recipient
/// 2. Borsh serialize the tag (u32) and payload
/// 3. Concatenate: tag_bytes + payload_bytes
/// 4. SHA-256 hash the concatenated data
/// 5. Sign the hash with Ed25519
pub fn generate_nep413_signature(
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
