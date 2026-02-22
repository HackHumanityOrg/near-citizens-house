use allure_rs::prelude::*;
use governance::{FailureKind, PendingVote, VerificationSummary, VersionedContract, VoteChoice};
use near_sdk::test_utils::accounts;
use near_sdk::{json_types::U64, Gas, NearToken, PromiseResult};

use crate::helpers::{
    assert_panics_with, build_context, new_contract, set_context_with_promise_results,
    with_block_timestamp, with_deposit,
};

fn create_basic_proposal(contract: &mut VersionedContract, creator: usize) -> u32 {
    let mut builder = build_context(accounts(creator));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(
        "title".to_string(),
        "author".to_string(),
        "desc".to_string(),
        None,
    )
}

fn activate_proposal(contract: &mut VersionedContract, proposal_id: u32, verified_count: u32) {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, vec![PromiseResult::Successful(vec![])]);
    contract.on_snapshot(Ok(verified_count), proposal_id);
}

fn insert_pending_vote(
    contract: &mut VersionedContract,
    proposal_id: u32,
    voter: usize,
    choice: VoteChoice,
    submitted_at: u64,
) {
    let VersionedContract::V1(ref mut c) = contract;
    c.pending_votes.set(
        (proposal_id, accounts(voter)),
        Some(PendingVote {
            submitted_at,
            choice,
            voter_deposit: NearToken::from_yoctonear(0),
        }),
    );
    let proposal = c.proposals.get_mut(proposal_id).unwrap();
    proposal.pending_vote_count = proposal.pending_vote_count.saturating_add(1);
    c.pending_votes.flush();
    c.proposals.flush();
}

fn verify_vote(contract: &mut VersionedContract, proposal_id: u32, voter: usize, verified_at: u64) {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, vec![PromiseResult::Successful(vec![])]);
    contract.on_vote_verification(
        Ok(Some(VerificationSummary {
            near_account_id: accounts(voter),
            verified_at,
        })),
        proposal_id,
        accounts(voter),
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 000 create proposal non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_prop_000_create_proposal_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(2));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 000b create proposal requires sufficient prepaid gas.")]
#[allure_test]
fn ut_prop_000b_create_proposal_requires_sufficient_prepaid_gas() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    builder.prepaid_gas(Gas::from_tgas(79));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || {
            contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
        },
        "ERR_INSUFFICIENT_PREPAID_GAS",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 001 title empty.")]
#[should_panic(expected = "ERR_TITLE_EMPTY")]
#[allure_test]
fn ut_prop_001_title_empty() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 001 author empty.")]
#[should_panic(expected = "ERR_AUTHOR_EMPTY")]
#[allure_test]
fn ut_prop_001_author_empty() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 001 description empty.")]
#[should_panic(expected = "ERR_DESCRIPTION_EMPTY")]
#[allure_test]
fn ut_prop_001_description_empty() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 002 length boundaries.")]
#[allure_test]
fn ut_prop_002_length_boundaries() {
    let mut contract = new_contract();
    let title = "t".repeat(140);
    let author = "a".repeat(120);
    let desc = "d".repeat(10_000);

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(title, author, desc, None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 002 title too long.")]
#[should_panic(expected = "ERR_TITLE_TOO_LONG")]
#[allure_test]
fn ut_prop_002_title_too_long() {
    let mut contract = new_contract();
    let title = "t".repeat(141);
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(title, "a".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 002 author too long.")]
#[should_panic(expected = "ERR_AUTHOR_TOO_LONG")]
#[allure_test]
fn ut_prop_002_author_too_long() {
    let mut contract = new_contract();
    let author = "a".repeat(121);
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), author, "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 002 description too long.")]
#[should_panic(expected = "ERR_DESCRIPTION_TOO_LONG")]
#[allure_test]
fn ut_prop_002_description_too_long() {
    let mut contract = new_contract();
    let desc = "d".repeat(10_001);
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), desc, None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 002b utf8 byte length boundary.")]
#[allure_test]
fn ut_prop_002b_utf8_byte_length_boundary() {
    let mut contract = new_contract();
    let title_ok = "😀".repeat(35); // 35 * 4 bytes = 140 bytes
    let title_too_long = "😀".repeat(36); // 144 bytes
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(title_ok, "a".to_string(), "d".to_string(), None);

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || {
            contract.create_proposal(title_too_long, "a".to_string(), "d".to_string(), None);
        },
        "ERR_TITLE_TOO_LONG",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 003 insufficient bond.")]
#[should_panic(expected = "ERR_INSUFFICIENT_BOND")]
#[allure_test]
fn ut_prop_003_insufficient_bond() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_yoctonear(
        NearToken::from_millinear(10).as_yoctonear() - 1,
    ));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 003b bond above min.")]
#[allure_test]
fn ut_prop_003b_bond_above_min() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_near(2));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 004 blocklist op pending.")]
#[should_panic(expected = "ERR_BLOCKLIST_OP_PENDING")]
#[allure_test]
fn ut_prop_004_blocklist_op_pending() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 005 start at boundaries.")]
#[allure_test]
fn ut_prop_005_start_at_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, 1_700_000_000_000_000_000);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(1_700_000_000_000_000_000)),
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 005 start at before created.")]
#[should_panic(expected = "ERR_START_AT_BEFORE_CREATED")]
#[allure_test]
fn ut_prop_005_start_at_before_created() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, 1_700_000_000_000_000_000);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(1_699_999_999_999_999_999)),
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 005 start at too far.")]
#[should_panic(expected = "ERR_START_AT_TOO_FAR")]
#[allure_test]
fn ut_prop_005_start_at_too_far() {
    let mut contract = new_contract();
    let created_at = 1_700_000_000_000_000_000u64;
    let max_start = created_at + 60 * 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, created_at);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(max_start + 1)),
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 005b start at at max boundary.")]
#[allure_test]
fn ut_prop_005b_start_at_at_max_boundary() {
    let mut contract = new_contract();
    let created_at = 1_700_000_000_000_000_000u64;
    let max_start = created_at + 60 * 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, created_at);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let id = contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(max_start)),
    );
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.start_at.0, max_start);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 006 created start ends.")]
#[allure_test]
fn ut_prop_006_created_start_ends() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let id = contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.created_at.0, now);
    assert_eq!(proposal.start_at.0, now);
    assert_eq!(proposal.ends_at.0, now + 60 * 1_000_000_000);
    assert_eq!(proposal.pending_expires_at.0, now + 10 * 1_000_000_000);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 006b deferred start ends at from start.")]
