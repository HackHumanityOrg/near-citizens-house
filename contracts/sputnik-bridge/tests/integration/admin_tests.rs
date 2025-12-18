//! Admin and event tests for sputnik-bridge contract

use super::helpers::*;
use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

// ==================== ADMIN TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "admin", "wallet")]
#[allure_description("Verifies that the backend wallet can update its address to a new wallet.")]

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

    step("Verify backend wallet was updated", || {
        assert_eq!(backend_wallet, new_backend.id().to_string());
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "wallet")]
#[allure_description("Verifies that after wallet rotation, the old backend wallet is blocked from bridge write operations while the new backend wallet has full access. Security-critical test.")]

#[allure_test]
#[tokio::test]
async fn test_backend_wallet_rotation_enforced() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let new_backend = env.user(0);

    env.backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    verify_user(&env.backend, &env.verified_accounts, new_backend, 0).await?;

    let old_backend_result = env
        .backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": new_backend.id() }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(300))
        .transact()
        .await?;

    step("Verify old backend is blocked after rotation", || {
        assert!(
            old_backend_result.is_failure(),
            "Old backend should be rejected after rotation"
        );
        assert!(contains_error(&old_backend_result, "Only backend wallet"));
    });

    let add_result = new_backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": new_backend.id() }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(300))
        .transact()
        .await?;

    step("Verify new backend can add members", || {
        assert!(add_result.is_success(), "New backend should be authorized");
    });

    let is_citizen =
        is_account_in_role(&env.sputnik_dao, new_backend.id().as_str(), "citizen").await?;

    step("Verify member was added successfully", || {
        assert!(
            is_citizen,
            "Rotated backend should successfully add members"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "yocto")]
#[allure_description("Verifies update_backend_wallet enforces exactly 1 yoctoNEAR deposit (rejects missing or excess deposit).")]
#[allure_test]
#[tokio::test]
async fn test_update_backend_wallet_requires_exact_yocto() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let new_backend = env.user(0);

    let no_deposit = env
        .backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .transact()
        .await?;

    step("Verify update_backend_wallet fails without deposit", || {
        assert!(no_deposit.is_failure(), "Call without yocto should fail");
        let failure_msg = format!("{:?}", no_deposit.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    let too_much = env
        .backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(2))
        .transact()
        .await?;

    step("Verify update_backend_wallet fails with >1 yocto", || {
        assert!(too_much.is_failure(), "Call with extra yocto should fail");
        let failure_msg = format!("{:?}", too_much.failures());
        assert!(
            failure_msg.contains("Requires attached deposit of exactly 1 yoctoNEAR"),
            "Expected yoctoNEAR error, got: {}",
            failure_msg
        );
    });

    // Confirm backend wallet unchanged
    let backend_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;
    step("Verify backend wallet remains unchanged after failed attempts", || {
        assert_eq!(backend_wallet, env.backend.id().to_string());
    });

    Ok(())
}

// ==================== EVENT TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("integration", "events")]
#[allure_description("Verifies that the member_added event is emitted when a member is successfully added to the DAO with correct event data.")]

#[allure_test]
#[tokio::test]
async fn test_member_added_event_emitted() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let user = env.user(0);

    verify_user(&env.backend, &env.verified_accounts, user, 0).await?;
    let result = add_member_via_bridge(&env.backend, &env.bridge, user).await?;

    let logs = extract_event_logs(&result);
    result.into_result()?;
    let events = parse_events(&logs);

    let member_added = step("Find member_added event", || {
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
        member_added_events[0].clone()
    });

    let add_member_proposal_id = step("Extract proposal_id from event", || {
        member_added
            .data
            .get("proposal_id")
            .and_then(|v| v.as_u64())
            .expect("member_added event should have proposal_id")
    });

    let proposal = get_proposal(&env.sputnik_dao, add_member_proposal_id).await?;

    step("Verify proposal exists in DAO", || {
        assert!(
            proposal.description.contains("Add verified citizen"),
            "Proposal should be an add member proposal. Got: {}",
            proposal.description
        );
    });

    step("Verify event contains correct member_id and role", || {
        assert_eq!(
            member_added.data.get("member_id"),
            Some(&json!(user.id().to_string()))
        );
        assert_eq!(member_added.data.get("role"), Some(&json!("citizen")));
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("integration", "events")]
#[allure_description("Verifies that the proposal_created event is emitted when a proposal is created via the bridge with correct event data.")]

#[allure_test]
#[tokio::test]
async fn test_proposal_created_event_emitted() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = create_proposal_via_bridge(&env.backend, &env.bridge, "Event test").await?;
    let logs = extract_event_logs(&result);
    result.into_result()?;
    let events = parse_events(&logs);

    let proposal_created = step("Find proposal_created event", || {
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
        proposal_created_events[0].clone()
    });

    let emitted_proposal_id = step("Extract and verify event fields", || {
        let id = proposal_created
            .data
            .get("proposal_id")
            .and_then(|v| v.as_u64())
            .expect("proposal_created event should have proposal_id");
        assert_eq!(
            proposal_created.data.get("description"),
            Some(&json!("Event test"))
        );
        id
    });

    let proposal = get_proposal(&env.sputnik_dao, emitted_proposal_id).await?;

    step("Verify proposal exists in DAO with correct description", || {
        assert_eq!(
            proposal.description, "Event test",
            "Proposal description should match"
        );
    });

    Ok(())
}

// ==================== BACKEND WALLET EDGE CASE TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "edge-case")]
#[allure_description("Verifies that the backend wallet can update to itself (no-op but valid operation) and continue functioning normally.")]

#[allure_test]
#[tokio::test]
async fn test_backend_wallet_self_update() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = env
        .backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": env.backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify self-update succeeds", || {
        assert!(
            result.is_success(),
            "Backend should be able to 'update' to itself. Failures: {:?}",
            result.failures()
        );
    });

    let backend_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;

    step("Verify backend is still the same", || {
        assert_eq!(backend_wallet, env.backend.id().to_string());
    });

    let user = env.worker.dev_create_account().await?;
    verify_user(&env.backend, &env.verified_accounts, &user, 0).await?;

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("critical")]
#[allure_tags("integration", "security", "concurrent")]
#[allure_description("Verifies that ongoing and subsequent operations work correctly after backend wallet rotation. Tests state consistency across rotation.")]

