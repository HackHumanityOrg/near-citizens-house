//! Stress tests for verified-accounts contract (integration)
//!
//! Exercises bulk writes and batch reads under load.
//! Configure via env vars: STRESS_TOTAL (default 1000), STRESS_BATCH_TOTAL (default 1000)

use crate::helpers::{generate_nep413_signature, init, nonce_to_base64};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract};
use serde_json::json;
use std::env;
use std::time::Instant;

const CHALLENGE_MESSAGE: &str = "Identify myself";
const DEFAULT_STRESS_TOTAL: usize = 1000;
const DEFAULT_BATCH_TOTAL: usize = 1000;
const MAX_BATCH_SIZE: usize = 100;

fn env_usize(var: &str, default: usize) -> usize {
    env::var(var)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn nonce_from_index(index: usize) -> [u8; 32] {
    let mut nonce = [0u8; 32];
    nonce[..8].copy_from_slice(&(index as u64).to_le_bytes());
    nonce
}

async fn store_verification(
    backend: &Account,
    contract: &Contract,
    user: &Account,
    nonce: [u8; 32],
) -> anyhow::Result<()> {
    let recipient = contract.id().to_string();
    let (signature, public_key) =
        generate_nep413_signature(user, CHALLENGE_MESSAGE, &nonce, &recipient);

    // Use base64 encoding for nonce and signature (matches contract's Base64VecU8)
    let nonce_base64 = nonce_to_base64(&nonce);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .gas(Gas::from_tgas(100))
        .args_json(json!({
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": CHALLENGE_MESSAGE,
                "nonce": nonce_base64,
                "recipient": recipient.clone()
            },
            "user_context_data": "stress-test"
        }))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "store_verification failed: {:?}",
        result.failures()
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Stress Tests")]
#[allure_severity("normal")]
#[allure_tags("integration", "stress", "pagination")]
#[allure_description(
    "Stress test: store many verifications and validate count and pagination behavior."
)]
#[allure_test]
#[tokio::test]
async fn test_stress_bulk_verifications_and_pagination() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let total = env_usize("STRESS_TOTAL", DEFAULT_STRESS_TOTAL);
    let start = Instant::now();
    let mut users = Vec::with_capacity(total);

    eprintln!("bulk: starting 0/{}", total);

    for i in 0..total {
        let user = worker.dev_create_account().await?;
        let nonce = nonce_from_index(i);
        store_verification(&backend, &contract, &user, nonce).await?;
        users.push(user);

        let done = i + 1;
        if done % 100 == 0 || done == total {
            eprintln!("bulk: {}/{} ({}s)", done, total, start.elapsed().as_secs());
        }
    }

    let count: u32 = contract.view("get_verified_count").await?.json()?;
    step("Verify total verified count matches", || {
        assert_eq!(count, total as u32);
    });

    let page_size = 50usize;
    let page1: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 0u32, "limit": page_size as u32}))
        .await?
        .json()?;

    step("Verify first page has expected size", || {
        assert_eq!(page1.len(), total.min(page_size));
    });

    let sample_verified: bool = contract
        .view("is_verified")
        .args_json(json!({"account_id": users.first().expect("users not empty").id()}))
        .await?
        .json()?;

    step("Verify sample account is marked verified", || {
        assert!(sample_verified);
    });

    eprintln!("bulk: done in {}s", start.elapsed().as_secs());

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Stress Tests")]
#[allure_severity("normal")]
#[allure_tags("integration", "stress", "batch")]
#[allure_description(
    "Stress test: store many verifications and validate batch read APIs at max size."
)]
#[allure_test]
#[tokio::test]
async fn test_stress_batch_reads_at_max_limit() -> anyhow::Result<()> {
    let (worker, contract, backend) = init().await?;
    let total = std::cmp::max(
        env_usize("STRESS_BATCH_TOTAL", DEFAULT_BATCH_TOTAL),
        MAX_BATCH_SIZE,
    );
    let start = Instant::now();
    let mut account_ids = Vec::with_capacity(total);

    eprintln!("batch: starting 0/{}", total);

    for i in 0..total {
        let user = worker.dev_create_account().await?;
        let nonce = nonce_from_index(i + 10_000);
        store_verification(&backend, &contract, &user, nonce).await?;
        account_ids.push(user.id().clone());

        let done = i + 1;
        if done % 100 == 0 || done == total {
            eprintln!("batch: {}/{} ({}s)", done, total, start.elapsed().as_secs());
        }
    }

    let count: u32 = contract.view("get_verified_count").await?.json()?;
    step("Verify total verified count matches", || {
        assert_eq!(count, total as u32);
    });

    let batch_ids = account_ids
        .get(..MAX_BATCH_SIZE)
        .expect("total >= MAX_BATCH_SIZE")
        .to_vec();

    let statuses: Vec<bool> = contract
        .view("are_verified")
        .args_json(json!({"account_ids": batch_ids.clone()}))
        .await?
        .json()?;

    step("Verify are_verified returns all true", || {
        assert_eq!(statuses.len(), MAX_BATCH_SIZE);
        assert!(statuses.iter().all(|v| *v));
    });

    let summaries: Vec<Option<serde_json::Value>> = contract
        .view("get_verifications")
        .args_json(json!({"account_ids": batch_ids}))
        .await?
        .json()?;

    step("Verify get_verifications returns all records", || {
        assert_eq!(summaries.len(), MAX_BATCH_SIZE);
        assert!(summaries.iter().all(|entry| entry.is_some()));
    });

    eprintln!("batch: done in {}s", start.elapsed().as_secs());

    Ok(())
}
