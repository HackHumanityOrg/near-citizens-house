use governance::{VerificationSummary, VoteChoice};
use near_sdk::test_utils::accounts;
use near_sdk::{NearToken, PromiseResult};

use crate::helpers::{
    activate_proposal, build_context, create_basic_proposal, insert_pending_vote, new_contract,
    set_context, set_context_with_promise_results, verify_vote, with_deposit,
};

#[test]
fn ut_view_001_get_proposal_count_increments() {
    let mut contract = new_contract();
    assert_eq!(contract.get_proposal_count(), 0);

    create_basic_proposal(&mut contract, accounts(0));
    assert_eq!(contract.get_proposal_count(), 1);
}

#[test]
fn ut_view_002_get_proposal_not_found() {
    let contract = new_contract();
    assert!(contract.get_proposal(999).is_none());
}

#[test]
#[should_panic(expected = "ERR_PROPOSAL_NOT_FOUND")]
fn ut_view_003_get_pending_votes_count_not_found() {
    let contract = new_contract();
    contract.get_pending_votes_count(999);
}

#[test]
fn ut_view_004_get_vote_and_has_voted_not_found() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    assert!(!contract.has_voted(id, accounts(2)));
    assert!(contract.get_vote(id, accounts(2)).is_none());
}

#[test]
fn ut_view_004b_get_vote_and_has_voted_after_vote() {
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
        NearToken::from_yoctonear(0),
    );
    verify_vote(&mut contract, id, accounts(2), proposal.created_at.0);

    assert!(contract.has_voted(id, accounts(2)));
    let vote = contract.get_vote(id, accounts(2)).unwrap();
    assert_eq!(vote.proposal_id, id);
    assert_eq!(vote.voter, accounts(2));
    assert_eq!(vote.choice, VoteChoice::Yes);
    assert_eq!(vote.voted_at.0, submitted_at);
}

#[test]
fn ut_view_006_get_config_returns_all_fields() {
    let contract = new_contract();
    let cfg = contract.get_config();
    assert_eq!(cfg.verified_accounts_contract, accounts(1));
    assert_eq!(cfg.quorum_bps, 700);
    assert_eq!(cfg.voting_period_secs, 60);
    assert_eq!(cfg.pending_expiry_secs, 10);
    assert_eq!(cfg.min_proposal_bond, NearToken::from_millinear(10));
    assert_eq!(cfg.finalize_grace_period_secs, 10);
    assert_eq!(cfg.max_start_delay_secs, 60);
}

#[test]
fn ut_view_007_is_blocklisted_true_false() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
    set_context_with_promise_results(
        build_context(accounts(0)),
        vec![PromiseResult::Successful(vec![])],
    );
    contract.on_blocklist_verification(
        Ok(Some(VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 1_700_000_000_000_000_000,
        })),
        accounts(2),
    );

    assert!(contract.is_blocklisted(accounts(2)));
    assert!(!contract.is_blocklisted(accounts(3)));
}

#[test]
#[should_panic(expected = "ERR_LIMIT_TOO_LARGE")]
fn ut_view_008_list_proposals_limit_too_large() {
    let contract = new_contract();
    contract.list_proposals(0, 101);
}

#[test]
#[should_panic(expected = "ERR_LIMIT_TOO_LARGE")]
fn ut_view_009_list_votes_limit_too_large() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    contract.list_votes(id, 0, 101);
}

#[test]
#[should_panic(expected = "ERR_PROPOSAL_NOT_FOUND")]
fn ut_view_010_has_voted_nonexistent_proposal() {
    let contract = new_contract();
    contract.has_voted(999, accounts(2));
}

#[test]
#[should_panic(expected = "ERR_PROPOSAL_NOT_FOUND")]
fn ut_view_011_get_vote_nonexistent_proposal() {
    let contract = new_contract();
    contract.get_vote(999, accounts(2));
}

#[test]
#[should_panic(expected = "ERR_PROPOSAL_NOT_FOUND")]
fn ut_view_012_list_votes_nonexistent_proposal() {
    let contract = new_contract();
    contract.list_votes(999, 0, 10);
}

#[test]
fn ut_view_013_list_proposals_beyond_range() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    create_basic_proposal(&mut contract, accounts(0));
    create_basic_proposal(&mut contract, accounts(0));
    let list = contract.list_proposals(999, 10);
    assert!(list.is_empty());
}

#[test]
fn ut_view_005_list_blocklist_pagination_and_bounds() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
    set_context_with_promise_results(
        build_context(accounts(0)),
        vec![PromiseResult::Successful(vec![])],
    );
    contract.on_blocklist_verification(
        Ok(Some(VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 1_700_000_000_000_000_000,
        })),
        accounts(2),
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(3));
    set_context_with_promise_results(
        build_context(accounts(0)),
        vec![PromiseResult::Successful(vec![])],
    );
    contract.on_blocklist_verification(
        Ok(Some(VerificationSummary {
            near_account_id: accounts(3),
            verified_at: 1_700_000_000_000_000_000,
        })),
        accounts(3),
    );

    let page = contract.list_blocklist(0, 1);
    assert_eq!(page.len(), 1);

    let beyond = contract.list_blocklist(10, 10);
    assert!(beyond.is_empty());
}

#[test]
#[should_panic(expected = "ERR_LIMIT_TOO_LARGE")]
fn ut_view_005b_list_blocklist_limit_too_large() {
    let contract = new_contract();
    contract.list_blocklist(0, 101);
}