#[allure_test]
#[tokio::test]
async fn test_operations_continue_after_wallet_rotation() -> anyhow::Result<()> {
    let env = setup_with_users(3).await?;
    let user1 = env.user(0);
    let user2 = env.user(1);
    let new_backend = env.user(2);

    verify_user(&env.backend, &env.verified_accounts, user1, 0).await?;

    let result1 = add_member_via_bridge(&env.backend, &env.bridge, user1).await?;

    step("Verify user1 added before rotation", || {
        assert!(result1.is_success(), "First add should succeed");
    });

    env.backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?
        .into_result()?;

    verify_user(&env.backend, &env.verified_accounts, user2, 1).await?;

    let result2 = new_backend
        .call(env.bridge.id(), "add_member")
        .args_json(json!({ "near_account_id": user2.id() }))
        .deposit(NearToken::from_near(1))
        .gas(near_workspaces::types::Gas::from_tgas(300))
        .transact()
        .await?;

    step("Verify user2 added after rotation by new backend", || {
        assert!(
            result2.is_success(),
            "New backend should add members after rotation. Failures: {:?}",
            result2.failures()
        );
    });

    let is_user1_citizen =
        is_account_in_role(&env.sputnik_dao, user1.id().as_str(), "citizen").await?;
    let is_user2_citizen =
        is_account_in_role(&env.sputnik_dao, user2.id().as_str(), "citizen").await?;

    step("Verify both users are citizens", || {
        assert!(is_user1_citizen, "User1 should be citizen (added before rotation)");
        assert!(is_user2_citizen, "User2 should be citizen (added after rotation)");
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Backend Wallet Management")]
#[allure_severity("normal")]
#[allure_tags("integration", "admin", "wallet")]
#[allure_description(r#"
## Purpose
Verifies that the backend wallet update operation succeeds and the new wallet is correctly stored.

## Note
The contract does not currently emit a backend_wallet_updated event.
This could be added as a future enhancement.
"#)]

#[allure_test]
#[tokio::test]
async fn test_wallet_update_succeeds() -> anyhow::Result<()> {
    let env = setup_with_users(1).await?;
    let new_backend = env.user(0);
    let old_backend_id = env.backend.id().to_string();

    let result = env
        .backend
        .call(env.bridge.id(), "update_backend_wallet")
        .args_json(json!({ "new_backend_wallet": new_backend.id() }))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify wallet update succeeds", || {
        assert!(
            result.is_success(),
            "Backend wallet update should succeed. Failures: {:?}",
            result.failures()
        );
    });

    let stored_wallet: String = env.bridge.view("get_backend_wallet").await?.json()?;

    step("Verify new wallet is stored correctly", || {
        assert_eq!(
            stored_wallet,
            new_backend.id().to_string(),
            "Stored wallet should be the new backend"
        );
        assert_ne!(
            stored_wallet, old_backend_id,
            "Stored wallet should be different from old backend"
        );
    });

    Ok(())
}
