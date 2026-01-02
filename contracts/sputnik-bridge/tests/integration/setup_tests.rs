//! Setup and initialization tests for sputnik-bridge contract

use super::helpers::*;
use allure_rs::prelude::*;

// ==================== SETUP TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "initialization")]
#[allure_description("Verifies that all contracts are deployed and the bridge is initialized with correct configuration.")]
#[allure_test]
#[tokio::test]
async fn test_full_setup() -> anyhow::Result<()> {
    let env = setup().await?;

    step("Verify all contracts are deployed", || {
        assert!(!env.sputnik_dao.id().to_string().is_empty());
        assert!(!env.verified_accounts.id().to_string().is_empty());
        assert!(!env.bridge.id().to_string().is_empty());
    });

    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    step("Verify bridge initialization", || {
        assert_eq!(info.backend_wallet, env.backend.id().to_string());
        assert_eq!(info.sputnik_dao, env.sputnik_dao.id().to_string());
        assert_eq!(
            info.verified_accounts_contract,
            env.verified_accounts.id().to_string()
        );
        assert_eq!(info.citizen_role, "citizen");
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao")]
#[allure_description(
    "Verifies that the bridge contract is properly registered in the DAO's bridge role."
)]
#[allure_test]
#[tokio::test]
async fn test_bridge_connected_to_dao() -> anyhow::Result<()> {
    let env = setup().await?;

    let is_in_bridge_role =
        is_account_in_role(&env.sputnik_dao, env.bridge.id().as_str(), "bridge").await?;

    step("Verify bridge is in bridge role", || {
        assert!(is_in_bridge_role, "Bridge should be in bridge role");
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "policy")]
#[allure_description("Verifies that the DAO policy is configured correctly with proper proposal period and citizen role.")]
#[allure_test]
#[tokio::test]
async fn test_dao_policy_configured_correctly() -> anyhow::Result<()> {
    let env = setup().await?;
    let policy = get_dao_policy(&env.sputnik_dao).await?;

    step("Verify proposal period is 10 seconds", || {
        let proposal_period = policy
            .get("proposal_period")
            .and_then(|p| p.as_str())
            .unwrap();
        assert_eq!(proposal_period, PROPOSAL_PERIOD_NS.to_string());
    });

    step("Verify citizen role exists", || {
        let roles = policy.get("roles").and_then(|r| r.as_array()).unwrap();
        let citizen_role = roles
            .iter()
            .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("citizen"));
        assert!(citizen_role.is_some(), "Citizen role should exist");
    });

    Ok(())
}

/// Test 1.3.2: Verify DAO has empty citizen role initially
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Integration Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao", "citizen-role")]
#[allure_description(
    "Verifies that the DAO has an empty citizen role initially, ready for citizens to be added."
)]
#[allure_test]
#[tokio::test]
async fn test_dao_init_with_citizen_role() -> anyhow::Result<()> {
    let env = setup().await?;
    let policy = get_dao_policy(&env.sputnik_dao).await?;

    let citizen_role = step("Find citizen role in policy", || {
        let roles = policy
            .get("roles")
            .and_then(|r| r.as_array())
            .expect("Policy should have roles");
        roles
            .iter()
            .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("citizen"))
            .expect("Citizen role should exist")
            .clone()
    });

    step("Verify citizen role is empty Group initially", || {
        let kind = citizen_role.get("kind").expect("Role should have kind");
        let group = kind.get("Group").expect("Citizen role should be a Group");
        let members = group.as_array().expect("Group should be an array");
        assert!(members.is_empty(), "Citizen role should be empty initially");
    });

    step("Verify citizens have vote permissions", || {
        let permissions = citizen_role
            .get("permissions")
            .and_then(|p| p.as_array())
            .expect("Role should have permissions");
        let has_vote_permissions = permissions.iter().any(|p| {
            p.as_str()
                .map(|s| s.contains("VoteApprove") || s.contains("VoteReject"))
                .unwrap_or(false)
        });
        assert!(
            has_vote_permissions,
            "Citizen role should have vote permissions"
        );
    });

    Ok(())
}

