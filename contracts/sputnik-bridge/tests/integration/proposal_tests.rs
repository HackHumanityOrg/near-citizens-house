//! Proposal creation tests for sputnik-bridge contract

use super::helpers::*;
use allure_rs::bdd;
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== PROPOSAL CREATION TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Creation")]
#[allure_severity("critical")]
#[allure_tags("integration", "proposal", "happy-path")]
#[allure_description(r#"
## Purpose
Verifies that the backend wallet can successfully create a Vote proposal through the bridge contract.

## Flow
1. Backend calls `create_proposal` on bridge contract
2. Bridge forwards proposal to SputnikDAO
3. Vote proposal is created in SputnikDAO

## Expected
Transaction succeeds without errors.
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_vote_proposal_success() -> anyhow::Result<()> {
    let env = bdd::given("bridge contract connected to SputnikDAO", || {
        futures::executor::block_on(setup())
    })?;

    let result = bdd::when("backend creates a proposal via bridge", || {
        futures::executor::block_on(create_proposal_via_bridge(
            &env.backend,
            &env.bridge,
            "Test proposal description",
        ))
    })?;

    bdd::then("proposal is created successfully", || {
        assert!(
            result.is_success(),
            "Create proposal should succeed. Failures: {:?}",
            result.failures()
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Creation")]
#[allure_severity("normal")]
#[allure_tags("integration", "proposal")]
#[allure_description(r#"
## Purpose
Verifies that creating a proposal returns an incrementing ID and the proposal is of type Vote.

## Expected
- Proposal ID increments after creation
- Proposal type is "Vote"
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_returns_id() -> anyhow::Result<()> {
    let env = setup().await?;

    let initial_id = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);

    create_proposal_via_bridge(&env.backend, &env.bridge, "Test proposal")
        .await?
        .into_result()?;

    let new_id = get_last_proposal_id(&env.sputnik_dao).await?;
    assert!(new_id > initial_id, "Proposal ID should increase");

    // Verify proposal exists and is a Vote type
    let proposal = get_proposal(
        &env.sputnik_dao,
        new_id
            .checked_sub(1)
            .expect("new_id should be >= 1 after assertion"),
    )
    .await?;
    assert!(
        proposal.kind.as_str() == Some("Vote") || proposal.kind.get("Vote").is_some(),
        "Proposal should be Vote type. Kind: {:?}",
        proposal.kind
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Creation")]
#[allure_severity("critical")]
#[allure_tags("integration", "proposal", "security")]
#[allure_description(r#"
## Purpose
Verifies that only the backend wallet can create proposals - unauthorized accounts are rejected.

## Security
This is a critical access control test ensuring the bridge cannot be abused.

## Expected
Transaction fails with "Only backend wallet" error.
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_unauthorized() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let unauthorized = env.user(0);

    let result = unauthorized
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({ "description": "Test proposal" }))
        .deposit(NearToken::from_near(1))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "Only backend wallet"));

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Validation")]
#[allure_severity("critical")]
#[allure_tags("integration", "proposal", "validation")]
#[allure_description(r#"
## Purpose
Verifies that empty descriptions are rejected during proposal creation.

## Input Validation
Empty string "" should be rejected with "cannot be empty" error.
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_empty_description() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "").await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "cannot be empty"));

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Validation")]
#[allure_severity("critical")]
#[allure_tags("integration", "proposal", "validation")]
#[allure_description(r#"
## Purpose
Verifies that descriptions exceeding max length (10,000 chars) are rejected.

## Boundary Test
- Input: 10,001 characters (limit + 1)
- Expected: Fails with "exceeds maximum" error
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_too_long() -> anyhow::Result<()> {
    let env = setup().await?;
    let long_description = "x".repeat(10_001);

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, &long_description).await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "exceeds maximum"));

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Validation")]
#[allure_severity("normal")]
#[allure_tags("integration", "proposal", "boundary")]
#[allure_description(r#"
## Purpose
Verifies that descriptions at exactly the max length (10,000 chars) are accepted.

