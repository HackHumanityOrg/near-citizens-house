//! Shared integration test helpers for governance

#![allow(dead_code)]

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use borsh::{BorshDeserialize, BorshSerialize};
use near_crypto::SecretKey;
use near_workspaces::network::Sandbox;
use near_workspaces::types::{Gas, NearToken};
use near_workspaces::{Account, Contract, Worker};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;
use tokio::sync::OnceCell;

async fn compile_project_with_features(
    project_path: &str,
    features: &str,
) -> anyhow::Result<Vec<u8>> {
    let project_path = std::fs::canonicalize(project_path)?;
    let manifest_path =
        cargo_near_build::camino::Utf8PathBuf::from_path_buf(project_path.join("Cargo.toml"))
            .map_err(|error_path| {
                anyhow::anyhow!(
                    "Unable to construct UTF-8 path from {}",
                    error_path.display()
                )
            })?;

    let build_opts = cargo_near_build::BuildOpts::builder()
        .no_locked(true)
        .manifest_path(manifest_path)
        .features(features.to_string())
        .build();

    let wasm_path = cargo_near_build::build_with_cli(build_opts).map_err(|e| anyhow::anyhow!(e))?;
    let wasm_path = wasm_path.canonicalize()?;
    Ok(tokio::fs::read(wasm_path).await?)
}

pub const DEFAULT_QUORUM_BPS: u16 = 700;
pub const DEFAULT_VOTING_PERIOD_SECS: u64 = 60; // 1 minute
pub const DEFAULT_PENDING_EXPIRY_SECS: u64 = 10; // 10 seconds
pub const DEFAULT_GRACE_PERIOD_SECS: u64 = 10; // 10 seconds
pub const DEFAULT_MAX_START_DELAY_SECS: u64 = 7_200; // 2 hours
pub const NANOS_PER_SEC: u64 = 1_000_000_000;
pub const GAS_STANDARD: Gas = Gas::from_tgas(100);
pub const GAS_HEAVY: Gas = Gas::from_tgas(200);
pub const STORAGE_PRICE_PER_BYTE: u128 = 10_000_000_000_000_000_000;

static GOVERNANCE_WASM: OnceCell<Vec<u8>> = OnceCell::const_new();
static VERIFIED_WASM: OnceCell<Vec<u8>> = OnceCell::const_new();
static MOCK_VERIFIED_WASM: OnceCell<Vec<u8>> = OnceCell::const_new();

#[derive(BorshSerialize)]
#[borsh(crate = "borsh")]
pub struct Nep413Payload {
    pub message: String,
    pub nonce: [u8; 32],
    pub recipient: String,
    pub callback_url: Option<String>,
}

pub async fn governance_wasm() -> anyhow::Result<Vec<u8>> {
    let wasm = GOVERNANCE_WASM
        .get_or_init(|| async {
            compile_project_with_features(".", "testing")
                .await
                .expect("compile governance wasm with testing")
        })
        .await;
    Ok(wasm.clone())
}

pub async fn verified_accounts_wasm() -> anyhow::Result<Vec<u8>> {
    let wasm = VERIFIED_WASM
        .get_or_init(|| async {
            near_workspaces::compile_project("../verified-accounts")
                .await
                .expect("compile verified-accounts wasm")
        })
        .await;
    Ok(wasm.clone())
}

pub async fn mock_verified_accounts_wasm() -> anyhow::Result<Vec<u8>> {
    let wasm = MOCK_VERIFIED_WASM
        .get_or_init(|| async {
            near_workspaces::compile_project("tests/mocks/mock-verified-accounts")
                .await
                .expect("compile mock verified-accounts wasm")
        })
        .await;
    Ok(wasm.clone())
}

pub async fn init_verified_accounts(
    worker: &Worker<Sandbox>,
) -> anyhow::Result<(Contract, Account)> {
    let wasm = verified_accounts_wasm().await?;
    let backend = worker.dev_create_account().await?;
    let contract = worker.dev_deploy(&wasm).await?;
    let result = contract
        .call("new")
        .gas(GAS_STANDARD)
        .args_json(json!({
            "backend_wallet": backend.id()
        }))
        .gas(GAS_STANDARD)
        .transact()
        .await?;
    assert!(result.is_success(), "verified-accounts init failed");
    Ok((contract, backend))
}