/// Test 1.3.3: Verify bridge has add_member_to_role permissions
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Integration Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao", "permissions")]
#[allure_description("Verifies that the bridge role has add_member_to_role:AddProposal and VoteApprove permissions for auto-approval.")]
#[allure_test]
#[tokio::test]
async fn test_dao_init_bridge_has_add_member_permission() -> anyhow::Result<()> {
    let env = setup().await?;
    let policy = get_dao_policy(&env.sputnik_dao).await?;

    let perm_strings = step("Extract bridge role permissions", || {
        let roles = policy
            .get("roles")
            .and_then(|r| r.as_array())
            .expect("Policy should have roles");
        let bridge_role = roles
            .iter()
            .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("bridge"))
            .expect("Bridge role should exist");
        let permissions = bridge_role
            .get("permissions")
            .and_then(|p| p.as_array())
            .expect("Role should have permissions");
        permissions
            .iter()
            .filter_map(|p| p.as_str())
            .map(String::from)
            .collect::<Vec<_>>()
    });

    step("Verify bridge has add_member_to_role:AddProposal", || {
        let has_add_proposal = perm_strings
            .iter()
            .any(|p| p.contains("add_member_to_role") && p.contains("AddProposal"));
        assert!(
            has_add_proposal,
            "Bridge should have add_member_to_role:AddProposal. Found: {:?}",
            perm_strings
        );
    });

    step("Verify bridge has add_member_to_role:VoteApprove", || {
        let has_vote_approve = perm_strings
            .iter()
            .any(|p| p.contains("add_member_to_role") && p.contains("VoteApprove"));
        assert!(
            has_vote_approve,
            "Bridge should have add_member_to_role:VoteApprove for auto-approval. Found: {:?}",
            perm_strings
        );
    });

    Ok(())
}

/// Test 1.3.4: Verify bridge has policy update permissions
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Integration Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao", "permissions")]
#[allure_description(
    "Verifies that the bridge role has policy_add_or_update_role permissions for quorum updates."
)]
#[allure_test]
#[tokio::test]
async fn test_dao_init_bridge_has_policy_update_permission() -> anyhow::Result<()> {
    let env = setup().await?;
    let policy = get_dao_policy(&env.sputnik_dao).await?;

    let perm_strings = step("Extract bridge role permissions", || {
        let roles = policy
            .get("roles")
            .and_then(|r| r.as_array())
            .expect("Policy should have roles");
        let bridge_role = roles
            .iter()
            .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("bridge"))
            .expect("Bridge role should exist");
        let permissions = bridge_role
            .get("permissions")
            .and_then(|p| p.as_array())
            .expect("Role should have permissions");
        permissions
            .iter()
            .filter_map(|p| p.as_str())
            .map(String::from)
            .collect::<Vec<_>>()
    });

    step(
        "Verify bridge has policy_add_or_update_role:AddProposal",
        || {
            let has_policy_add_proposal = perm_strings
                .iter()
                .any(|p| p.contains("policy_add_or_update_role") && p.contains("AddProposal"));
            assert!(
                has_policy_add_proposal,
                "Bridge should have policy_add_or_update_role:AddProposal. Found: {:?}",
                perm_strings
            );
        },
    );

    step(
        "Verify bridge has policy_add_or_update_role:VoteApprove",
        || {
            let has_policy_vote_approve = perm_strings
                .iter()
                .any(|p| p.contains("policy_add_or_update_role") && p.contains("VoteApprove"));
            assert!(
            has_policy_vote_approve,
            "Bridge should have policy_add_or_update_role:VoteApprove for quorum updates. Found: {:?}",
            perm_strings
        );
        },
    );

    Ok(())
}

