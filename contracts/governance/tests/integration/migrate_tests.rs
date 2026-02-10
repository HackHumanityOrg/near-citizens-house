use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{create_proposal, get_proposal, setup_env};

fn assert_failure_contains(result: &near_workspaces::result::ExecutionFinalResult, needle: &str) {
    let failures = format!("{:?}", result.failures());
    assert!(
        failures.contains(needle),
        "Expected failure containing '{}', got {:?}",
        needle,
        failures
    );
}

#[tokio::test]
async fn it_mig_001_migrate_requires_admin_and_one_yocto() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;

    let res = crate::helpers::user(&users, 0)
        .call(governance.id(), "migrate")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");

    let res = admin.call(governance.id(), "migrate").transact().await?;
    assert_failure_contains(&res, "Requires attached deposit");

    let res = admin
        .call(governance.id(), "migrate")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(res.is_success());
    Ok(())
}

#[tokio::test]
async fn it_mig_002_migrate_preserves_state() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;

    // Add another admin
    let result = admin
        .call(governance.id(), "add_admin")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 0).id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    // Blocklist a user
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    // Create proposal and cast vote
    let proposal_id =
        create_proposal(&admin, &governance, "mig", None, NearToken::from_millinear(10)).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(crate::helpers::GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());

    let admins_before: Vec<near_workspaces::AccountId> = governance
        .view("list_admins")
        .args_json(json!({ "from_index": 0, "limit": 10 }))
        .await?
        .json()?;
    let blocklist_before: Vec<near_workspaces::AccountId> = governance
        .view("list_blocklist")
        .args_json(json!({ "from_index": 0, "limit": 10 }))
        .await?
        .json()?;
    let proposal_before = get_proposal(&governance, proposal_id).await?;
    let votes_before: Vec<governance::VoteView> = governance
        .view("list_votes")
        .args_json(json!({ "proposal_id": proposal_id, "from_index": 0, "limit": 10 }))
        .await?
        .json()?;

    let result = admin
        .call(governance.id(), "migrate")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert!(result.is_success());

    let admins_after: Vec<near_workspaces::AccountId> = governance
        .view("list_admins")
        .args_json(json!({ "from_index": 0, "limit": 10 }))
        .await?
        .json()?;
    let blocklist_after: Vec<near_workspaces::AccountId> = governance
        .view("list_blocklist")
        .args_json(json!({ "from_index": 0, "limit": 10 }))
        .await?
        .json()?;
    let proposal_after = get_proposal(&governance, proposal_id).await?;
    let votes_after: Vec<governance::VoteView> = governance
        .view("list_votes")
        .args_json(json!({ "proposal_id": proposal_id, "from_index": 0, "limit": 10 }))
        .await?
        .json()?;

    assert_eq!(admins_before, admins_after);
    assert_eq!(blocklist_before, blocklist_after);
    assert_eq!(
        serde_json::to_value(proposal_before)?,
        serde_json::to_value(proposal_after)?
    );
    assert_eq!(
        serde_json::to_value(votes_before)?,
        serde_json::to_value(votes_after)?
    );
    Ok(())
}

#[tokio::test]
async fn it_mig_003_migrate_non_admin_with_one_yocto() -> anyhow::Result<()> {
    let (_worker, governance, _verified, _admin, _backend, users) = setup_env(1).await?;
    let res = crate::helpers::user(&users, 0)
        .call(governance.id(), "migrate")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;
    assert_failure_contains(&res, "ERR_NOT_ADMIN");
    Ok(())
}
