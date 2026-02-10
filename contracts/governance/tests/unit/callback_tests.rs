use governance::{FailureKind, ProposalStatus, VoteChoice};
use near_sdk::test_utils::{accounts, get_created_receipts, get_logs};
use near_sdk::{env, mock::MockAction, NearToken, PromiseError, PromiseResult};
use serde_json::Value;

use crate::helpers::{
    activate_proposal, build_context, create_basic_proposal, insert_pending_vote, new_contract,
    set_context, set_context_with_promise_results, verify_vote, with_block_timestamp, with_deposit,
};

fn call_on_snapshot(
    contract: &mut governance::VersionedContract,
    proposal_id: u32,
    promise_results: Vec<PromiseResult>,
    result: Result<u32, PromiseError>,
) -> bool {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, promise_results);
    contract.on_snapshot(result, proposal_id)
}

fn call_on_vote_verification(
    contract: &mut governance::VersionedContract,
    proposal_id: u32,
    voter: near_sdk::AccountId,
    promise_results: Vec<PromiseResult>,
    result: Result<Option<governance::VerificationSummary>, PromiseError>,
) -> bool {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, promise_results);
    contract.on_vote_verification(result, proposal_id, voter)
}

fn call_on_blocklist_verification(
    contract: &mut governance::VersionedContract,
    account_id: near_sdk::AccountId,
    promise_results: Vec<PromiseResult>,
    result: Result<Option<governance::VerificationSummary>, PromiseError>,
) -> bool {
    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, promise_results);
    contract.on_blocklist_verification(result, account_id)
}

fn extract_event(logs: &[String], event_name: &str) -> Value {
    let entry = logs
        .iter()
        .find(|l| l.contains("\"event\":\"") && l.contains(event_name))
        .expect("event not found");
    let json = entry
        .strip_prefix("EVENT_JSON:")
        .unwrap_or(entry)
        .trim();
    serde_json::from_str(json).expect("invalid event json")
}

#[test]
fn ut_snap_001_on_snapshot_ignores_non_pending() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let _ = call_on_snapshot(
        &mut contract,
        id,
        vec![PromiseResult::Successful(vec![])],
        Ok(10),
    );
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Active);

    let result = call_on_snapshot(
        &mut contract,
        id,
        vec![PromiseResult::Successful(vec![])],
        Ok(10),
    );
    assert!(!result);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Active);
}

#[test]
fn ut_snap_001b_on_snapshot_after_cancelled() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);

    let result = call_on_snapshot(
        &mut contract,
        id,
        vec![PromiseResult::Successful(vec![])],
        Ok(10),
    );
    assert!(!result);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Cancelled);
}

#[test]
fn ut_snap_001c_on_snapshot_missing_proposal() {
    let mut contract = new_contract();
    let result = call_on_snapshot(
        &mut contract,
        999,
        vec![PromiseResult::Successful(vec![])],
        Ok(10),
    );
    assert!(!result);
}

#[test]
fn ut_snap_002_invalid_promise_results_count() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let result = call_on_snapshot(&mut contract, id, vec![], Ok(10));
    assert!(!result);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::SnapshotCallbackFailed));
}

#[test]
fn ut_snap_003_callback_error() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let result = call_on_snapshot(
        &mut contract,
        id,
        vec![PromiseResult::Successful(vec![])],
        Err(PromiseError::Failed),
    );
    assert!(!result);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Failed);
    assert_eq!(proposal.failure_kind, Some(FailureKind::SnapshotCallbackFailed));
}

#[test]
fn ut_snap_004_zero_effective_count() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let result = call_on_snapshot(
        &mut contract,
        id,
        vec![PromiseResult::Successful(vec![])],
        Ok(0),
    );
    assert!(!result);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.failure_kind, Some(FailureKind::ZeroSnapshot));

    let id2 = create_basic_proposal(&mut contract, accounts(0));
    let governance::VersionedContract::V1(ref mut c) = contract;
    c.blocklist.insert(accounts(2));
    let result = call_on_snapshot(
        &mut contract,
        id2,
        vec![PromiseResult::Successful(vec![])],
        Ok(1),
    );
    assert!(!result);
    let proposal = contract.get_proposal(id2).unwrap();
    assert_eq!(proposal.failure_kind, Some(FailureKind::ZeroSnapshot));
}

#[test]
fn ut_snap_005_success_activates() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let result = call_on_snapshot(
        &mut contract,
        id,
        vec![PromiseResult::Successful(vec![])],
        Ok(10),
    );
    assert!(result);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.status, ProposalStatus::Active);
    assert_eq!(proposal.snapshot_verified_count, 10);
}