#[allure_test]
fn ut_prop_006b_deferred_start_ends_at_from_start() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let start_at = now + 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let id = contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(start_at)),
    );

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.start_at.0, start_at);
    assert_eq!(proposal.ends_at.0, start_at + 60 * 1_000_000_000);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 007 cancel only pending or active.")]
#[allure_test]
fn ut_prop_007_cancel_only_pending_or_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Succeeded;
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.cancel_proposal(id),
        "ERR_PROPOSAL_ALREADY_FINALIZED",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Failed;
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.cancel_proposal(id),
        "ERR_PROPOSAL_ALREADY_FINALIZED",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Cancelled;
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.cancel_proposal(id),
        "ERR_PROPOSAL_ALREADY_CANCELLED",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);

    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 008 expire pending proposal.")]
#[allure_test]
fn ut_prop_008_expire_pending_proposal() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 - 1);
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_EXPIRED",
    );

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0);
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.expire_pending_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::PendingExpired));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 008b expire pending on non pending.")]
#[allure_test]
fn ut_prop_008b_expire_pending_on_non_pending() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_PENDING",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_PENDING",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Succeeded;
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_PENDING",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Failed;
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_PENDING",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 009 finalize status preconditions.")]
#[allure_test]
fn ut_prop_009_finalize_status_preconditions() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");

    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Succeeded;
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Failed;
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 010 finalize timing.")]
#[allure_test]
fn ut_prop_010_finalize_timing() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_FINALIZE_NOT_ENDED");

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 010b finalize by non admin.")]
#[allure_test]
fn ut_prop_010b_finalize_by_non_admin() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(3));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_ne!(proposal.status, governance::ProposalStatus::Active);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 011 finalize blocked by pending votes.")]
#[allure_test]
fn ut_prop_011_finalize_blocked_by_pending_votes() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        2,
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
    );

    let grace = contract.get_config().finalize_grace_period_secs * 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + grace - 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.finalize_proposal(id),
        "ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES",
    );

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + grace);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_ne!(proposal.status, governance::ProposalStatus::Active);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 012 finalize zero snapshot defensive fail.")]
#[allure_test]
fn ut_prop_012_finalize_zero_snapshot_defensive_fail() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Active;
    proposal.snapshot_verified_count = 0;
    let proposal = contract.get_proposal(id).unwrap();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::ZeroSnapshot));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 016 cancel by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_prop_016_cancel_by_non_admin() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(2));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 017 expire pending by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_prop_017_expire_pending_by_non_admin() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(2));
    with_deposit(&mut builder, 1);
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.expire_pending_proposal(id);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 018 cancel without yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_prop_018_cancel_without_yocto() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 019 expire pending without yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_prop_019_expire_pending_without_yocto() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.expire_pending_proposal(id);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 020 proposal ids sequential.")]
#[allure_test]
fn ut_prop_020_proposal_ids_sequential() {
    let mut contract = new_contract();
    let id0 = create_basic_proposal(&mut contract, 0);
    let id1 = create_basic_proposal(&mut contract, 0);
    let id2 = create_basic_proposal(&mut contract, 0);

    assert_eq!(id0, 0);
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(contract.get_proposal_count(), 3);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 021 finalize pending votes zero.")]
#[allure_test]
fn ut_prop_021_finalize_pending_votes_zero() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::QuorumNotMet));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop finalize all no votes.")]
#[allure_test]
fn ut_prop_finalize_all_no_votes() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;

    insert_pending_vote(&mut contract, id, 2, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::Rejected));
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 1);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop double finalize.")]
#[allure_test]
fn ut_prop_double_finalize() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;

    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);

    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 023 start at none defaults.")]