pub async fn init_mock_verified_accounts(
    worker: &Worker<Sandbox>,
    fail_get_verification: bool,
    delay_get_verification: bool,
) -> anyhow::Result<Contract> {
    let wasm = mock_verified_accounts_wasm().await?;
    let contract = worker.dev_deploy(&wasm).await?;
    let result = contract
        .call("new")
        .gas(GAS_STANDARD)
        .args_json(json!({
            "fail_get_verification": fail_get_verification,
            "delay_get_verification": delay_get_verification
        }))
        .gas(GAS_STANDARD)
        .transact()
        .await?;
    assert!(result.is_success(), "mock verified-accounts init failed");
    Ok(contract)
}

pub async fn seed_mock_verified_accounts(
    contract: &Contract,
    accounts: &[Account],
    verified_at: u64,
) -> anyhow::Result<()> {
    for account in accounts {
        let result = contract
            .call("add_verified")
            .gas(GAS_HEAVY)
            .args_json(json!({ "account_id": account.id(), "verified_at": verified_at }))
            .transact()
            .await?;
        assert!(result.is_success());
    }
    Ok(())
}

pub async fn init_governance(
    worker: &Worker<Sandbox>,
    verified_contract: &Contract,
    admin: &Account,
) -> anyhow::Result<Contract> {
    let wasm = governance_wasm().await?;
    let contract = worker.dev_deploy(&wasm).await?;
    let result = contract
        .call("new")
        .gas(GAS_HEAVY)
        .args_json(json!({
            "verified_accounts_contract": verified_contract.id(),
            "admins": vec![admin.id()],
            "quorum_bps": DEFAULT_QUORUM_BPS,
            "voting_period_secs": DEFAULT_VOTING_PERIOD_SECS,
            "pending_expiry_secs": DEFAULT_PENDING_EXPIRY_SECS,
            "min_proposal_bond": NearToken::from_millinear(10).as_yoctonear().to_string(),
            "finalize_grace_period_secs": DEFAULT_GRACE_PERIOD_SECS,
            "max_start_delay_secs": DEFAULT_MAX_START_DELAY_SECS
        }))
        .gas(GAS_HEAVY)
        .transact()
        .await?;
    assert!(result.is_success(), "governance init failed");
    Ok(contract)
}

pub async fn setup_env(
    verified_accounts: usize,
) -> anyhow::Result<(
    Worker<Sandbox>,
    Contract,
    Contract,
    Account,
    Account,
    Vec<Account>,
)> {
    let worker = near_workspaces::sandbox().await?;
    let (verified_contract, backend) = init_verified_accounts(&worker).await?;
    let admin = worker.dev_create_account().await?;
    let governance = init_governance(&worker, &verified_contract, &admin).await?;
    let mut users = Vec::new();
    for _ in 0..verified_accounts {
        users.push(worker.dev_create_account().await?);
    }
    for (i, user) in users.iter().enumerate() {
        #[allow(clippy::cast_possible_truncation)]
        let nonce = [i as u8; 32];
        store_verification(&backend, &verified_contract, user, "Identify myself", nonce).await?;
    }
    Ok((worker, governance, verified_contract, admin, backend, users))
}

pub fn generate_nep413_signature(
    account: &Account,
    message: &str,
    nonce: &[u8; 32],
    recipient: &str,
) -> (String, String) {
    let secret_key =
        SecretKey::from_str(&account.secret_key().to_string()).expect("parse secret key");
    let public_key = secret_key.public_key();
    let public_key_str = public_key.to_string();

    let payload = Nep413Payload {
        message: message.to_string(),
        nonce: *nonce,
        recipient: recipient.to_string(),
        callback_url: None,
    };

    let mut tag_bytes = Vec::new();
    let tag: u32 = 2147484061;
    tag.serialize(&mut tag_bytes).expect("serialize tag");

    let mut payload_bytes = Vec::new();
    payload
        .serialize(&mut payload_bytes)
        .expect("serialize payload");

    let mut data_to_hash = tag_bytes;
    data_to_hash.extend(payload_bytes);
    let hash = Sha256::digest(&data_to_hash);
    let signature = secret_key.sign(&hash);
    let signature_base64 = match signature {
        near_crypto::Signature::ED25519(sig) => BASE64.encode(sig.to_bytes()),
        _ => panic!("Expected ED25519 signature"),
    };

    (signature_base64, public_key_str)
}

pub fn nonce_to_base64(nonce: &[u8; 32]) -> String {
    BASE64.encode(nonce)
}

