//! State consistency and invariant tests for sputnik-bridge contract
//!
//! These tests verify that system invariants hold across operations:
//! - Bridge config remains unchanged after operations
//! - DAO citizens are always verified
//! - Proposal IDs are sequential

use super::helpers::*;
use allure_rs::prelude::*;
use serde_json::json;

// ==================== BRIDGE INVARIANT TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("State Consistency")]
#[allure_severity("critical")]
#[allure_tags("integration", "invariant", "state")]
#[allure_description(r#"
## Purpose
Verifies that bridge configuration (sputnik_dao, verified_accounts) remains unchanged
after member additions and proposal creations.

## Test 13.2.1 - bridge_config_unchanged_after_operations

## Invariant
sputnik_dao and verified_accounts_contract addresses never change.
"#)]

#[allure_test]
#[tokio::test]
async fn test_bridge_config_unchanged_after_operations() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    // Get initial config
    let initial_info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    // Perform multiple operations: verify and add 3 members
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // Create a proposal
    create_proposal_via_bridge(&env.backend, &env.bridge, "Test config invariant")
        .await?
        .into_result()?;

    // Get config after operations
    let final_info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    step("Verify sputnik_dao address unchanged", || {
        // Verify immutable fields are unchanged
        assert_eq!(
            initial_info.sputnik_dao, final_info.sputnik_dao,
            "sputnik_dao should be unchanged after operations"
        );
    });

    step("Verify verified_accounts_contract unchanged", || {
        assert_eq!(
            initial_info.verified_accounts_contract, final_info.verified_accounts_contract,
            "verified_accounts_contract should be unchanged after operations"
        );
        // backend_wallet and citizen_role CAN change, so we don't check them
    });

    Ok(())
}

// ==================== CROSS-SYSTEM INVARIANT TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("State Consistency")]
#[allure_severity("critical")]
#[allure_tags("integration", "invariant", "cross-system")]
#[allure_description(r#"
## Purpose
Verifies that all citizens in the DAO are verified in the verified-accounts contract.
This is a critical Sybil-resistance invariant.

## Test 13.3.1 - dao_citizens_are_verified

## Invariant
For every account in the DAO citizen role, is_account_verified() == true.
"#)]

