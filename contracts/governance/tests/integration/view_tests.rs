use allure_rs::prelude::*;
use near_workspaces::types::NearToken;
use serde_json::json;

use crate::helpers::{create_proposal, setup_env};

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("View")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "view")]
#[allure_description("Verifies view 001 list proposals pagination.")]
#[allure_test]
async fn it_view_001_list_proposals_pagination() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    create_proposal(
        &admin,
        &governance,
        "p1",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    create_proposal(
        &admin,
        &governance,
        "p2",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    create_proposal(
        &admin,
        &governance,
        "p3",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let page1: Vec<governance::ProposalView> = governance
        .view("list_proposals")
        .args_json(json!({ "from_index": 0, "limit": 2 }))
        .await?
        .json()?;
    let page2: Vec<governance::ProposalView> = governance
        .view("list_proposals")
        .args_json(json!({ "from_index": 2, "limit": 2 }))
        .await?
        .json()?;
    assert_eq!(page1.len(), 2);
    assert_eq!(page2.len(), 1);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("View")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "view")]
#[allure_description("Verifies view 002 list votes pagination.")]
#[allure_test]
async fn it_view_002_list_votes_pagination() -> anyhow::Result<()> {
    let (_worker, governance, _verified, admin, _backend, users) = setup_env(3).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "v",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    for user in &users {
        let result = user
            .call(governance.id(), "cast_vote")
            .gas(crate::helpers::GAS_HEAVY)
            .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
            .transact()
            .await?;
        assert!(result.is_success());
    }

    let page1: Vec<governance::VoteView> = governance
        .view("list_votes")
        .args_json(json!({ "proposal_id": proposal_id, "from_index": 0, "limit": 2 }))
        .await?
        .json()?;
    let page2: Vec<governance::VoteView> = governance
        .view("list_votes")
        .args_json(json!({ "proposal_id": proposal_id, "from_index": 2, "limit": 2 }))
        .await?
        .json()?;
    assert_eq!(page1.len(), 2);
    assert_eq!(page2.len(), 1);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("View")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "view")]
#[allure_description("Verifies view 003 list admins blocklist out of range.")]
#[allure_test]
async fn it_view_003_list_admins_blocklist_out_of_range() -> anyhow::Result<()> {
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
    let result = admin
        .call(governance.id(), "blocklist_account")
        .gas(crate::helpers::GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "account_id": crate::helpers::user(&users, 1).id() }))
        .transact()
        .await?;
    assert!(result.is_success());

    let admins: Vec<near_workspaces::AccountId> = governance
        .view("list_admins")
        .args_json(json!({ "from_index": 10, "limit": 10 }))
        .await?
        .json()?;
    let blocklist: Vec<near_workspaces::AccountId> = governance
        .view("list_blocklist")
        .args_json(json!({ "from_index": 10, "limit": 10 }))
        .await?
        .json()?;
    assert!(admins.is_empty());
    assert!(blocklist.is_empty());
    Ok(())
}
