use allure_rs::prelude::*;
use governance::{
    FailureKind, ProposalStatus, VoteChoice, ESTIMATED_PENDING_VOTE_BYTES, ESTIMATED_VOTE_BYTES};
use near_sdk::test_utils::accounts;
use near_sdk::{env, Gas, NearToken};

use crate::helpers::{
    activate_proposal, assert_panics_with, build_context, create_basic_proposal, insert_pending_vote,
    new_contract, with_block_timestamp};

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 001 rejects non active pending.")]
#[should_panic(expected = "ERR_PROPOSAL_NOT_ACTIVE")]
#[allure_test]
fn ut_vote_001_rejects_non_active_pending() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 001 rejects non active cancelled.")]
#[should_panic(expected = "ERR_PROPOSAL_NOT_ACTIVE")]
#[allure_test]
fn ut_vote_001_rejects_non_active_cancelled() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_yoctonear(1));
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);

    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 001 rejects non active failed.")]
#[should_panic(expected = "ERR_PROPOSAL_NOT_ACTIVE")]
#[allure_test]
fn ut_vote_001_rejects_non_active_failed() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let governance::VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = ProposalStatus::Failed;
    proposal.failure_kind = Some(FailureKind::QuorumNotMet);
    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 001 rejects non active succeeded.")]
#[should_panic(expected = "ERR_PROPOSAL_NOT_ACTIVE")]
#[allure_test]
fn ut_vote_001_rejects_non_active_succeeded() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let governance::VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = ProposalStatus::Succeeded;
    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 001b cast vote requires sufficient prepaid gas.")]
#[allure_test]
fn ut_vote_001b_cast_vote_requires_sufficient_prepaid_gas() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(2));
    with_block_timestamp(&mut builder, proposal.start_at.0 + 1);
    builder.prepaid_gas(Gas::from_tgas(99));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.cast_vote(id, VoteChoice::Yes),
        "ERR_INSUFFICIENT_PREPAID_GAS",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 002 cast vote timing boundaries.")]
#[allure_test]
fn ut_vote_002_cast_vote_timing_boundaries() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(2));
    with_block_timestamp(&mut builder, proposal.start_at.0 - 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.cast_vote(id, VoteChoice::Yes), "ERR_PROPOSAL_NOT_STARTED");

    let mut builder = build_context(accounts(2));
    with_block_timestamp(&mut builder, proposal.start_at.0);
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
    let governance::VersionedContract::V1(ref c) = contract;
    assert!(c.pending_votes.contains_key(&(id, accounts(2))));

    let mut builder = build_context(accounts(3));
    with_block_timestamp(&mut builder, proposal.ends_at.0);
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
    let governance::VersionedContract::V1(ref c) = contract;
    assert!(c.pending_votes.contains_key(&(id, accounts(3))));

    let mut builder = build_context(accounts(4));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.cast_vote(id, VoteChoice::Yes), "ERR_PROPOSAL_ENDED");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 003 blocklisted voter rejected.")]
#[should_panic(expected = "ERR_BLOCKLISTED")]
#[allure_test]
fn ut_vote_003_blocklisted_voter_rejected() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let governance::VersionedContract::V1(ref mut c) = contract;
    c.blocklist.insert(accounts(2));
    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 004 duplicate vote prevention.")]
#[should_panic(expected = "ERR_ALREADY_VOTED")]
#[allure_test]
fn ut_vote_004_duplicate_vote_prevention() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
        NearToken::from_yoctonear(0),
    );
    crate::helpers::verify_vote(&mut contract, id, accounts(2), proposal.created_at.0);

    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 005 duplicate pending vote prevention.")]
#[should_panic(expected = "ERR_VOTE_ALREADY_PENDING")]
#[allure_test]
fn ut_vote_005_duplicate_pending_vote_prevention() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
        NearToken::from_yoctonear(0),
    );

    let builder = build_context(accounts(2));
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 006 deposit required when storage insufficient.")]
#[allure_test]
fn ut_vote_006_deposit_required_when_storage_insufficient() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(2));
    builder.account_balance(NearToken::from_yoctonear(1));
    with_block_timestamp(&mut builder, proposal.start_at.0 + 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.cast_vote(id, VoteChoice::Yes),
        "ERR_INSUFFICIENT_DEPOSIT",
    );

    let mut builder = build_context(accounts(2));
    builder.account_balance(NearToken::from_yoctonear(1));
    builder.attached_deposit(NearToken::from_near(10));
    with_block_timestamp(&mut builder, proposal.start_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.cast_vote(id, VoteChoice::Yes);
    let governance::VersionedContract::V1(ref c) = contract;
    assert!(c.pending_votes.contains_key(&(id, accounts(2))));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 007 is vote free boundaries.")]
#[allure_test]
fn ut_vote_007_is_vote_free_boundaries() {
    let contract = new_contract();
    let storage_cost = env::storage_byte_cost().as_yoctonear()
        * (ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES) as u128;

    let mut builder = build_context(accounts(0));
    builder.account_balance(NearToken::from_yoctonear(storage_cost));
    builder.storage_usage(0);
    near_sdk::testing_env!(builder.build());
    assert!(contract.is_vote_free());

    let mut builder = build_context(accounts(0));
    builder.account_balance(NearToken::from_yoctonear(storage_cost.saturating_sub(1)));
    builder.storage_usage(0);
    near_sdk::testing_env!(builder.build());
    assert!(!contract.is_vote_free());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 007b is vote free changes after storage increase.")]
#[allure_test]
fn ut_vote_007b_is_vote_free_changes_after_storage_increase() {
    let contract = new_contract();
    let storage_cost = env::storage_byte_cost().as_yoctonear()
        * (ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES) as u128;

    let mut builder = build_context(accounts(0));
    builder.account_balance(NearToken::from_yoctonear(storage_cost));
    builder.storage_usage(0);
    near_sdk::testing_env!(builder.build());
    assert!(contract.is_vote_free());

    let mut builder = build_context(accounts(0));
    builder.account_balance(NearToken::from_yoctonear(storage_cost));
    builder.storage_usage(1);
    near_sdk::testing_env!(builder.build());
    assert!(!contract.is_vote_free());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Voting")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "voting")]
#[allure_description("Verifies vote 008 same voter two proposals.")]
#[allure_test]
fn ut_vote_008_same_voter_two_proposals() {
    let mut contract = new_contract();
    let id1 = create_basic_proposal(&mut contract, accounts(0));
    let id2 = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id1, 10);
    activate_proposal(&mut contract, id2, 10);
    let proposal1 = contract.get_proposal(id1).unwrap();
    let proposal2 = contract.get_proposal(id2).unwrap();

    let mut builder = build_context(accounts(2));
    with_block_timestamp(&mut builder, proposal1.start_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.cast_vote(id1, VoteChoice::Yes);

    let mut builder = build_context(accounts(2));
    with_block_timestamp(&mut builder, proposal2.start_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.cast_vote(id2, VoteChoice::Yes);

    let governance::VersionedContract::V1(ref c) = contract;
    assert!(c.pending_votes.contains_key(&(id1, accounts(2))));
    assert!(c.pending_votes.contains_key(&(id2, accounts(2))));
}
