use governance::{FailureKind, PendingVote, VerificationSummary, VersionedContract, VoteChoice};
use near_sdk::test_utils::accounts;
use near_sdk::{json_types::U64, NearToken, PromiseResult};

use crate::helpers::{
    assert_panics_with, build_context, new_contract, set_context, set_context_with_promise_results,
    with_block_timestamp, with_deposit,
};

fn create_basic_proposal(contract: &mut VersionedContract, creator: usize) -> u32 {
    let mut builder = build_context(accounts(creator));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("title".to_string(), "author".to_string(), "desc".to_string(), None)
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

fn verify_vote(
    contract: &mut VersionedContract,
    proposal_id: u32,
    voter: usize,
    verified_at: u64,
) {
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
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_prop_000_create_proposal_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(2));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[should_panic(expected = "ERR_TITLE_EMPTY")]
fn ut_prop_001_title_empty() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[should_panic(expected = "ERR_AUTHOR_EMPTY")]
fn ut_prop_001_author_empty() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("t".to_string(), "".to_string(), "d".to_string(), None);
}

#[test]
#[should_panic(expected = "ERR_DESCRIPTION_EMPTY")]
fn ut_prop_001_description_empty() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "".to_string(), None);
}

#[test]
fn ut_prop_002_length_boundaries() {
    let mut contract = new_contract();
    let title = "t".repeat(140);
    let author = "a".repeat(120);
    let desc = "d".repeat(10_000);

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal(title, author, desc, None);
}

#[test]
#[should_panic(expected = "ERR_TITLE_TOO_LONG")]
fn ut_prop_002_title_too_long() {
    let mut contract = new_contract();
    let title = "t".repeat(141);
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal(title, "a".to_string(), "d".to_string(), None);
}

#[test]
#[should_panic(expected = "ERR_AUTHOR_TOO_LONG")]
fn ut_prop_002_author_too_long() {
    let mut contract = new_contract();
    let author = "a".repeat(121);
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("t".to_string(), author, "d".to_string(), None);
}

#[test]
#[should_panic(expected = "ERR_DESCRIPTION_TOO_LONG")]
fn ut_prop_002_description_too_long() {
    let mut contract = new_contract();
    let desc = "d".repeat(10_001);
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), desc, None);
}

#[test]
fn ut_prop_002b_utf8_byte_length_boundary() {
    let mut contract = new_contract();
    let title_ok = "😀".repeat(35); // 35 * 4 bytes = 140 bytes
    let title_too_long = "😀".repeat(36); // 144 bytes
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal(title_ok, "a".to_string(), "d".to_string(), None);

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    assert_panics_with(
        || {
            contract.create_proposal(title_too_long, "a".to_string(), "d".to_string(), None);
        },
        "ERR_TITLE_TOO_LONG",
    );
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_BOND")]
fn ut_prop_003_insufficient_bond() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_yoctonear(NearToken::from_millinear(10).as_yoctonear() - 1));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
fn ut_prop_003b_bond_above_min() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_near(2));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_OP_PENDING")]
fn ut_prop_004_blocklist_op_pending() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);
}

#[test]
fn ut_prop_005_start_at_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, 1_700_000_000_000_000_000);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(1_700_000_000_000_000_000)),
    );
}

#[test]
#[should_panic(expected = "ERR_START_AT_BEFORE_CREATED")]
fn ut_prop_005_start_at_before_created() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, 1_700_000_000_000_000_000);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(1_699_999_999_999_999_999)),
    );
}

#[test]
#[should_panic(expected = "ERR_START_AT_TOO_FAR")]
fn ut_prop_005_start_at_too_far() {
    let mut contract = new_contract();
    let created_at = 1_700_000_000_000_000_000u64;
    let max_start = created_at + 60 * 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, created_at);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(max_start + 1)),
    );
}

#[test]
fn ut_prop_005b_start_at_at_max_boundary() {
    let mut contract = new_contract();
    let created_at = 1_700_000_000_000_000_000u64;
    let max_start = created_at + 60 * 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, created_at);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
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
fn ut_prop_006_created_start_ends() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    let id = contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.created_at.0, now);
    assert_eq!(proposal.start_at.0, now);
    assert_eq!(proposal.ends_at.0, now + 60 * 1_000_000_000);
    assert_eq!(proposal.pending_expires_at.0, now + 10 * 1_000_000_000);
}

#[test]
fn ut_prop_006b_deferred_start_ends_at_from_start() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let start_at = now + 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
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
fn ut_prop_007_cancel_only_pending_or_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Succeeded;
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
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
    set_context(builder);
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
    set_context(builder);
    assert_panics_with(
        || contract.cancel_proposal(id),
        "ERR_PROPOSAL_ALREADY_CANCELLED",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);

    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);
}

#[test]
fn ut_prop_008_expire_pending_proposal() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 - 1);
    with_deposit(&mut builder, 1);
    set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_EXPIRED",
    );

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0);
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.expire_pending_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::PendingExpired));
}

#[test]
fn ut_prop_008b_expire_pending_on_non_pending() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_PENDING",
    );

    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
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
    set_context(builder);
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
    set_context(builder);
    assert_panics_with(
        || contract.expire_pending_proposal(id),
        "ERR_PROPOSAL_NOT_PENDING",
    );
}

#[test]
fn ut_prop_009_finalize_status_preconditions() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let builder = build_context(accounts(0));
    set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");

    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);
    let builder = build_context(accounts(0));
    set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Succeeded;
    let builder = build_context(accounts(0));
    set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");

    let id = create_basic_proposal(&mut contract, 0);
    let VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.status = governance::ProposalStatus::Failed;
    let builder = build_context(accounts(0));
    set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");
}

