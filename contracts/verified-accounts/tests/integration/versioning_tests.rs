//! Versioning tests for verified-accounts contract
//!
//! Comprehensive tests for the contract's versioning infrastructure, including:
//! - Contract state versioning (VersionedContract enum with ContractV2)
//! - Record versioning (VersionedVerification enum with VerificationV2)
//! - Upgrade scenarios (redeploying contract code preserves state)
//!
//! ## Test Fixtures
//!
//! These tests use pre-built WASM artifacts from `tests/fixtures/`:
//! - `v1/verified_accounts.wasm` - V1 contract (current production)
//! - `v2/verified_accounts.wasm` - V2 contract with:
//!   - `VerificationV2` (adds hypothetical new fields)
//!   - `ContractV2` (adds `upgrade_timestamp` field)
//!
//! The V2 fixture was built from temporary V2 code (since reverted) to enable
//! testing real upgrade scenarios where V2 has fields/methods V1 doesn't know about.
//!
//! See `tests/fixtures/README.md` for details on rebuilding fixtures.
//!
//! ## Running Tests
//!
//! ```sh
//! cargo test --features integration-tests --test integration versioning
//! ```

use crate::helpers::{generate_nep413_signature, nonce_to_base64};
use allure_rs::prelude::*;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, AccountId, Contract, Worker};
use serde::{Deserialize, Serialize};
use serde_json::json;

/// Path to V1 WASM fixture (production build)
pub const WASM_V1_PATH: &str = "./tests/fixtures/v1/verified_accounts.wasm";

/// Path to V2 WASM fixture (has upgrade_timestamp field)
pub const WASM_V2_PATH: &str = "./tests/fixtures/v2/verified_accounts.wasm";

/// Verification summary response (matches contract's VerificationSummary)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerificationSummary {
    pub sumsub_applicant_id: String,
    pub near_account_id: AccountId,
    pub verified_at: u64,
}

/// Load V1 WASM from fixtures
fn load_v1_wasm() -> Vec<u8> {
    std::fs::read(WASM_V1_PATH).unwrap_or_else(|e| {
        panic!(
            "Could not find V1 WASM at {}. Build with: \
             cd contracts/verified-accounts && cargo near build reproducible-wasm && \
             mkdir -p tests/fixtures/v1 && cp target/near/verified_accounts.wasm tests/fixtures/v1/. \
             Error: {}",
            WASM_V1_PATH, e
        )
    })
}

/// Load V2 WASM from fixtures
fn load_v2_wasm() -> Vec<u8> {
    std::fs::read(WASM_V2_PATH).unwrap_or_else(|e| {
        panic!(
            "Could not find V2 WASM at {}. Build with: \
             cd contracts/verified-accounts/tests/fixtures/v2 && cargo near build reproducible-wasm && \
             cp target/near/verified_accounts_v2_fixture.wasm verified_accounts.wasm. \
             Error: {}",
            WASM_V2_PATH, e
        )
    })
}

/// Initialize test environment with V1 contract deployed
#[allow(dead_code)]
async fn init_v1() -> anyhow::Result<(Worker<near_workspaces::network::Sandbox>, Contract, Account)>
{
    let worker = near_workspaces::sandbox().await?;
    let wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;
    let contract = worker.dev_deploy(&wasm).await?;

    let result = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    assert!(
        result.is_success(),
        "V1 contract initialization failed: {:?}",
        result.failures()
    );

    Ok((worker, contract, backend))
}

/// Store a verification (V1 contract)
async fn store_verification(
    backend: &Account,
    contract: &Contract,
    user: &Account,
    sumsub_applicant_id: &str,
) -> anyhow::Result<()> {
    let nonce: [u8; 32] = rand::random();
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();
    let (signature, public_key) = generate_nep413_signature(user, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": sumsub_applicant_id,
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient
            },
            "user_context_data": "context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify verification stored successfully", || {
        assert!(
            result.is_success(),
            "Verification failed: {:?}",
            result.failures()
        );
    });

    Ok(())
}