#[test]
fn ut_vote_cb_001_missing_pending_vote() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(None),
    );
    assert!(!result);
}

#[test]
fn ut_vote_cb_001b_proposal_missing_after_pending_vote() {
    let mut contract = new_contract();
    let governance::VersionedContract::V1(ref mut c) = contract;
    c.pending_votes.set(
        (999, accounts(2)),
        Some(governance::PendingVote {
            submitted_at: 1_700_000_000_000_000_000,
            choice: VoteChoice::Yes,
            voter_deposit: NearToken::from_near(1),
        }),
    );
    c.pending_votes.flush();
    let result = call_on_vote_verification(
        &mut contract,
        999,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 1_700_000_000_000_000_000,
        })),
    );
    assert!(!result);
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 1);
}

#[test]
fn ut_vote_cb_002_invalid_promise_results_count() {
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
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![],
        Ok(None),
    );
    assert!(!result);
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 1);
}

#[test]
fn ut_vote_cb_003_proposal_cancelled_or_finalized() {
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
        NearToken::from_near(1),
    );
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);

    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(!result);

    let id2 = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id2, 10);
    let governance::VersionedContract::V1(ref mut c) = contract;
    let (start_at, created_at) = {
        let proposal = c.proposals.get_mut(id2).unwrap();
        proposal.status = ProposalStatus::Succeeded;
        (proposal.start_at, proposal.created_at)
    };
    insert_pending_vote(
        &mut contract,
        id2,
        accounts(3),
        VoteChoice::Yes,
        start_at + 1,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id2,
        accounts(3),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(3),
            verified_at: created_at,
        })),
    );
    assert!(!result);
}

#[test]
fn ut_vote_cb_003b_proposal_pending() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(!result);
}

#[test]
fn ut_vote_cb_004_callback_error_or_not_verified() {
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
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Err(PromiseError::Failed),
    );
    assert!(!result);

    insert_pending_vote(
        &mut contract,
        id,
        accounts(3),
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(3),
        vec![PromiseResult::Successful(vec![])],
        Ok(None),
    );
    assert!(!result);
}

#[test]
fn ut_vote_cb_005_verified_after_creation() {
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
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0 + 1,
        })),
    );
    assert!(!result);
}

#[test]
fn ut_vote_cb_006_submitted_outside_window() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        proposal.start_at.0 - 1,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(!result);

    insert_pending_vote(
        &mut contract,
        id,
        accounts(3),
        VoteChoice::Yes,
        proposal.ends_at.0 + 1,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(3),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(3),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(!result);
}

#[test]
fn ut_vote_cb_006b_submitted_at_boundary_accepts() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();

    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        proposal.start_at.0,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(result);
    let vote = contract.get_vote(id, accounts(2)).unwrap();
    assert_eq!(vote.voted_at.0, proposal.start_at.0);

    insert_pending_vote(
        &mut contract,
        id,
        accounts(3),
        VoteChoice::No,
        proposal.ends_at.0,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(3),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(3),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(result);
    let vote = contract.get_vote(id, accounts(3)).unwrap();
    assert_eq!(vote.voted_at.0, proposal.ends_at.0);
}

#[test]
fn ut_vote_cb_007_success_records_vote_and_refunds_excess() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        submitted_at,
        NearToken::from_near(1),
    );

    let builder = build_context(accounts(0));
    set_context_with_promise_results(builder, vec![PromiseResult::Successful(vec![])]);
    let storage_before = env::storage_usage();
    let result = contract.on_vote_verification(
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
        id,
        accounts(2),
    );
    let storage_after = env::storage_usage();
    assert!(result);

    let vote = contract.get_vote(id, accounts(2)).unwrap();
    assert_eq!(vote.voted_at.0, submitted_at);
    assert_eq!(vote.choice, VoteChoice::Yes);

    let delta_bytes = storage_after.saturating_sub(storage_before) as u128;
    let expected_refund = NearToken::from_yoctonear(
        NearToken::from_near(1).as_yoctonear()
            - delta_bytes * env::storage_byte_cost().as_yoctonear(),
    );
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 1);
    let receipt = receipts.first().expect("receipt missing");
    let amount: u128 = receipt
        .actions
        .iter()
        .filter_map(|a| match a {
            MockAction::Transfer { deposit, .. } => Some(deposit.as_yoctonear()),
            _ => None,
        })
        .sum();
    assert_eq!(amount, expected_refund.as_yoctonear());

    let event = extract_event(&get_logs(), "vote_cast");
    let data = event
        .get("data")
        .expect("vote_cast data missing");
    let proposal_id = data
        .get("proposal_id")
        .and_then(Value::as_u64)
        .expect("proposal_id missing");
    assert_eq!(proposal_id, id as u64);
    assert_eq!(data.get("voter").unwrap(), &Value::String(accounts(2).to_string()));
    assert_eq!(data.get("choice").unwrap(), &Value::String("yes".to_string()));
    assert_eq!(
        data.get("voted_at").unwrap(),
        &Value::String(submitted_at.to_string())
    );
}

