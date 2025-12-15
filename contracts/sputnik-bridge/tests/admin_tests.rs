//! Admin and event tests for sputnik-bridge contract
//!
//! Run with: cargo test --features integration-tests

#![cfg(feature = "integration-tests")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

mod helpers;

use allure_rs::prelude::*;
use helpers::*;
use near_workspaces::types::NearToken;
use serde_json::json;

// ==================== ADMIN TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "admin", "wallet")]
#[allure_test]
#[tokio::test]
async fn test_update_backend_wallet() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let new_backend = env.user(0);

    env.backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    let backend_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;
    assert_eq!(backend_wallet, new_backend.id().to_string());

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "wallet")]
#[allure_test]
#[tokio::test]
async fn test_backend_wallet_rotation_enforced() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let new_backend = env.user(0);

    // Rotate backend wallet
    env.backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    // Old backend can still verify users in verified-accounts
    verify_user(&env.backend, &env.verified_accounts, new_backend, 0).await?;

    // Old backend should now be blocked from bridge write calls
    let old_backend_result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": new_backend.id() }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(300))
        .transact()
        .await?;
    assert!(
        old_backend_result.is_failure(),
        "Old backend should be rejected after rotation"
    );
    assert!(contains_error(&old_backend_result, "Only backend wallet"));

    // New backend must be able to add members
    let add_result = new_backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": new_backend.id() }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(300))
        .transact()
        .await?;
    assert!(add_result.is_success(), "New backend should be authorized");

    let is_citizen =
        is_account_in_role(&env.sputnik_dao, new_backend.id().as_str(), "citizen").await?;
    assert!(
        is_citizen,
        "Rotated backend should successfully add members"
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Role Management")]
#[allure_severity("normal")]
#[allure_tags("integration", "admin", "role")]
#[allure_test]
#[tokio::test]
async fn test_update_citizen_role() -> anyhow::Result<()> {
    let env = setup().await?;

    env.backend
        .call(env.bridge.id(), "update_citizen_role")
        .args_json(json!({ "new_role": "voter" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    let citizen_role: String = env.bridge.view("get_citizen_role").await?.json()?;
    assert_eq!(citizen_role, "voter");

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Citizen Role Management")]
#[allure_severity("normal")]
#[allure_tags("integration", "admin", "events")]
#[allure_test]
#[tokio::test]
async fn test_update_citizen_role_applies_to_members_and_events() -> anyhow::Result<()> {
    // Start with policy that already defines the new role we plan to use ("voter")
    let env = setup_with_policy_and_users(
        1,
        |bridge_account_id| {
            json!({
                "roles": [
                    {
                        "name": "bridge",
                        "kind": { "Group": [bridge_account_id] },
                        "permissions": [
                            "add_member_to_role:AddProposal",
                            "add_member_to_role:VoteApprove",
                            "policy_add_or_update_role:AddProposal",
                            "policy_add_or_update_role:VoteApprove",
                            "vote:AddProposal"
                        ],
                        "vote_policy": {}
                    },
                    {
                        "name": "citizen",
                        "kind": { "Group": [] },
                        "permissions": [
                            "vote:VoteApprove",
                            "vote:VoteReject"
                        ],
                        "vote_policy": {}
                    },
                    {
                        "name": "voter",
                        "kind": { "Group": [] },
                        "permissions": [
                            "vote:VoteApprove",
                            "vote:VoteReject"
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
        },
        true,
    )
    .await?;
    let user = env.user(0);

    env.backend
        .call(env.bridge.id(), "update_citizen_role")
        .args_json(json!({ "new_role": "voter" }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;
    let logs = extract_event_logs(&result);
    result.into_result()?;

    let is_voter = is_account_in_role(&env.sputnik_dao, user.id().as_str(), "voter").await?;
    assert!(
        is_voter,
        "User should be placed into the updated citizen role"
    );

    let events = parse_events(&logs);
    let member_added_events: Vec<_> = events
        .iter()
        .filter(|e| e.event == "member_added")
        .collect();
    assert_eq!(
        member_added_events.len(),
        1,
        "Expected exactly one member_added event, found {}",
        member_added_events.len()
    );
    let member_added = member_added_events[0];

    // Use the event's proposal_id as source of truth (avoids order-dependent assumptions)
    let add_member_proposal_id = member_added
        .data
        .get("proposal_id")
        .and_then(|v| v.as_u64())
        .expect("member_added event should have proposal_id");

    // Verify the proposal exists in the DAO
    let proposal = get_proposal(&env.sputnik_dao, add_member_proposal_id).await?;
    assert!(
        proposal.description.contains("Add member"),
        "Proposal should be an add member proposal"
    );

    assert_eq!(
        member_added.data.get("member_id"),
        Some(&json!(user.id().to_string()))
    );
    assert_eq!(member_added.data.get("role"), Some(&json!("voter")));

    Ok(())
}

// ==================== EVENT TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("integration", "events")]
#[allure_test]
#[tokio::test]
async fn test_member_added_event_emitted() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    // Extract logs before consuming result
    let logs = extract_event_logs(&result);
    result.into_result()?;

    let events = parse_events(&logs);

    let member_added_events: Vec<_> = events
        .iter()
        .filter(|e| e.event == "member_added")
        .collect();
    assert_eq!(
        member_added_events.len(),
        1,
        "Expected exactly one member_added event, found {}",
        member_added_events.len()
    );
    let member_added = member_added_events[0];

    // Use the event's proposal_id as source of truth (avoids order-dependent assumptions)
    let add_member_proposal_id = member_added
        .data
        .get("proposal_id")
        .and_then(|v| v.as_u64())
        .expect("member_added event should have proposal_id");

    // Verify the proposal exists in the DAO
    let proposal = get_proposal(&env.sputnik_dao, add_member_proposal_id).await?;
    assert!(
        proposal.description.contains("Add member"),
        "Proposal should be an add member proposal"
    );

    assert_eq!(
        member_added.data.get("member_id"),
        Some(&json!(user.id().to_string()))
    );
    assert_eq!(member_added.data.get("role"), Some(&json!("citizen")));

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("integration", "events")]
#[allure_test]
#[tokio::test]
async fn test_proposal_created_event_emitted() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "Event test").await?;

    // Extract logs before consuming result
    let logs = extract_event_logs(&result);
    result.into_result()?;

    let events = parse_events(&logs);

    let proposal_created_events: Vec<_> = events
        .iter()
        .filter(|e| e.event == "proposal_created")
        .collect();
    assert_eq!(
        proposal_created_events.len(),
        1,
        "Expected exactly one proposal_created event, found {}",
        proposal_created_events.len()
    );
    let proposal_created = proposal_created_events[0];

    // Verify event contains required fields with valid values
    let emitted_proposal_id = proposal_created
        .data
        .get("proposal_id")
        .and_then(|v| v.as_u64())
        .expect("proposal_created event should have proposal_id");
    assert_eq!(
        proposal_created.data.get("description"),
        Some(&json!("Event test"))
    );

    // Verify the emitted proposal_id corresponds to a real proposal in the DAO
    let proposal = get_proposal(&env.sputnik_dao, emitted_proposal_id).await?;
    assert_eq!(
        proposal.description, "Event test",
        "Proposal description should match"
    );

    Ok(())
}