/// Store a verification against V2 contract
async fn store_verification_v2(
    backend: &Account,
    contract: &Contract,
    user: &Account,
    sumsub_applicant_id: &str,
) -> anyhow::Result<()> {
    let nonce: [u8; 32] = rand::random();
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();
    let (signature, public_key) = generate_nep413_signature(user, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": sumsub_applicant_id,
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient
            },
            "user_context_data": "context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify verification stored successfully (V2)", || {
        assert!(
            result.is_success(),
            "Verification failed: {:?}",
            result.failures()
        );
    });

    Ok(())
}

// ==================== Cross-Version Upgrade Tests ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("critical")]
#[allure_tags("integration", "versioning", "upgrade", "v1-to-v2")]
#[allure_description(
    "Critical upgrade test: Deploy V1, store data, upgrade to V2, verify data persists. \
     This tests the core contract state versioning mechanism."
)]
#[allure_test]
#[tokio::test]
async fn test_upgrade_v1_to_v2_preserves_verifications() -> anyhow::Result<()> {
    // Step 1: Deploy V1 and store verifications
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    // Deploy V1 to a specific account (not dev_deploy, so we can redeploy)
    let contract_account = worker
        .root_account()?
        .create_subaccount("upgrade-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    assert!(
        deploy_result.details.is_success(),
        "V1 deploy failed: {:?}",
        deploy_result.details.failures()
    );
    let contract = deploy_result.result;

    // Initialize V1
    let init_result = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;
    assert!(
        init_result.is_success(),
        "V1 init failed: {:?}",
        init_result.failures()
    );

    // Store verifications with V1
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user1, "v1_user1_sumsub_id").await?;
    store_verification(&backend, &contract, &user2, "v1_user2_sumsub_id").await?;

    // Verify V1 state
    let v1_count: u32 = contract.view("get_verified_count").await?.json()?;
    let v1_state_version: u8 = contract.view("get_state_version").await?.json()?;

    step("Verify V1 state before upgrade", || {
        assert_eq!(v1_count, 2, "Should have 2 verifications in V1");
        assert_eq!(v1_state_version, 1, "Should be state version 1");
    });

    // Step 2: Upgrade to V2 (redeploy with V2 WASM)
    let v2_wasm = load_v2_wasm();
    let upgrade_result = contract_account.deploy(&v2_wasm).await?;
    assert!(
        upgrade_result.details.is_success(),
        "V2 deploy failed: {:?}",
        upgrade_result.details.failures()
    );

    // Step 3: Verify V1 data is readable with V2 code
    let v2_count: u32 = contract.view("get_verified_count").await?.json()?;

    step("Verify verification count persists after upgrade", || {
        assert_eq!(
            v2_count, 2,
            "Should still have 2 verifications after upgrade"
        );
    });

    // Read user1's verification
    let summary1: Option<VerificationSummary> = contract
        .view("get_verification")
        .args_json(json!({"account_id": user1.id()}))
        .await?
        .json()?;

    step("Verify user1 verification readable after upgrade", || {
        assert!(summary1.is_some());
        let s = summary1.expect("checked");
        assert_eq!(s.sumsub_applicant_id, "v1_user1_sumsub_id");
        assert_eq!(s.near_account_id, *user1.id());
    });

    // Read user2's verification
    let summary2: Option<VerificationSummary> = contract
        .view("get_verification")
        .args_json(json!({"account_id": user2.id()}))
        .await?
        .json()?;

    step("Verify user2 verification readable after upgrade", || {
        assert!(summary2.is_some());
        let s = summary2.expect("checked");
        assert_eq!(s.sumsub_applicant_id, "v1_user2_sumsub_id");
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("critical")]
#[allure_tags("integration", "versioning", "upgrade", "v1-to-v2")]
#[allure_description(
    "Upgrade test: Contract state fields (backend_wallet, paused) persist across upgrade."
)]
#[allure_test]
#[tokio::test]
async fn test_upgrade_preserves_contract_state() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("state-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Modify state in V1: pause the contract
    let _ = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    let v1_paused: bool = contract.view("is_paused").await?.json()?;
    let v1_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify V1 state modifications", || {
        assert!(v1_paused, "Contract should be paused in V1");
        assert_eq!(v1_backend, *backend.id());
    });

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Verify state persists
    let v2_paused: bool = contract.view("is_paused").await?.json()?;
    let v2_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify paused state persists after upgrade", || {
        assert!(v2_paused, "Contract should still be paused after upgrade");
    });

    step("Verify backend_wallet persists after upgrade", || {
        assert_eq!(v2_backend, *backend.id());
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("critical")]
#[allure_tags("integration", "versioning", "upgrade", "sumsub-applicant")]
#[allure_description(
    "Upgrade test: SumSub applicant ID protection persists across V1 to V2 upgrade."
)]
#[allure_test]
#[tokio::test]
async fn test_upgrade_sumsub_applicant_id_protection_persists() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("sumsub-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store verification with V1
    let user1 = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user1, "protected_sumsub_id").await?;

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Try to reuse SumSub applicant ID with V2 code - should fail
    let user2 = worker.dev_create_account().await?;
    let nonce: [u8; 32] = rand::random();
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();
    let (signature, public_key) = generate_nep413_signature(&user2, challenge, &nonce, &recipient);

    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": "protected_sumsub_id",
            "near_account_id": user2.id(),
            "signature_data": {
                "account_id": user2.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient
            },
            "user_context_data": "context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step(
        "Verify SumSub applicant ID protection persists after upgrade",
        || {
            assert!(result.is_failure());
            let failure_msg = format!("{:?}", result.failures());
            assert!(
                failure_msg.contains("SumSub applicant ID already used"),
                "Expected SumSub applicant ID error, got: {}",
                failure_msg
            );
        },
    );

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("critical")]
#[allure_tags("integration", "versioning", "upgrade", "account-uniqueness")]
#[allure_description("Upgrade test: Account uniqueness persists across upgrade.")]
#[allure_test]
#[tokio::test]
async fn test_upgrade_account_uniqueness_persists() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("sig-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store verification with specific signature in V1
    let user = worker.dev_create_account().await?;
    let nonce: [u8; 32] = [42u8; 32]; // Fixed nonce for repeat attempt
    let challenge = "Identify myself";
    let recipient = contract.id().to_string();
    let (signature, public_key) = generate_nep413_signature(&user, challenge, &nonce, &recipient);

    let _ = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": "sig_test_sumsub_id",
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature.clone(),
                "public_key": public_key.clone(),
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient.clone()
            },
            "user_context_data": "context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Try to store a second verification for the same account - should fail
    let result = backend
        .call(contract.id(), "store_verification")
        .deposit(NearToken::from_yoctonear(1))
        .args_json(json!({
            "sumsub_applicant_id": "different_sumsub_id",
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient
            },
            "user_context_data": "context"
        }))
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;

    step("Verify account uniqueness persists after upgrade", || {
        assert!(result.is_failure());
        let failure_msg = format!("{:?}", result.failures());
        assert!(
            failure_msg.contains("NEAR account already verified"),
            "Expected account uniqueness error, got: {}",
            failure_msg
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("high")]
#[allure_tags("integration", "versioning", "upgrade", "new-verifications")]
#[allure_description(
    "Upgrade test: After redeploying contract code, new verifications work correctly."
)]
#[allure_test]
#[tokio::test]
async fn test_upgrade_new_verifications_work() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("new-ver-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store one verification with V1
    let user1 = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user1, "v1_verification_sumsub_id").await?;

    // Upgrade to V2 (redeploy new code)
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Store new verification after upgrade
    let user2 = worker.dev_create_account().await?;
    store_verification_v2(&backend, &contract, &user2, "v2_verification_sumsub_id").await?;

    // Verify counts
    let count: u32 = contract.view("get_verified_count").await?.json()?;

    step("Verify new verifications work after upgrade", || {
        assert_eq!(
            count, 2,
            "Should have both pre and post-upgrade verifications"
        );
    });

    // Verify state version is now 2 (ContractV2 has upgrade_timestamp)
    let state_version: u8 = contract.view("get_state_version").await?.json()?;

    step("Verify state version is V2 after upgrade", || {
        assert_eq!(
            state_version, 2,
            "Should report state version 2 after upgrade to V2"
        );
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("normal")]
#[allure_tags("integration", "versioning", "upgrade", "batch")]
#[allure_description("Upgrade test: Batch queries work correctly after upgrade.")]
#[allure_test]
#[tokio::test]
async fn test_upgrade_batch_queries_work() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("batch-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store verifications with V1
    let user1 = worker.dev_create_account().await?;
    let user2 = worker.dev_create_account().await?;
    let user3 = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user1, "batch_v1_sumsub_1").await?;
    store_verification(&backend, &contract, &user2, "batch_v1_sumsub_2").await?;
    // user3 not verified

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Test batch queries after upgrade
    let verification_status: Vec<bool> = contract
        .view("are_verified")
        .args_json(json!({
            "account_ids": [user1.id(), user2.id(), user3.id()]
        }))
        .await?
        .json()?;

    step("Verify are_verified batch works after upgrade", || {
        assert_eq!(verification_status.len(), 3);
        assert_eq!(verification_status.first().copied(), Some(true));
        assert_eq!(verification_status.get(1).copied(), Some(true));
        assert_eq!(verification_status.get(2).copied(), Some(false));
    });

    let verifications: Vec<Option<VerificationSummary>> = contract
        .view("get_verifications")
        .args_json(json!({
            "account_ids": [user1.id(), user2.id(), user3.id()]
        }))
        .await?
        .json()?;

    step("Verify get_verifications batch works after upgrade", || {
        assert_eq!(verifications.len(), 3);
        assert!(verifications.first().and_then(|v| v.as_ref()).is_some());
        assert!(verifications.get(1).and_then(|v| v.as_ref()).is_some());
        assert!(verifications.get(2).and_then(|v| v.as_ref()).is_none());
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("normal")]
#[allure_tags("integration", "versioning", "upgrade", "pagination")]
#[allure_description("Upgrade test: Pagination works correctly after upgrade.")]
#[allure_test]
#[tokio::test]
async fn test_upgrade_pagination_works() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("page-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store 5 verifications with V1
    for i in 0..5 {
        let user = worker.dev_create_account().await?;
        store_verification(&backend, &contract, &user, &format!("page_v1_sumsub_{}", i)).await?;
    }

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Test pagination after upgrade
    let first_page: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 0u32, "limit": 3u32}))
        .await?
        .json()?;

    step("Verify first page after upgrade", || {
        assert_eq!(first_page.len(), 3);
    });

    let second_page: Vec<serde_json::Value> = contract
        .view("list_verifications")
        .args_json(json!({"from_index": 3u32, "limit": 3u32}))
        .await?
        .json()?;

    step("Verify second page after upgrade", || {
        assert_eq!(second_page.len(), 2);
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("normal")]
#[allure_tags("integration", "versioning", "upgrade", "full-verification")]
#[allure_description("Upgrade test: Full verification data readable after upgrade.")]
#[allure_test]
#[tokio::test]
async fn test_upgrade_full_verification_readable() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("full-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    let user = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user, "full_v1_sumsub_id").await?;

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Get full verification after upgrade
    let full: Option<serde_json::Value> = contract
        .view("get_full_verification")
        .args_json(json!({"account_id": user.id()}))
        .await?
        .json()?;

    step("Verify full verification readable after upgrade", || {
        assert!(full.is_some());
        let v = full.expect("checked");
        assert_eq!(
            v.get("sumsub_applicant_id").and_then(|v| v.as_str()),
            Some("full_v1_sumsub_id")
        );
        assert!(v.get("user_context_data").is_some());
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("normal")]
#[allure_tags("integration", "versioning", "upgrade", "admin")]
#[allure_description("Upgrade test: Admin functions work correctly after upgrade.")]
#[allure_test]
#[tokio::test]
async fn test_upgrade_admin_functions_work() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("admin-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Test admin functions after upgrade
    let pause_result = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify pause works after upgrade", || {
        assert!(
            pause_result.is_success(),
            "Pause failed: {:?}",
            pause_result.failures()
        );
    });

    let is_paused: bool = contract.view("is_paused").await?.json()?;
    assert!(is_paused);

    let unpause_result = backend
        .call(contract.id(), "unpause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify unpause works after upgrade", || {
        assert!(
            unpause_result.is_success(),
            "Unpause failed: {:?}",
            unpause_result.failures()
        );
    });

    // Update backend wallet
    let new_backend = worker.dev_create_account().await?;
    let update_result = backend
        .call(contract.id(), "update_backend_wallet")
        .args_json(json!({"new_backend_wallet": new_backend.id()}))
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    step("Verify backend wallet update works after upgrade", || {
        assert!(
            update_result.is_success(),
            "Update failed: {:?}",
            update_result.failures()
        );
    });

    let current_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;
    assert_eq!(current_backend, *new_backend.id());

    Ok(())
}

// NOTE: The nationality_disclosed test was removed during SumSub migration.
// The V2 fixture no longer includes this feature as it was specific to Self.xyz.

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("critical")]
#[allure_tags("integration", "versioning", "upgrade", "v2-feature", "contract-state")]
#[allure_description(
    "Upgrade test: V2-specific get_upgrade_timestamp method works after upgrade. \
     ContractV2 records the timestamp when V1 state was migrated."
)]
#[allure_test]
#[tokio::test]
async fn test_upgrade_v2_contract_upgrade_timestamp() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("upgrade-ts-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store verification with V1
    let user = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user, "upgrade_ts_sumsub_id").await?;

    // Verify V1 state before upgrade
    let v1_state_version: u8 = contract.view("get_state_version").await?.json()?;
    step("Verify V1 state version before upgrade", || {
        assert_eq!(v1_state_version, 1, "Should be state version 1");
    });

    // Record approximate time before upgrade
    let before_upgrade = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);

    // Upgrade to V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Record approximate time after upgrade
    let after_upgrade = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(u64::MAX);

    // Trigger state migration by calling a mutable method (view methods can't mutate)
    // pause() and unpause() to trigger lazy migration without side effects
    let _ = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;
    let _ = backend
        .call(contract.id(), "unpause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    // Call V2-only method: get_upgrade_timestamp
    // ContractV2 records the migration timestamp when V1 state was first written
    let upgrade_timestamp: Option<u64> = contract.view("get_upgrade_timestamp").await?.json()?;

    step("Verify upgrade_timestamp is set after migration", || {
        assert!(
            upgrade_timestamp.is_some(),
            "Upgrade timestamp should be set after V1 → V2 migration"
        );
        let ts = upgrade_timestamp.expect("checked above");
        // The timestamp should be roughly around the time we upgraded
        // Allow a generous window since sandbox timing may vary
        assert!(
            ts >= before_upgrade.saturating_sub(60_000_000_000), // 60s before
            "Timestamp {} should be >= {} (before upgrade)",
            ts,
            before_upgrade
        );
        assert!(
            ts <= after_upgrade.saturating_add(60_000_000_000), // 60s after
            "Timestamp {} should be <= {} (after upgrade)",
            ts,
            after_upgrade
        );
    });

    // Verify state version is now 2
    let v2_state_version: u8 = contract.view("get_state_version").await?.json()?;
    step(
        "Verify contract reports V2 state version after upgrade",
        || {
            assert_eq!(
                v2_state_version, 2,
                "Should be state version 2 after upgrade"
            );
        },
    );

    Ok(())
}

