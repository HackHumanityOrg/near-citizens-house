//! Proposal creation tests for sputnik-bridge contract

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use helpers::*;
use near_workspaces::types::{Gas, NearToken};
use serde_json::json;

// ==================== PROPOSAL CREATION TESTS ====================

#[tokio::test]
async fn test_create_vote_proposal_success() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "Test proposal description").await?;
    assert!(
        result.is_success(),
        "Create proposal should succeed. Failures: {:?}",
        result.failures()
    );

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_returns_id() -> anyhow::Result<()> {
    let env = setup().await?;

    let initial_id = get_last_proposal_id(&env.sputnik_dao).await.unwrap_or(0);

    create_proposal_via_bridge(&env.backend, &env.bridge, "Test proposal").await?.into_result()?;

    let new_id = get_last_proposal_id(&env.sputnik_dao).await?;
    assert!(new_id > initial_id, "Proposal ID should increase");

    // Verify proposal exists and is a Vote type
    let proposal = get_proposal(&env.sputnik_dao, new_id - 1).await?;
    assert!(
        proposal.kind.as_str() == Some("Vote") || proposal.kind.get("Vote").is_some(),
        "Proposal should be Vote type. Kind: {:?}",
        proposal.kind
    );

    Ok(())
}

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

#[tokio::test]
async fn test_create_proposal_empty_description() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "").await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "cannot be empty"));

    Ok(())
}

#[tokio::test]
async fn test_create_proposal_too_long() -> anyhow::Result<()> {
    let env = setup().await?;
    let long_description = "x".repeat(10_001);

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, &long_description).await?;

    assert!(result.is_failure());
    assert!(contains_error(&result, "exceeds maximum"));

    Ok(())
}

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

#[tokio::test]
async fn test_create_proposal_whitespace_only_description() -> anyhow::Result<()> {
    let env = setup().await?;

    // Create proposal with only whitespace (spaces, tabs, newlines)
    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "   \t\n   ").await?;

    // Contract should reject whitespace-only descriptions as effectively empty
    assert!(result.is_failure(), "Whitespace-only description should be rejected");
    assert!(
        contains_error(&result, "cannot be empty"),
        "Should fail with 'cannot be empty' error. Actual failures: {:?}",
        result.failures()
    );

    Ok(())
}

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
    let proposal_id = get_last_proposal_id(&env.sputnik_dao).await? - 1;
    let proposal = get_proposal(&env.sputnik_dao, proposal_id).await?;
    assert!(
        proposal.description.contains("🗳️") && proposal.description.contains("提案"),
        "Description should preserve unicode characters"
    );

    Ok(())
}

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
    assert!(result.is_failure(), "Create proposal with insufficient deposit should fail");

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