pub async fn store_verification(
    backend: &Account,
    contract: &Contract,
    user: &Account,
    challenge: &str,
    nonce: [u8; 32],
) -> anyhow::Result<()> {
    let recipient = contract.id().to_string();
    let (signature, public_key) = generate_nep413_signature(user, challenge, &nonce, &recipient);
    let result = backend
        .call(contract.id(), "store_verification")
        .gas(GAS_HEAVY)
        .deposit(NearToken::from_yoctonear(1))
        .gas(GAS_HEAVY)
        .args_json(json!({
            "near_account_id": user.id(),
            "signature_data": {
                "account_id": user.id(),
                "signature": signature,
                "public_key": public_key,
                "challenge": challenge,
                "nonce": nonce_to_base64(&nonce),
                "recipient": recipient,
            },
            "user_context_data": "test"
        }))
        .transact()
        .await?;
    assert!(result.is_success(), "store_verification failed");
    Ok(())
}

pub async fn create_proposal(
    admin: &Account,
    governance: &Contract,
    title: &str,
    start_at: Option<u64>,
    bond: NearToken,
) -> anyhow::Result<u32> {
    let args = match start_at {
        Some(ts) => json!({
            "title": title,
            "author": "author",
            "description": "desc",
            "start_at": ts.to_string()
        }),
        None => json!({
            "title": title,
            "author": "author",
            "description": "desc",
            "start_at": null
        }),
    };
    let result = admin
        .call(governance.id(), "create_proposal")
        .gas(GAS_HEAVY)
        .deposit(bond)
        .gas(GAS_HEAVY)
        .args_json(args)
        .transact()
        .await?;
    Ok(result.json()?)
}

pub async fn get_proposal(
    governance: &Contract,
    proposal_id: u32,
) -> anyhow::Result<governance::ProposalView> {
    Ok(governance
        .view("get_proposal")
        .args_json(json!({ "proposal_id": proposal_id }))
        .await?
        .json()?)
}

pub async fn fast_forward_to_timestamp(
    worker: &Worker<Sandbox>,
    target_ns: u64,
) -> anyhow::Result<()> {
    let mut iterations = 0u32;
    loop {
        let block = worker.view_block().await?;
        if block.timestamp() >= target_ns {
            break;
        }
        let remaining = target_ns.saturating_sub(block.timestamp());
        // Exponential backoff-like stepping: larger jumps when far,
        // progressively smaller as we approach the target to reduce overshoot risk.
        let step = if remaining > 120 * NANOS_PER_SEC {
            64
        } else if remaining > 60 * NANOS_PER_SEC {
            32
        } else if remaining > 30 * NANOS_PER_SEC {
            16
        } else if remaining > 15 * NANOS_PER_SEC {
            8
        } else if remaining > 7 * NANOS_PER_SEC {
            4
        } else if remaining > 3 * NANOS_PER_SEC {
            2
        } else {
            1
        };
        worker.fast_forward(step).await?;
        iterations = iterations.saturating_add(1);
        if iterations > 200_000 {
            anyhow::bail!("fast_forward_to_timestamp exceeded iteration limit");
        }
    }
    Ok(())
}

pub async fn fast_forward_seconds(worker: &Worker<Sandbox>, seconds: u64) -> anyhow::Result<()> {
    let block = worker.view_block().await?;
    let target = block
        .timestamp()
        .saturating_add(seconds.saturating_mul(1_000_000_000));
    fast_forward_to_timestamp(worker, target).await
}

pub fn sum_tokens_burnt(result: &near_workspaces::result::ExecutionFinalResult) -> u128 {
    result
        .outcomes()
        .iter()
        .map(|o| o.tokens_burnt.as_yoctonear())
        .sum()
}

pub fn user(users: &[Account], index: usize) -> &Account {
    users
        .get(index)
        .unwrap_or_else(|| panic!("user index {} missing", index))
}

pub async fn proposal_storage_keys(
    worker: &Worker<Sandbox>,
    governance: &Contract,
    proposal_id: u32,
) -> anyhow::Result<Vec<Vec<u8>>> {
    let state = worker.view_state(governance.id()).await?;
    let mut keys = Vec::new();
    for (key, value) in state.iter() {
        if let Ok(proposal) = governance::Proposal::try_from_slice(value) {
            if proposal.id == proposal_id {
                keys.push(key.clone());
            }
        }
    }
    if keys.is_empty() {
        anyhow::bail!("proposal storage key not found for {}", proposal_id)
    }
    Ok(keys)
}

pub async fn proposal_storage_key(
    worker: &Worker<Sandbox>,
    governance: &Contract,
    proposal_id: u32,
) -> anyhow::Result<Vec<u8>> {
    let mut keys = proposal_storage_keys(worker, governance, proposal_id).await?;
    Ok(keys.remove(0))
}
