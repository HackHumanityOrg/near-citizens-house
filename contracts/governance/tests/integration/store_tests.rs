use allure_rs::prelude::*;
use near_workspaces::types::{AccountDetails, NearToken};
use serde_json::json;

use crate::helpers::{
    create_proposal, fast_forward_to_timestamp, get_proposal, init_governance,
    init_mock_verified_accounts, seed_mock_verified_accounts, setup_env, store_verification,
    sum_tokens_burnt, DEFAULT_GRACE_PERIOD_SECS, GAS_HEAVY,
};
use tokio::time::{sleep, Duration};

const STORAGE_PRICE_PER_BYTE: u128 = 10_000_000_000_000_000_000;

fn estimated_storage_cost() -> u128 {
    let bytes = u128::from(
        governance::ESTIMATED_PENDING_VOTE_BYTES.saturating_add(governance::ESTIMATED_VOTE_BYTES),
    );
    bytes.saturating_mul(STORAGE_PRICE_PER_BYTE)
}

async fn account_details(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    account_id: &near_workspaces::AccountId,
) -> anyhow::Result<AccountDetails> {
    Ok(worker.view_account(account_id).await?)
}

async fn drain_contract_to_available(
    worker: &near_workspaces::Worker<near_workspaces::network::Sandbox>,
    governance: &near_workspaces::Contract,
    recipient: &near_workspaces::Account,
    target_available: u128,
) -> anyhow::Result<()> {
    let details = account_details(worker, governance.id()).await?;
    let staked = u128::from(details.storage_usage).saturating_mul(STORAGE_PRICE_PER_BYTE);
    let current = details.balance.as_yoctonear();
    let target_balance = staked.saturating_add(target_available);
    if current > target_balance {
        let drain = current.saturating_sub(target_balance);
        let result = governance
            .as_account()
            .transfer_near(recipient.id(), NearToken::from_yoctonear(drain))
            .await?;
        assert!(result.is_success());
    }
    Ok(())
}

fn refund_from_voter_balance(before: u128, after: u128, deposit: u128, gas_burnt: u128) -> u128 {
    after
        .saturating_add(deposit)
        .saturating_add(gas_burnt)
        .saturating_sub(before)
}

fn balance_delta(before: &AccountDetails, after: &AccountDetails) -> u128 {
    after
        .balance
        .as_yoctonear()
        .saturating_sub(before.balance.as_yoctonear())
}

async fn pending_votes_count(
    governance: &near_workspaces::Contract,
    proposal_id: u32,
) -> anyhow::Result<u64> {
    Ok(governance
        .view("get_pending_votes_count")
        .args_json(json!({ "proposal_id": proposal_id }))
        .await?
        .json()?)
}

