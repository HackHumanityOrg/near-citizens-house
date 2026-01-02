//! Read-only function tests for verified-accounts contract

use crate::helpers::init;
use allure_rs::prelude::*;
use serde_json::json;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("integration", "read", "verification-status")]
#[allure_description(
    "Verifies that is_verified returns false for accounts that have not been verified."
)]
#[allure_test]
#[tokio::test]
async fn test_is_verified_returns_false_for_unverified() -> anyhow::Result<()> {
    let (worker, contract, _backend) = init().await?;
    let user = worker.dev_create_account().await?;

    let is_verified: bool = contract
        .view("is_verified")
        .args_json(json!({"account_id": user.id()}))
        .await?
        .json()?;

    step(
        "Verify is_verified returns false for unverified account",
        || {
            assert!(!is_verified);
        },
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("integration", "read", "pagination")]
#[allure_description("Verifies that list_verifications returns an empty list when no accounts have been verified.")]
#[allure_test]
#[tokio::test]
async fn test_list_verifications_empty() -> anyhow::Result<()> {
    let (_worker, contract, _backend) = init().await?;

    let verifications: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 0, "limit": 10}))
        .await?
        .json()?;

    step("Verify list_verifications returns empty list", || {
        assert_eq!(verifications.len(), 0);
    });

    Ok(())
}
