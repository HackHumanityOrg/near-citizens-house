//! Shared unit test helpers

use governance::{Config, PendingVote, VersionedContract, VoteChoice};
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::{env, testing_env, AccountId, NearToken, PromiseResult, RuntimeFeesConfig};
use std::panic::{catch_unwind, AssertUnwindSafe};

pub const DEFAULT_QUORUM_BPS: u16 = 700;

pub fn default_admin() -> AccountId {
    accounts(0)
}

pub fn verified_accounts_contract() -> AccountId {
    accounts(1)
}

pub fn build_context(predecessor: AccountId) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder.current_account_id(accounts(0));
    builder.predecessor_account_id(predecessor);
    builder.account_balance(NearToken::from_near(1000));
    builder.attached_deposit(NearToken::from_yoctonear(0));
    builder.block_timestamp(1_700_000_000_000_000_000);
    builder.storage_usage(0);
    builder
}

pub fn set_context(builder: VMContextBuilder) {
    let storage_usage = std::panic::catch_unwind(env::storage_usage).unwrap_or(0);
    let mut builder = builder;
    builder.storage_usage(storage_usage);
    testing_env!(builder.build());
}

pub fn set_context_with_promise_results(
    mut builder: VMContextBuilder,
    promise_results: Vec<PromiseResult>,
) {
    // Preserve storage usage when swapping contexts to avoid mocked runtime errors.
    builder.storage_usage(env::storage_usage());
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        promise_results
    );
}

pub fn reset_context() {
    let mut builder = VMContextBuilder::new();
    builder.current_account_id(accounts(0));
    builder.predecessor_account_id(accounts(0));
    builder.account_balance(NearToken::from_near(10));
    builder.attached_deposit(NearToken::from_yoctonear(0));
    builder.block_timestamp(1_700_000_000_000_000_000);
    let storage_usage = std::panic::catch_unwind(env::storage_usage).unwrap_or(0);
    builder.storage_usage(storage_usage);
    testing_env!(builder.build());
}

pub fn default_config() -> Config {
    Config {
        verified_accounts_contract: verified_accounts_contract(),
        quorum_bps: DEFAULT_QUORUM_BPS,
        voting_period_secs: 60,
        pending_expiry_secs: 10,
        min_proposal_bond: NearToken::from_near(1),
        finalize_grace_period_secs: 10,
        max_start_delay_secs: 60,
    }
}

pub fn new_contract() -> VersionedContract {
    let admin = default_admin();
    let builder = build_context(admin.clone());
    set_context(builder);
    VersionedContract::new(
        verified_accounts_contract(),
        vec![admin],
        DEFAULT_QUORUM_BPS,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    )
}

pub fn create_basic_proposal(contract: &mut VersionedContract, creator: AccountId) -> u32 {
    let mut builder = build_context(creator);
    builder.attached_deposit(NearToken::from_near(1));
    set_context(builder);
    contract.create_proposal("title".to_string(), "author".to_string(), "desc".to_string(), None)
}

pub fn activate_proposal(contract: &mut VersionedContract, proposal_id: u32, verified_count: u32) {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, vec![PromiseResult::Successful(vec![])]);
    contract.on_snapshot(Ok(verified_count), proposal_id);
}

pub fn insert_pending_vote(
    contract: &mut VersionedContract,
    proposal_id: u32,
    voter: AccountId,
    choice: VoteChoice,
    submitted_at: u64,
    voter_deposit: NearToken,
) {
    let VersionedContract::V1(ref mut c) = contract;
    c.pending_votes.set(
        (proposal_id, voter),
        Some(PendingVote {
            submitted_at,
            choice,
            voter_deposit,
        }),
    );
    let proposal = c.proposals.get_mut(proposal_id).unwrap();
    proposal.pending_vote_count += 1;
    c.pending_votes.flush();
    c.proposals.flush();
}

pub fn verify_vote(
    contract: &mut VersionedContract,
    proposal_id: u32,
    voter: AccountId,
    verified_at: u64,
) {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, vec![PromiseResult::Successful(vec![])]);
    contract.on_vote_verification(
        Ok(Some(governance::VerificationSummary {
            near_account_id: voter.clone(),
            verified_at,
        })),
        proposal_id,
        voter,
    );
}

pub fn with_deposit(builder: &mut VMContextBuilder, yocto: u128) {
    builder.attached_deposit(NearToken::from_yoctonear(yocto));
}

pub fn with_block_timestamp(builder: &mut VMContextBuilder, ts: u64) {
    builder.block_timestamp(ts);
}

pub fn with_storage_usage(builder: &mut VMContextBuilder, usage: u64) {
    builder.storage_usage(usage);
}

pub fn assert_panics_with<F>(f: F, expected: &str)
where
    F: FnOnce(),
{
    let result = catch_unwind(AssertUnwindSafe(f));
    // Reset environment to avoid mocked blockchain inconsistencies after panics.
    reset_context();
    assert!(result.is_err(), "Expected panic but function succeeded");
    let msg = match result.err().unwrap() {
        // String panic
        err if err.downcast_ref::<String>().is_some() => {
            err.downcast_ref::<String>().unwrap().clone()
        }
        // &str panic
        err if err.downcast_ref::<&str>().is_some() => {
            err.downcast_ref::<&str>().unwrap().to_string()
        }
        _ => "<non-string panic>".to_string(),
    };
    assert!(
        msg.contains(expected),
        "Expected panic containing '{}', got '{}'",
        expected,
        msg
    );
}