async fn wait_for_pending_votes(
    governance: &near_workspaces::Contract,
    proposal_id: u32,
    expected: u64,
) -> anyhow::Result<bool> {
    for _ in 0..40 {
        let count = pending_votes_count(governance, proposal_id).await?;
        if count == expected {
            return Ok(true);
        }
        sleep(Duration::from_millis(50)).await;
    }
    Ok(false)
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies store 001 free vote when contract has balance.")]
#[allure_test]
async fn it_store_001_free_vote_when_contract_has_balance() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "store1",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let voter_before = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        0,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, 0);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies store 001b deposit attached when free partial refund.")]
#[allure_test]
async fn it_store_001b_deposit_attached_when_free_partial_refund() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "store1b",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let contract_before = account_details(&worker, governance.id()).await?;
    let deposit = NearToken::from_millinear(10).as_yoctonear();
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let _ = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    let contract_after = account_details(&worker, governance.id()).await?;
    let balance_increase = balance_delta(&contract_before, &contract_after);
    assert!(balance_increase > 0);
    assert!(balance_increase < deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies store 002 deposit required and excess refunded.")]
#[allure_test]
async fn it_store_002_deposit_required_and_excess_refunded() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "store2",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let contract_before = account_details(&worker, governance.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(10).as_yoctonear();
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let _ = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    let contract_after = account_details(&worker, governance.id()).await?;
    let balance_increase = balance_delta(&contract_before, &contract_after);
    assert!(balance_increase > 0);
    assert!(balance_increase < deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies store 003 deposit refunded on rejection.")]
#[allure_test]
async fn it_store_003_deposit_refunded_on_rejection() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, true, false).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let voter = worker.dev_create_account().await?;

    seed_mock_verified_accounts(&mock_verified, &[voter.clone()], 0).await?;

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "store3",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let voter_before = account_details(&worker, voter.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = voter
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, voter.id()).await?;

    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies store 004 refund calculation accuracy.")]
#[allure_test]
async fn it_store_004_refund_calculation_accuracy() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "store4",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let contract_before = account_details(&worker, governance.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let _ = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    let contract_after = account_details(&worker, governance.id()).await?;
    let balance_increase = balance_delta(&contract_before, &contract_after);
    assert!(balance_increase > 0);
    assert!(balance_increase < deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 001 full refund on callback failed.")]
#[allure_test]
async fn it_refund_001_full_refund_on_callback_failed() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, true, false).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let voter = worker.dev_create_account().await?;

    seed_mock_verified_accounts(&mock_verified, &[voter.clone()], 0).await?;

    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref1",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let voter_before = account_details(&worker, voter.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = voter
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, voter.id()).await?;

    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 002 full refund on not verified.")]
#[allure_test]
async fn it_refund_002_full_refund_on_not_verified() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, _users) = setup_env(1).await?;
    let unverified = worker.dev_create_account().await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref2",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let voter_before = account_details(&worker, unverified.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = unverified
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, unverified.id()).await?;

    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 003 full refund on verified after creation.")]
#[allure_test]
async fn it_refund_003_full_refund_on_verified_after_creation() -> anyhow::Result<()> {
    let (worker, governance, verified, admin, backend, users) = setup_env(1).await?;
    let late_user = worker.dev_create_account().await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref3",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    // Verify after proposal creation
    store_verification(&backend, &verified, &late_user, "later", [9u8; 32]).await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let voter_before = account_details(&worker, late_user.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = late_user
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, late_user.id()).await?;

    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, deposit);

    let _ = users; // keep users in scope
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 004 full refund on proposal cancelled.")]
#[allure_test]
async fn it_refund_004_full_refund_on_proposal_cancelled() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let users = vec![worker.dev_create_account().await?];
    seed_mock_verified_accounts(&mock_verified, &users, 0).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref4",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let cancel_voter_before =
        account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let vote_tx = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact_async()
        .await?;
    let pending = wait_for_pending_votes(&governance, proposal_id, 1).await?;
    assert!(pending, "expected pending vote");

    let cancel_result = admin
        .call(governance.id(), "cancel_proposal")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(cancel_result.is_success());
    let cleared = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    assert!(cleared, "expected pending vote cleared");
    let vote_result = vote_tx.await?;
    assert!(vote_result.is_success());

    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let refund = refund_from_voter_balance(
        cancel_voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&vote_result),
    );
    assert_eq!(refund, deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 005 full refund on post finalize.")]
#[allure_test]
async fn it_refund_005_full_refund_on_post_finalize() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let mock_verified = init_mock_verified_accounts(&worker, false, true).await?;
    let delay_cfg = mock_verified
        .call("set_verification_delay_hops")
        .gas(GAS_HEAVY)
        .args_json(json!({ "hops": 24u8 }))
        .transact()
        .await?;
    assert!(delay_cfg.is_success());
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &mock_verified, &admin).await?;
    let users = vec![worker.dev_create_account().await?];
    seed_mock_verified_accounts(&mock_verified, &users, 0).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref5",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let voter_before = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let vote_tx = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact_async()
        .await?;
    let pending = wait_for_pending_votes(&governance, proposal_id, 1).await?;
    assert!(pending, "expected pending vote");

    fast_forward_to_timestamp(
        &worker,
        proposal.ends_at.0 + (DEFAULT_GRACE_PERIOD_SECS * 1_000_000_000) + 1,
    )
    .await?;
    let finalize_result = admin
        .call(governance.id(), "finalize_proposal")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id }))
        .transact()
        .await?;
    assert!(finalize_result.is_success());
    worker.fast_forward(40).await?;
    let cleared = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    assert!(cleared, "expected pending vote cleared");
    let vote_result = vote_tx.await?;
    assert!(vote_result.is_success());

    let voter_after = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&vote_result),
    );
    assert_eq!(refund, deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 006 full refund on proposal expired.")]
#[allure_test]
async fn it_refund_006_full_refund_on_proposal_expired() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref6",
        None,
        NearToken::from_millinear(10),
    )
    .await?;
    let proposal = get_proposal(&governance, proposal_id).await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    // Force a vote after the proposal ended (should be rejected and refunded).
    fast_forward_to_timestamp(&worker, proposal.ends_at.0 + 1).await?;
    let voter_before = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_failure());
    let voter_after = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;

    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        deposit,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 007 partial refund on success.")]