## Boundary Test
- Input: Exactly 10,000 characters (limit)
- Expected: Succeeds
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_exactly_max_length() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create description with exactly 10,000 characters (the max)
    let max_description = "x".repeat(10_000);

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, &max_description).await?;

    // Should succeed at exactly the boundary
    assert!(
        result.is_success(),
        "Proposal with exactly max length should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Validation")]
#[allure_severity("minor")]
#[allure_tags("integration", "proposal", "boundary")]
#[allure_description(r#"
## Purpose
Verifies that single character descriptions are valid (minimum valid length).

## Boundary Test
- Input: "x" (1 character, limit - 0)
- Expected: Succeeds
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_single_char_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with minimum valid description (1 character)
    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "x").await?;

    // Should succeed - single character is valid
    assert!(
        result.is_success(),
        "Proposal with single char description should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Validation")]
#[allure_severity("normal")]
#[allure_tags("integration", "proposal", "validation")]
#[allure_description(r#"
## Purpose
Verifies that whitespace-only descriptions are rejected as effectively empty.

## Input Validation
- Input: "   \t\n   " (whitespace only)
- Expected: Fails with "cannot be empty" (trimmed = empty)
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_whitespace_only_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with only whitespace (spaces, tabs, newlines)
    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "   \t\n   ").await?;

    // Contract should reject whitespace-only descriptions as effectively empty
    assert!(
        result.is_failure(),
        "Whitespace-only description should be rejected"
    );
    assert!(
        contains_error(&result, "cannot be empty"),
        "Should fail with 'cannot be empty' error. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Validation")]
#[allure_severity("minor")]
#[allure_tags("integration", "proposal", "unicode")]
#[allure_description(r#"
## Purpose
Verifies that unicode characters (emoji, CJK, Arabic) are preserved in proposal descriptions.

## Unicode Support
Tests multi-language support: "Vote on 🗳️ proposal 提案 مقترح"
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_unicode_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with unicode characters (emoji, CJK, etc.)
    let unicode_description = "Vote on 🗳️ proposal 提案 مقترح";

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, unicode_description).await?;

    // Should succeed - unicode is valid text
    assert!(
        result.is_success(),
        "Proposal with unicode description should succeed. Failures: {:?}",
        result.failures()
    );

    // Verify the proposal was created with correct description
    let proposal_id = get_last_proposal_id(&env.sputnik_dao)
        .await?
        .checked_sub(1)
        .expect("expected at least one proposal");
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert!(
        proposal.description.contains("🗳️") && proposal.description.contains("提案"),
        "Description should preserve unicode characters"
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Proposal Creation")]
#[allure_severity("normal")]
#[allure_tags("integration", "proposal", "deposit")]
#[allure_description(r#"
## Purpose
Verifies that proposals with insufficient deposit are rejected.

## SputnikDAO Integration
SputnikDAO requires minimum bond (1 NEAR by default). 0.1 NEAR should fail.
"#)]
#[allure_test]
#[tokio::test]
async fn test_create_proposal_insufficient_deposit() -> anyhow::Result<()> {
    let env = setup().await?;

    // Try to create proposal with insufficient deposit
    let result = env
        .backend
        .call(env.bridge.id(), "create_proposal")
        .args_json(json!({ "description": "Underfunded proposal" }))
        .deposit(NearToken::from_millinear(100)) // 0.1 NEAR instead of 1 NEAR
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    // Should fail due to insufficient proposal bond
    assert!(
        result.is_failure(),
        "Create proposal with insufficient deposit should fail"
    );

    // Verify error message mentions insufficient deposit/bond
    let has_deposit_error = contains_error(&result, "Not enough deposit")
        || contains_error(&result, "ERR_MIN_BOND")
        || contains_error(&result, "insufficient");
    assert!(
        has_deposit_error,
        "Error should mention insufficient deposit. Failures: {:?}",
        result.failures()
    );

    Ok(())
}