/// Test 1.3.5: Verify bridge has vote proposal permissions
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Integration Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao", "permissions")]
#[allure_description(
    "Verifies that the bridge role has vote:AddProposal permission for creating Vote proposals."
)]
#[allure_test]
#[tokio::test]
async fn test_dao_init_bridge_has_vote_permission() -> anyhow::Result<()> {
    let env = setup().await?;
    let policy = get_dao_policy(&env.sputnik_dao).await?;

    let perm_strings = step("Extract bridge role permissions", || {
        let roles = policy
            .get("roles")
            .and_then(|r| r.as_array())
            .expect("Policy should have roles");
        let bridge_role = roles
            .iter()
            .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("bridge"))
            .expect("Bridge role should exist");
        let permissions = bridge_role
            .get("permissions")
            .and_then(|p| p.as_array())
            .expect("Role should have permissions");
        permissions
            .iter()
            .filter_map(|p| p.as_str())
            .map(String::from)
            .collect::<Vec<_>>()
    });

    step("Verify bridge has vote:AddProposal permission", || {
        let has_vote_add_proposal = perm_strings
            .iter()
            .any(|p| p.contains("vote") && p.contains("AddProposal"));
        assert!(
            has_vote_add_proposal,
            "Bridge should have vote:AddProposal permission. Found: {:?}",
            perm_strings
        );
    });

    Ok(())
}

/// Test 1.3.6: Verify "all" role can finalize proposals
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("DAO Integration Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "dao", "permissions")]
#[allure_description("Verifies that the 'all' (Everyone) role has *:Finalize permission so anyone can finalize expired proposals.")]
#[allure_test]
#[tokio::test]
async fn test_dao_init_all_role_can_finalize() -> anyhow::Result<()> {
    let env = setup().await?;
    let policy = get_dao_policy(&env.sputnik_dao).await?;

    let all_role = step("Find 'all' role in policy", || {
        let roles = policy
            .get("roles")
            .and_then(|r| r.as_array())
            .expect("Policy should have roles");
        roles
            .iter()
            .find(|r| r.get("name").and_then(|n| n.as_str()) == Some("all"))
            .expect("'all' role should exist")
            .clone()
    });

    step("Verify 'all' role is Everyone kind", || {
        let kind = all_role.get("kind").expect("Role should have kind");
        assert!(
            kind.as_str() == Some("Everyone"),
            "'all' role should be Everyone kind. Got: {:?}",
            kind
        );
    });

    step("Verify 'all' role has Finalize permission", || {
        let permissions = all_role
            .get("permissions")
            .and_then(|p| p.as_array())
            .expect("Role should have permissions");
        let perm_strings: Vec<&str> = permissions.iter().filter_map(|p| p.as_str()).collect();
        let has_finalize = perm_strings.iter().any(|p| p.contains("Finalize"));
        assert!(
            has_finalize,
            "'all' role should have Finalize permission. Found: {:?}",
            perm_strings
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Read Functions")]
#[allure_severity("normal")]
#[allure_tags("integration", "query", "view")]
#[allure_description(
    "Verifies that the get_info view function returns correct bridge configuration details."
)]
#[allure_test]
#[tokio::test]
async fn test_get_info() -> anyhow::Result<()> {
    let env = setup().await?;
    let info: BridgeInfo = env.bridge.view("get_info").await?.json()?;

    step("Verify get_info returns correct configuration", || {
        assert_eq!(info.backend_wallet, env.backend.id().to_string());
        assert_eq!(info.sputnik_dao, env.sputnik_dao.id().to_string());
        assert_eq!(
            info.verified_accounts_contract,
            env.verified_accounts.id().to_string()
        );
        assert_eq!(info.citizen_role, "citizen");
    });

    Ok(())
}

/// Test 1.2.5: Verify bridge contract cannot be reinitialized
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("critical")]
#[allure_tags("integration", "setup", "security")]
#[allure_description("Verifies that the bridge contract cannot be initialized twice.")]
#[allure_test]
#[tokio::test]
async fn test_init_cannot_reinitialize() -> anyhow::Result<()> {
    let env = setup().await?;

    let result = env
        .bridge
        .call("new")
        .args_json(serde_json::json!({
            "backend_wallet": env.backend.id(),
            "sputnik_dao": env.sputnik_dao.id(),
            "verified_accounts_contract": env.verified_accounts.id(),
            "citizen_role": "citizen"
        }))
        .transact()
        .await?;

    step("Verify reinitialization fails", || {
        assert!(
            result.is_failure(),
            "Reinitialization should fail. Got success instead."
        );
    });

    step("Verify error message indicates already initialized", || {
        let failure_msg = format!("{:?}", result.failures());
        assert!(
            failure_msg.contains("already initialized")
                || failure_msg.contains("The contract has already been initialized"),
            "Expected 'already initialized' error, got: {}",
            failure_msg
        );
    });

    Ok(())
}

/// Test 1.2.8: Initialize bridge with unicode role name
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("normal")]
#[allure_tags("integration", "setup", "unicode")]
#[allure_description("Verifies that unicode characters in role name are accepted.")]
#[allure_test]
#[tokio::test]
async fn test_init_with_unicode_role_name() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let backend = worker.dev_create_account().await?;

    let verified_accounts = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;
    verified_accounts
        .call("new")
        .args_json(serde_json::json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?
        .into_result()?;

    let sputnik_dao = worker.dev_deploy(SPUTNIKDAO_WASM).await?;
    let bridge = worker.dev_deploy(BRIDGE_WASM).await?;

    let policy = serde_json::json!({
        "roles": [
            {
                "name": "市民",
                "kind": { "Group": [] },
                "permissions": ["*:VoteApprove", "*:VoteReject"],
                "vote_policy": {}
            }
        ],
        "default_vote_policy": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [1, 2]
        },
        "proposal_bond": "1000000000000000000000000",
        "proposal_period": "10000000000",
        "bounty_bond": "1000000000000000000000000",
        "bounty_forgiveness_period": "86400000000000"
    });

    sputnik_dao
        .call("new")
        .args_json(serde_json::json!({
            "config": {
                "name": "test-dao",
                "purpose": "Unicode role test",
                "metadata": ""
            },
            "policy": policy
        }))
        .transact()
        .await?
        .into_result()?;

    let result = bridge
        .call("new")
        .args_json(serde_json::json!({
            "backend_wallet": backend.id(),
            "sputnik_dao": sputnik_dao.id(),
            "verified_accounts_contract": verified_accounts.id(),
            "citizen_role": "市民"
        }))
        .transact()
        .await?;

    step("Verify initialization with unicode role succeeds", || {
        assert!(
            result.is_success(),
            "Init with unicode role should succeed. Failures: {:?}",
            result.failures()
        );
    });

    let info: BridgeInfo = bridge.view("get_info").await?.json()?;

    step("Verify unicode role is stored correctly", || {
        assert_eq!(info.citizen_role, "市民");
    });

    Ok(())
}