#[test]
fn ut_vote_cb_verified_at_zero_is_accepted() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;

    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        submitted_at,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 0,
        })),
    );
    assert!(result);
    let vote = contract.get_vote(id, accounts(2)).unwrap();
    assert_eq!(vote.choice, VoteChoice::Yes);
}

#[test]
fn ut_vote_cb_near_account_id_mismatch_is_not_checked() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 1;

    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        submitted_at,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(3),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(!result);
    assert!(contract.get_vote(id, accounts(2)).is_none());
}

#[test]
fn ut_vote_cb_007b_voted_at_equals_submitted_at() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let submitted_at = proposal.start_at.0 + 42;
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        submitted_at,
        NearToken::from_yoctonear(0),
    );

    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 123);
    set_context_with_promise_results(builder, vec![PromiseResult::Successful(vec![])]);
    contract.on_vote_verification(
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
        id,
        accounts(2),
    );

    let vote = contract.get_vote(id, accounts(2)).unwrap();
    assert_eq!(vote.voted_at.0, submitted_at);
}

#[test]
fn ut_vote_cb_007c_vote_choice_no() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::No,
        proposal.start_at.0 + 1,
        NearToken::from_yoctonear(0),
    );
    verify_vote(&mut contract, id, accounts(2), proposal.created_at.0);
    let proposal = contract.get_proposal(id).unwrap();
    assert_eq!(proposal.no_votes, 1);
    assert_eq!(proposal.yes_votes, 0);
}

#[test]
fn ut_vote_cb_008_vote_count_overflow() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let governance::VersionedContract::V1(ref mut c) = contract;
    let proposal = c.proposals.get_mut(id).unwrap();
    proposal.yes_votes = u64::MAX;
    let proposal = contract.get_proposal(id).unwrap();
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        proposal.start_at.0 + 1,
        NearToken::from_near(1),
    );
    let result = call_on_vote_verification(
        &mut contract,
        id,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: proposal.created_at.0,
        })),
    );
    assert!(!result);
    let receipts = get_created_receipts();
    assert_eq!(receipts.len(), 1);
}

#[test]
fn ut_block_cb_001_pending_op_missing() {
    let mut contract = new_contract();
    let result = call_on_blocklist_verification(
        &mut contract,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(None),
    );
    assert!(!result);
}

#[test]
fn ut_block_cb_002_invalid_promise_results_count() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let result = call_on_blocklist_verification(&mut contract, accounts(2), vec![], Ok(None));
    assert!(!result);
    assert!(!contract.is_blocklist_locked());
}

#[test]
fn ut_block_cb_003_verification_error_or_none() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
    let result = call_on_blocklist_verification(
        &mut contract,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Err(PromiseError::Failed),
    );
    assert!(!result);
    assert!(!contract.is_blocklisted(accounts(2)));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(3));
    let result = call_on_blocklist_verification(
        &mut contract,
        accounts(3),
        vec![PromiseResult::Successful(vec![])],
        Ok(None),
    );
    assert!(!result);
    assert!(!contract.is_blocklisted(accounts(3)));
}

#[test]
fn ut_block_cb_004_success_adds_to_blocklist() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let result = call_on_blocklist_verification(
        &mut contract,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 1_700_000_000_000_000_000,
        })),
    );
    assert!(result);
    assert!(contract.is_blocklisted(accounts(2)));
}

#[test]
fn ut_block_cb_005_success_already_blocklisted() {
    let mut contract = new_contract();
    let governance::VersionedContract::V1(ref mut c) = contract;
    c.blocklist.insert(accounts(2));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let result = call_on_blocklist_verification(
        &mut contract,
        accounts(2),
        vec![PromiseResult::Successful(vec![])],
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 1_700_000_000_000_000_000,
        })),
    );
    assert!(result);
    assert!(contract.is_blocklisted(accounts(2)));
}