// ==================== Migrate Function Tests ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("critical")]
#[allure_tags("integration", "versioning", "migrate", "v1-to-v2")]
#[allure_description(
    "Migrate function test: Explicitly call migrate() after upgrading to V2. \
     This tests the #[init(ignore_state)] + #[private] migration pattern. \
     The migrate() function should read the existing V1 state and return it (no transformation in current version)."
)]
#[allure_test]
#[tokio::test]
async fn test_migrate_function_explicit_call() -> anyhow::Result<()> {
    // Step 1: Deploy V1 and store verifications
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("migrate-fn-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    assert!(
        deploy_result.details.is_success(),
        "V1 deploy failed: {:?}",
        deploy_result.details.failures()
    );
    let contract = deploy_result.result;

    // Initialize V1
    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Store verification with V1
    let user = worker.dev_create_account().await?;
    store_verification(&backend, &contract, &user, "migrate_fn_test_sumsub_id").await?;

    // Pause the contract to test state preservation
    let _ = backend
        .call(contract.id(), "pause")
        .deposit(NearToken::from_yoctonear(1))
        .transact()
        .await?;

    // Verify V1 state
    let v1_state_version: u8 = contract.view("get_state_version").await?.json()?;
    let v1_paused: bool = contract.view("is_paused").await?.json()?;
    let v1_count: u32 = contract.view("get_verified_count").await?.json()?;

    step("Verify V1 state before migrate", || {
        assert_eq!(v1_state_version, 1, "Should be state version 1");
        assert!(v1_paused, "Contract should be paused");
        assert_eq!(v1_count, 1, "Should have 1 verification");
    });

    // Step 2: Deploy V2 and call migrate()
    let v2_wasm = load_v2_wasm();
    let upgrade_result = contract_account.deploy(&v2_wasm).await?;
    assert!(
        upgrade_result.details.is_success(),
        "V2 deploy failed: {:?}",
        upgrade_result.details.failures()
    );

    // Call migrate() - must be called by contract account itself (#[private])
    // This simulates `near deploy ... --initFunction migrate`
    let migrate_result = contract_account
        .call(contract.id(), "migrate")
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    step("Verify migrate() succeeds", || {
        assert!(
            migrate_result.is_success(),
            "migrate() failed: {:?}",
            migrate_result.failures()
        );
    });

    // Step 3: Verify state is preserved after migrate
    let v2_count: u32 = contract.view("get_verified_count").await?.json()?;
    let v2_paused: bool = contract.view("is_paused").await?.json()?;
    let v2_backend: AccountId = contract.view("get_backend_wallet").await?.json()?;

    step("Verify state preserved after migrate", || {
        assert_eq!(v2_count, 1, "Should still have 1 verification");
        assert!(v2_paused, "Contract should still be paused");
        assert_eq!(
            v2_backend,
            *backend.id(),
            "backend_wallet should be preserved"
        );
    });

    // Verify verification data is accessible
    let summary: Option<VerificationSummary> = contract
        .view("get_verification")
        .args_json(json!({"account_id": user.id()}))
        .await?
        .json()?;

    step("Verify verification data accessible after migrate", || {
        assert!(summary.is_some(), "Verification should be retrievable");
        let s = summary.expect("checked");
        assert_eq!(s.sumsub_applicant_id, "migrate_fn_test_sumsub_id");
        assert_eq!(s.near_account_id, *user.id());
    });

    Ok(())
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Integration Tests")]
#[allure_sub_suite("Versioning")]
#[allure_severity("normal")]
#[allure_tags("integration", "versioning", "migrate", "error")]
#[allure_description(
    "Migrate function test: migrate() should fail if called by non-contract account. \
     The #[private] attribute ensures only the contract account can call migrate()."
)]
#[allure_test]
#[tokio::test]
async fn test_migrate_fails_when_called_by_non_contract_account() -> anyhow::Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let v1_wasm = load_v1_wasm();
    let backend = worker.dev_create_account().await?;

    let contract_account = worker
        .root_account()?
        .create_subaccount("migrate-auth-test")
        .initial_balance(NearToken::from_near(50))
        .transact()
        .await?
        .result;

    let deploy_result = contract_account.deploy(&v1_wasm).await?;
    let contract = deploy_result.result;

    let _ = contract
        .call("new")
        .args_json(json!({ "backend_wallet": backend.id() }))
        .transact()
        .await?;

    // Deploy V2
    let v2_wasm = load_v2_wasm();
    let _ = contract_account.deploy(&v2_wasm).await?;

    // Try to call migrate() from backend account (not contract account) - should fail
    let result = backend
        .call(contract.id(), "migrate")
        .gas(Gas::from_tgas(50))
        .transact()
        .await?;

    step(
        "Verify migrate() fails when called by non-contract account",
        || {
            assert!(
                result.is_failure(),
                "migrate() should fail when called by non-contract account"
            );
            let failure_msg = format!("{:?}", result.failures());
            // #[private] methods fail with "Method migrate is private"
            assert!(
                failure_msg.contains("private") || failure_msg.contains("Predecessor"),
                "Error should mention private/predecessor, got: {}",
                failure_msg
            );
        },
    );

    Ok(())
}