/// Test 1.2.6: Initialize bridge with nonexistent DAO contract
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("normal")]
#[allure_tags("integration", "setup", "nonexistent")]
#[allure_description("Verifies that bridge initialization succeeds even if the DAO contract doesn't exist. Cross-contract calls will fail later.")]
#[allure_test]
#[tokio::test]
async fn test_init_with_nonexistent_dao() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let backend = worker.dev_create_account().await?;

    let verified_accounts = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;
    verified_accounts
        .call("new")
        .args_json(serde_json::json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?
        .into_result()?;

    let bridge = worker.dev_deploy(BRIDGE_WASM).await?;
    let fake_dao_id = "nonexistent-dao.near";

    let result = bridge
        .call("new")
        .args_json(serde_json::json!({
            "backend_wallet": backend.id(),
            "sputnik_dao": fake_dao_id,
            "verified_accounts_contract": verified_accounts.id(),
            "citizen_role": "citizen"
        }))
        .transact()
        .await?;

    step(
        "Verify initialization with nonexistent DAO succeeds",
        || {
            assert!(
                result.is_success(),
                "Init with nonexistent DAO should succeed. Failures: {:?}",
                result.failures()
            );
        },
    );

    let info: BridgeInfo = bridge.view("get_info").await?.json()?;

    step("Verify DAO address is stored correctly", || {
        assert_eq!(info.sputnik_dao, fake_dao_id);
    });

    Ok(())
}