#[allure_test]
async fn it_refund_007_partial_refund_on_success() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref7",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    let contract_before = account_details(&worker, governance.id()).await?;
    let deposit = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    let _ = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    let contract_after = account_details(&worker, governance.id()).await?;
    let balance_increase = balance_delta(&contract_before, &contract_after);
    assert!(balance_increase > 0);
    assert!(balance_increase < deposit);
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 008 zero refund when deposit equals storage cost.")]
#[allure_test]
async fn it_refund_008_zero_refund_when_deposit_equals_storage_cost() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(2).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref8",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let storage_cost = estimated_storage_cost();
    drain_contract_to_available(&worker, &governance, &admin, storage_cost.saturating_sub(1))
        .await?;

    // First vote to estimate actual storage delta
    let contract_before_first = account_details(&worker, governance.id()).await?;
    let deposit_large = storage_cost + NearToken::from_millinear(5).as_yoctonear();
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(deposit_large))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let _ = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    let contract_after_first = account_details(&worker, governance.id()).await?;
    let balance_increase_first = balance_delta(&contract_before_first, &contract_after_first);
    assert!(balance_increase_first > 0);
    assert!(balance_increase_first < deposit_large);
    let actual_cost = balance_increase_first;

    // Ensure enough balance so deposit requirement doesn't apply
    let topup = admin
        .transfer_near(governance.id(), NearToken::from_near(5))
        .await?;
    assert!(topup.is_success());

    let contract_before = account_details(&worker, governance.id()).await?;
    let result = crate::helpers::user(&users, 1)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(actual_cost))
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let _ = wait_for_pending_votes(&governance, proposal_id, 0).await?;
    let contract_after = account_details(&worker, governance.id()).await?;
    let balance_increase = balance_delta(&contract_before, &contract_after);
    let diff = if balance_increase > actual_cost {
        balance_increase - actual_cost
    } else {
        actual_cost - balance_increase
    };
    assert!(diff < NearToken::from_millinear(1).as_yoctonear());
    Ok(())
}

#[tokio::test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Integration Tests")]
#[allure_sub_suite("Storage")]
#[allure_severity("normal")]
#[allure_tags("integration", "governance", "storage")]
#[allure_description("Verifies refund 009 no transfer when voting is free.")]
#[allure_test]
async fn it_refund_009_no_transfer_when_voting_is_free() -> anyhow::Result<()> {
    let (worker, governance, _verified, admin, _backend, users) = setup_env(1).await?;
    let proposal_id = create_proposal(
        &admin,
        &governance,
        "ref9",
        None,
        NearToken::from_millinear(10),
    )
    .await?;

    let voter_before = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let result = crate::helpers::user(&users, 0)
        .call(governance.id(), "cast_vote")
        .gas(GAS_HEAVY)
        .args_json(json!({ "proposal_id": proposal_id, "choice": "yes" }))
        .transact()
        .await?;
    assert!(result.is_success());
    worker.fast_forward(1).await?;
    let voter_after = account_details(&worker, crate::helpers::user(&users, 0).id()).await?;
    let refund = refund_from_voter_balance(
        voter_before.balance.as_yoctonear(),
        voter_after.balance.as_yoctonear(),
        0,
        sum_tokens_burnt(&result),
    );
    assert_eq!(refund, 0);
    Ok(())
}