#[allure_test]
#[tokio::test]
async fn test_dao_citizens_are_verified() -> anyhow::Result<()> {
    let env = setup_with_users(5).await?;

    // Add 5 citizens through proper flow
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // Get all citizens from DAO policy
    let policy: serde_json::Value = get_dao_policy(&env.sputnik_dao).await?;
    let roles = policy.get("roles").and_then(|r| r.as_array()).unwrap();

    let mut citizen_accounts: Vec<String> = Vec::new();
    for role in roles {
        if role.get("name").and_then(|n| n.as_str()) == Some("citizen") {
            if let Some(group) = role.get("kind").and_then(|k| k.get("Group")).and_then(|g| g.as_array()) {
                for member in group {
                    if let Some(account_id) = member.as_str() {
                        citizen_accounts.push(account_id.to_string());
                    }
                }
            }
        }
    }

    step("Verify 5 citizens are in DAO", || {
        assert_eq!(citizen_accounts.len(), 5, "Should have 5 citizens");
    });

    // Verify each citizen is verified in verified-accounts contract
    for account_id in &citizen_accounts {
        let is_verified: bool = env
            .verified_accounts
            .view("is_account_verified")
            .args_json(json!({ "near_account_id": account_id }))
            .await?
            .json()?;

        assert!(
            is_verified,
            "Citizen {} should be verified in verified-accounts contract",
            account_id
        );
    }

    step("Verify all citizens are verified in verified-accounts", || {
        // All verifications passed above
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("State Consistency")]
#[allure_severity("normal")]
#[allure_tags("integration", "invariant", "cross-system")]
#[allure_description(r#"
## Purpose
Verifies that verified accounts are NOT automatically citizens.
Being verified is a prerequisite but doesn't grant citizenship.

## Test 13.3.2 - verified_accounts_not_necessarily_citizens

## Invariant
Verification != Citizenship. User must go through add_member to become citizen.
"#)]

#[allure_test]
#[tokio::test]
async fn test_verified_accounts_not_necessarily_citizens() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;

    // Verify all 3 users
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
    }

    // Only add user 0 as citizen
    add_member_via_bridge(&env.backend, &env.bridge, env.user(0))
        .await?
        .into_result()?;

    // User 0 should be citizen
    let user0_is_citizen =
        is_account_in_role(&env.sputnik_dao, env.user(0).id().as_str(), "citizen").await?;

    step("Verify user 0 is a citizen", || {
        assert!(user0_is_citizen, "User 0 should be citizen");
    });

    // Users 1 and 2 are verified but NOT citizens
    for i in 1..3 {
        let user = env.user(i);

        // Verified
        let is_verified = is_user_verified(&env.verified_accounts, user).await?;
        assert!(is_verified, "User {} should be verified", i);

        // But NOT citizen
        let is_citizen =
            is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;
        assert!(
            !is_citizen,
            "User {} should NOT be citizen (only verified)",
            i
        );
    }

    step("Verify users 1 and 2 are verified but not citizens", || {
        // All verifications passed above
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("State Consistency")]
#[allure_severity("normal")]
#[allure_tags("integration", "invariant", "proposal")]
#[allure_description(r#"
## Purpose
Verifies that proposal IDs are sequential with no gaps.

## Test 13.3.3 - proposal_count_consistency

## Invariant
Proposal IDs increment by 1 for each proposal, starting from 0.
"#)]

#[allure_test]
#[tokio::test]
async fn test_proposal_count_consistency() -> anyhow::Result<()> {
    let env = setup_with_users(2).await?;

    // Get initial proposal count
    let initial_count = get_last_proposal_id(&env.sputnik_dao).await?;

    // Add 2 citizens (each creates 2 proposals: add_member + quorum_update)
    for (i, user) in env.users.iter().enumerate() {
        verify_user(&env.backend, &env.verified_accounts, user, i).await?;
        add_member_via_bridge(&env.backend, &env.bridge, user)
            .await?
            .into_result()?;
    }

    // Create 3 Vote proposals
    for i in 0..3 {
        create_proposal_via_bridge(&env.backend, &env.bridge, &format!("Proposal {}", i))
            .await?
            .into_result()?;
    }

    // Final count: initial + 2*2 (member additions) + 3 (vote proposals) = initial + 7
    let final_count = get_last_proposal_id(&env.sputnik_dao).await?;

    step("Verify exactly 7 proposals were created", || {
        assert_eq!(
            final_count,
            initial_count + 7,
            "Should have created exactly 7 proposals (4 from add_member + 3 vote)"
        );
    });

    // Verify proposals exist with sequential IDs (no gaps)
    for id in initial_count..final_count {
        let proposal = get_proposal(&env.sputnik_dao, id).await;
        assert!(
            proposal.is_ok(),
            "Proposal {} should exist (no gaps in sequence)",
            id
        );
    }

    step("Verify proposal IDs are sequential with no gaps", || {
        // All proposals verified above
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("State Consistency")]
#[allure_severity("critical")]
#[allure_tags("integration", "invariant", "failure-recovery")]
#[allure_description(r#"
## Purpose
Verifies that a failed add_member leaves the DAO state unchanged.

## Test 13.4.2 - failed_add_member_leaves_dao_unchanged

## Invariant
If add_member fails, no proposal is created and user is not in DAO.
"#)]

#[allure_test]
#[tokio::test]
async fn test_failed_add_member_leaves_dao_unchanged() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    // Get initial state
    let initial_proposal_count = get_last_proposal_id(&env.sputnik_dao).await?;
    let initial_citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;

    // Try to add unverified user (will fail at verification step)
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    step("Verify add_member fails for unverified user", || {
        assert!(result.is_failure(), "Should fail for unverified user");
    });

    // Verify DAO state is unchanged
    let final_proposal_count = get_last_proposal_id(&env.sputnik_dao).await?;
    let final_citizen_count = get_citizen_count(&env.sputnik_dao, "citizen").await?;

    step("Verify proposal count unchanged after failure", || {
        assert_eq!(
            initial_proposal_count, final_proposal_count,
            "Proposal count should be unchanged after failed add_member"
        );
    });

    step("Verify citizen count unchanged after failure", || {
        assert_eq!(
            initial_citizen_count, final_citizen_count,
            "Citizen count should be unchanged after failed add_member"
        );
    });

    // User should not be citizen
    let is_citizen = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "citizen").await?;

    step("Verify user is not citizen after failure", || {
        assert!(!is_citizen, "User should not be citizen after failed add_member");
    });

    Ok(())
}
