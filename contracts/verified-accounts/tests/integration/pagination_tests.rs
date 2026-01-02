//! Pagination tests for verified-accounts contract

use crate::helpers::{generate_nep413_signature, init, test_self_proof};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Pagination")]
#[allure_severity("normal")]
#[allure_tags("integration", "pagination", "limits")]
#[allure_description("Verifies that pagination is capped at 100 items even when requesting more.")]
#[allure_test]
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
            .deposit(NearToken::from_yoctonear(1))
            .args_json(json!({
                "nullifier": format!("pagination_cap_nullifier_{}", i),
                "near_account_id": user.id(),
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
            .gas(Gas::from_tgas(100))
            .transact()
            .await?
            .into_result()?;
    }

    // Verify we have 105 accounts
    let count: u64 = contract.view("get_verified_count").await?.json()?;

    step("Verify we have 105 verified accounts", || {
        assert_eq!(count, 105, "Should have 105 verified accounts");
    });

    // Request more than 100 items - should be capped at 100
    let verifications: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 0, "limit": 200}))
        .await?
        .json()?;

    step("Verify pagination is capped at 100 items", || {
        // The contract should cap limit at 100 internally
        assert_eq!(
            verifications.len(),
            100,
            "Pagination should cap at 100 items even when requesting 200"
        );
    });

    // Verify we can get the remaining 5 accounts
    let remaining: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 100, "limit": 10}))
        .await?
        .json()?;

    step("Verify remaining 5 verifications can be fetched", || {
        assert_eq!(remaining.len(), 5, "Should get remaining 5 verifications");
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Pagination")]
#[allure_severity("normal")]
#[allure_tags("integration", "pagination", "edge-case")]
#[allure_description(
    "Verifies that pagination returns empty when from_index is beyond existing data."
)]
#[allure_test]
#[tokio::test]
async fn test_pagination_from_index_beyond_data() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    // Request from index beyond existing data
    let verifications: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 1000, "limit": 10}))
        .await?
        .json()?;

    step("Verify empty result when from_index is beyond data", || {
        assert_eq!(verifications.len(), 0);
    });

    Ok(())
}