#[test]
fn ut_prop_010_finalize_timing() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0);
    set_context(builder);
    assert_panics_with(|| contract.finalize_proposal(id), "ERR_FINALIZE_NOT_ENDED");

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    set_context(builder);
    contract.finalize_proposal(id);
}

#[test]
fn ut_prop_010b_finalize_by_non_admin() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(3));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_ne!(proposal.status, governance::ProposalStatus::Active);
}

#[test]
fn ut_prop_011_finalize_blocked_by_pending_votes() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, proposal.start_at.0 + 1);

    let grace = contract.get_config().finalize_grace_period_secs * 1_000_000_000;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + grace - 1);
    set_context(builder);
    assert_panics_with(
        || contract.finalize_proposal(id),
        "ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES",
    );

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + grace);
    set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_ne!(proposal.status, governance::ProposalStatus::Active);
}

#[test]
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
    set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::ZeroSnapshot));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_prop_016_cancel_by_non_admin() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let mut builder = build_context(accounts(2));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_prop_017_expire_pending_by_non_admin() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(2));
    with_deposit(&mut builder, 1);
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 + 1);
    set_context(builder);
    contract.expire_pending_proposal(id);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_prop_018_cancel_without_yocto() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let builder = build_context(accounts(0));
    set_context(builder);
    contract.cancel_proposal(id);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_prop_019_expire_pending_without_yocto() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 + 1);
    set_context(builder);
    contract.expire_pending_proposal(id);
}

#[test]
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
fn ut_prop_021_finalize_pending_votes_zero() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::QuorumNotMet));
}

#[test]
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
    set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::Rejected));
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 1);
}

#[test]
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
    set_context(builder);
    contract.finalize_proposal(id);

    assert_panics_with(|| contract.finalize_proposal(id), "ERR_PROPOSAL_NOT_ACTIVE");
}

#[test]
fn ut_prop_023_start_at_none_defaults() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    let id = contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.start_at.0, now);
    assert_eq!(proposal.ends_at.0, now + 60 * 1_000_000_000);
}

#[test]
fn ut_prop_whitespace_only_fields_allowed() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    let id = contract.create_proposal(
        "   ".to_string(),
        "  ".to_string(),
        " ".to_string(),
        None,
    );
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.title, "   ");
    assert_eq!(proposal.author, "  ");
    assert_eq!(proposal.description, " ");
}

#[test]
fn ut_prop_removed_admin_cannot_cancel() {
    let builder = build_context(accounts(0));
    set_context(builder);
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
    set_context(builder);
    contract.remove_admin(accounts(0));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    assert_panics_with(|| contract.cancel_proposal(id), "ERR_NOT_ADMIN");
}

#[test]
fn ut_prop_max_config_no_overflow() {
    let max_secs = 7_776_000u64;
    let now = 1_700_000_000_000_000_000u64;

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    set_context(builder);
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
    set_context(builder);
    let start_at = now + max_secs * 1_000_000_000;
    let id = contract.create_proposal(
        "t".to_string(),
        "a".to_string(),
        "d".to_string(),
        Some(U64(start_at)),
    );

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.start_at.0, start_at);
    assert_eq!(
        proposal.ends_at.0,
        start_at + max_secs * 1_000_000_000
    );
}

#[test]
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
    set_context(builder);
    contract.finalize_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
fn ut_prop_013_quorum_calculation_boundaries() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    // Case 1: snapshot=10, quorum_bps=700 -> quorum_required = ceil(0.7) = 1
    // Below quorum: 0 votes -> QuorumNotMet
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    set_context(builder);
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
    set_context(builder);
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
    set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::Rejected));
}

#[test]
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
    set_context(builder);
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
    set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
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
    set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
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
    set_context(builder);
    contract.finalize_proposal(id);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, governance::ProposalStatus::Succeeded);
}

#[test]
fn ut_prop_014_cancel_does_not_clear_pending_votes() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    insert_pending_vote(&mut contract, id, 2, VoteChoice::Yes, proposal.start_at.0 + 1);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);

    let VersionedContract::V1(ref c) = contract;
    let key = (id, accounts(2));
    assert!(c.pending_votes.contains_key(&key));
    let proposal = c.proposals.get(id).unwrap();
    assert_eq!(proposal.pending_vote_count, 1);
    assert_eq!(proposal.status, governance::ProposalStatus::Cancelled);
}

#[test]
fn ut_prop_015_pending_expiry_distinct() {
    let mut contract = new_contract();
    let now = 1_700_000_000_000_000_000u64;
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, now);
    builder.attached_deposit(NearToken::from_millinear(10));
    set_context(builder);
    let id = contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.pending_expires_at.0, now + 10 * 1_000_000_000);
    assert_eq!(proposal.ends_at.0, now + 60 * 1_000_000_000);
}

#[test]
#[should_panic(expected = "ERR_PROPOSAL_NOT_EXPIRED")]
fn ut_prop_015b_expire_pending_before_pending_expires() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0 - 1);
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.expire_pending_proposal(id);
}

#[test]
fn ut_prop_015c_expire_pending_at_pending_expires() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, 0);
    let proposal = contract.get_proposal(id).unwrap();

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0);
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.expire_pending_proposal(id);

    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.failure_kind, Some(FailureKind::PendingExpired));
}