/// Test 1.2.7: Initialize bridge with nonexistent verified-accounts contract
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("normal")]
#[allure_tags("integration", "setup", "nonexistent")]
#[allure_description("Verifies that bridge initialization succeeds even if the verified-accounts contract doesn't exist. Cross-contract calls will fail later.")]
#[allure_test]
#[tokio::test]
async fn test_init_with_nonexistent_verified_accounts() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let backend = worker.dev_create_account().await?;

    let sputnik_dao = worker.dev_deploy(SPUTNIKDAO_WASM).await?;
    let policy = serde_json::json!({
        "roles": [],
        "default_vote_policy": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [1, 2]
        },
        "proposal_bond": "1000000000000000000000000",
        "proposal_period": "10000000000",
        "bounty_bond": "1000000000000000000000000",
        "bounty_forgiveness_period": "86400000000000"
    });

    sputnik_dao
        .call("new")
        .args_json(serde_json::json!({
            "config": {
                "name": "test-dao",
                "purpose": "Nonexistent verified-accounts test",
                "metadata": ""
            },
            "policy": policy
        }))
        .transact()
        .await?
        .into_result()?;

    let bridge = worker.dev_deploy(BRIDGE_WASM).await?;
    let fake_verified_accounts_id = "nonexistent-verified.near";

    let result = bridge
        .call("new")
        .args_json(serde_json::json!({
            "backend_wallet": backend.id(),
            "sputnik_dao": sputnik_dao.id(),
            "verified_accounts_contract": fake_verified_accounts_id,
            "citizen_role": "citizen"
        }))
        .transact()
        .await?;

    step(
        "Verify initialization with nonexistent verified-accounts succeeds",
        || {
            assert!(
                result.is_success(),
                "Init with nonexistent verified-accounts should succeed. Failures: {:?}",
                result.failures()
            );
        },
    );

    let info: BridgeInfo = bridge.view("get_info").await?.json()?;

    step(
        "Verify verified-accounts address is stored correctly",
        || {
            assert_eq!(info.verified_accounts_contract, fake_verified_accounts_id);
        },
    );

    Ok(())
}

/// Test 1.2.9: Initialize bridge with special characters in role name
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Integration Tests")]
#[allure_sub_suite("Contract Setup")]
#[allure_severity("normal")]
#[allure_tags("integration", "setup", "special-chars")]
#[allure_description("Verifies that special characters (-, _, .) in role name are accepted.")]
#[allure_test]
#[tokio::test]
async fn test_init_with_special_chars_role() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let backend = worker.dev_create_account().await?;

    let verified_accounts = worker.dev_deploy(VERIFIED_ACCOUNTS_WASM).await?;
    verified_accounts
        .call("new")
        .args_json(serde_json::json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?
        .into_result()?;

    let sputnik_dao = worker.dev_deploy(SPUTNIKDAO_WASM).await?;
    let bridge = worker.dev_deploy(BRIDGE_WASM).await?;

    let policy = serde_json::json!({
        "roles": [
            {
                "name": "verified-citizen_v2.0",
                "kind": { "Group": [] },
                "permissions": ["*:VoteApprove", "*:VoteReject"],
                "vote_policy": {}
            }
        ],
        "default_vote_policy": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [1, 2]
        },
        "proposal_bond": "1000000000000000000000000",
        "proposal_period": "10000000000",
        "bounty_bond": "1000000000000000000000000",
        "bounty_forgiveness_period": "86400000000000"
    });

    sputnik_dao
        .call("new")
        .args_json(serde_json::json!({
            "config": {
                "name": "test-dao",
                "purpose": "Special chars role test",
                "metadata": ""
            },
            "policy": policy
        }))
        .transact()
        .await?
        .into_result()?;

    let result = bridge
        .call("new")
        .args_json(serde_json::json!({
            "backend_wallet": backend.id(),
            "sputnik_dao": sputnik_dao.id(),
            "verified_accounts_contract": verified_accounts.id(),
            "citizen_role": "verified-citizen_v2.0"
        }))
        .transact()
        .await?;

    step(
        "Verify initialization with special chars role succeeds",
        || {
            assert!(
                result.is_success(),
                "Init with special chars role should succeed. Failures: {:?}",
                result.failures()
            );
        },
    );

    let info: BridgeInfo = bridge.view("get_info").await?.json()?;

    step("Verify special chars role is stored correctly", || {
        assert_eq!(info.citizen_role, "verified-citizen_v2.0");
    });

    Ok(())
}