#[allure_test]
fn ut_prop_023_start_at_none_defaults() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let id = contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.start_at.0, now);
    assert_eq!(proposal.ends_at.0, now + 60 * 1_000_000_000);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop whitespace only fields allowed.")]
#[allure_test]
fn ut_prop_whitespace_only_fields_allowed() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let id = contract.create_proposal("   ".to_string(), "  ".to_string(), " ".to_string(), None);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.title, "   ");
    assert_eq!(proposal.author, "  ");
    assert_eq!(proposal.description, " ");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop removed admin cannot cancel.")]
#[allure_test]
fn ut_prop_removed_admin_cannot_cancel() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    let mut contract = VersionedContract::new(
        accounts(1),
        vec![accounts(0), accounts(1)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );

    let id = create_basic_proposal(&mut contract, 0);

    let mut builder = build_context(accounts(1));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(0));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.cancel_proposal(id), "ERR_NOT_ADMIN");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop max config no overflow.")]
#[allure_test]
fn ut_prop_max_config_no_overflow() {
    let max_secs = 7_776_000u64;
    let now = 1_700_000_000_000_000_000u64;

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    crate::helpers::set_context(builder);
    let mut contract = VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        max_secs,
        10,
        NearToken::from_millinear(10),
        10,
        max_secs,
    );

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let start_at = now + max_secs * 1_000_000_000;
    let id = contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(start_at)),
    );

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.start_at.0, start_at);
    assert_eq!(proposal.ends_at.0, start_at + max_secs * 1_000_000_000);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 013b tied votes pass.")]
#[allure_test]
fn ut_prop_013b_tied_votes_pass() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;

    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 3, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 3, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 4, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 4, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 5, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 5, proposal.created_at.0);

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 013 quorum calculation boundaries.")]
#[allure_test]
fn ut_prop_013_quorum_calculation_boundaries() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    // Case 1: snapshot=10, quorum_bps=700 -> quorum_required = ceil(0.7) = 1
    // Below quorum: 0 votes -> QuorumNotMet
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::QuorumNotMet));

    // Case 2: same config, exactly quorum_required with yes >= no -> Succeeded
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);

    // Case 3: snapshot=10, quorum_bps=5000 -> quorum_required = 5
    // Total votes == quorum_required but no > yes -> Rejected
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.quorum_bps = 5_000;
    c.proposals.flush();
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 3, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 3, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 4, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 4, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 5, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 5, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 1, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 1, proposal.created_at.0);

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::Rejected));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 013c quorum ceiling rounds up.")]
#[allure_test]
fn ut_prop_013c_quorum_ceiling_rounds_up() {
    // snapshot=15, quorum_bps=700 -> ceil(1.05)=2
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 15);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;

    // Case 1: below quorum (1 vote) -> QuorumNotMet
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::QuorumNotMet));

    // Case 2: exactly quorum (2 votes) -> Succeeded
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 15);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 3, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 3, proposal.created_at.0);
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 013d quorum exact division.")]
#[allure_test]
fn ut_prop_013d_quorum_exact_division() {
    // snapshot=10, quorum_bps=1000 -> ceil(1.0)=1
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let governance::VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.quorum_bps = 1_000;
    c.proposals.flush();
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 013e barely winning.")]
#[allure_test]
fn ut_prop_013e_barely_winning() {
    // quorum=3, yes=2, no=1 -> Succeeded
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let governance::VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.quorum_bps = 3_000;
    c.proposals.flush();
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 2, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 3, VoteChoice::Yes, submitted_at);
    verify_vote(&mut contract, id, 3, proposal.created_at.0);
    insert_pending_vote(&mut contract, id, 4, VoteChoice::No, submitted_at);
    verify_vote(&mut contract, id, 4, proposal.created_at.0);

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 014 cancel does not clear pending votes.")]
#[allure_test]
fn ut_prop_014_cancel_does_not_clear_pending_votes() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    insert_pending_vote(
        &mut contract,
        id,
        2,
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);

    let VersionedContract::V1(ref c) = contract;
    let key = (id, accounts(2));
    assert!(c.pending_votes.contains_key(&key));
    let proposal = c.proposals.get(id).unwrap();
    assert_eq!(proposal.pending_vote_count, 1);
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 015 pending expiry distinct.")]
#[allure_test]
fn ut_prop_015_pending_expiry_distinct() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    let id = contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.pending_expires_at.0, now + 10 * 1_000_000_000);
    assert_eq!(proposal.ends_at.0, now + 60 * 1_000_000_000);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 015b expire pending before pending expires.")]
#[should_panic(expected = "ERR_PROPOSAL_NOT_EXPIRED")]
#[allure_test]
fn ut_prop_015b_expire_pending_before_pending_expires() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 - 1);
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.expire_pending_proposal(id);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Proposals")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "proposals")]
#[allure_description("Verifies prop 015c expire pending at pending expires.")]
#[allure_test]
fn ut_prop_015c_expire_pending_at_pending_expires() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0);
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.expire_pending_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.failure_kind, Some(FailureKind::PendingExpired));
}
