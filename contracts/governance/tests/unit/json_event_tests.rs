use allure_rs::prelude::*;
use governance::VoteChoice;
use near_sdk::test_utils::{accounts, get_logs};
use near_sdk::{NearToken, PromiseError, PromiseResult};
use serde_json::Value;

use crate::helpers::{
    activate_proposal, build_context, create_basic_proposal, insert_pending_vote, new_contract,
    set_context_with_promise_results, verify_vote, with_block_timestamp, with_deposit,
};

fn extract_event(logs: &[String], event_name: &str) -> Value {
    let entry = logs
        .iter()
        .find(|l| l.contains("\"event\":\"") && l.contains(event_name))
        .expect("event not found");
    let json = entry.strip_prefix("EVENT_JSON:").unwrap_or(entry).trim();
    serde_json::from_str(json).expect("invalid event json")
}

fn expect_field<'a>(value: &'a Value, key: &str) -> &'a Value {
    value
        .get(key)
        .unwrap_or_else(|| panic!("missing field {}", key))
}

fn expect_index(value: &Value, index: usize) -> &Value {
    value
        .get(index)
        .unwrap_or_else(|| panic!("missing index {}", index))
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies json 001 get proposal timestamps are strings.")]
#[allure_test]
fn ut_json_001_get_proposal_timestamps_are_strings() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let proposal = contract.get_proposal(id).unwrap();
    let value = serde_json::to_value(proposal).unwrap();
    assert!(expect_field(&value, "created_at").is_string());
    assert!(expect_field(&value, "start_at").is_string());
    assert!(expect_field(&value, "ends_at").is_string());
    assert!(expect_field(&value, "pending_expires_at").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies json 002 get vote list votes voted at string.")]
#[allure_test]
fn ut_json_002_get_vote_list_votes_voted_at_string() {
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
    verify_vote(&mut contract, id, accounts(2), proposal.created_at.0);

    let vote = contract.get_vote(id, accounts(2)).unwrap();
    let value = serde_json::to_value(vote).unwrap();
    assert!(expect_field(&value, "voted_at").is_string());

    let list = contract.list_votes(id, 0, 10);
    let value = serde_json::to_value(list).unwrap();
    assert!(expect_field(expect_index(&value, 0), "voted_at").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies json 003 get config neartoken and numeric fields.")]
#[allure_test]
fn ut_json_003_get_config_neartoken_and_numeric_fields() {
    let contract = new_contract();
    let value = serde_json::to_value(contract.get_config()).unwrap();
    assert!(expect_field(&value, "min_proposal_bond").is_string());
    assert!(expect_field(&value, "quorum_bps").is_number());
    assert!(expect_field(&value, "voting_period_secs").is_number());
    assert!(expect_field(&value, "pending_expiry_secs").is_number());
    assert!(expect_field(&value, "finalize_grace_period_secs").is_number());
    assert!(expect_field(&value, "max_start_delay_secs").is_number());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies json 004 list proposals u64 fields.")]
#[allure_test]
fn ut_json_004_list_proposals_u64_fields() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    create_basic_proposal(&mut contract, accounts(0));
    let list = contract.list_proposals(0, 10);
    let value = serde_json::to_value(list).unwrap();
    let first = expect_index(&value, 0);
    assert!(expect_field(first, "created_at").is_string());
    assert!(expect_field(first, "start_at").is_string());
    assert!(expect_field(first, "ends_at").is_string());
    assert!(expect_field(first, "pending_expires_at").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 001 proposal created payload types.")]
#[allure_test]
fn ut_event_001_proposal_created_payload_types() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    let event = extract_event(&get_logs(), "proposal_created");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "created_at").is_string());
    assert!(expect_field(data, "start_at").is_string());
    assert!(expect_field(data, "ends_at").is_string());
    assert!(expect_field(data, "pending_expires_at").is_string());
    assert!(expect_field(data, "quorum_bps").is_number());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 002 proposal activated payload types.")]
#[allure_test]
fn ut_event_002_proposal_activated_payload_types() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    set_context_with_promise_results(
        build_context(accounts(0)),
        vec![PromiseResult::Successful(vec![])],
    );
    contract.on_snapshot(Ok(10), id);
    let event = extract_event(&get_logs(), "proposal_activated");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "snapshot_verified_count").is_number());
    assert!(expect_field(data, "quorum_required").is_number());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 003 proposal finalized payload types.")]
#[allure_test]
fn ut_event_003_proposal_finalized_payload_types() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let proposal = contract.get_proposal(id).unwrap();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.ends_at.0 + 1);
    crate::helpers::set_context(builder);
    contract.finalize_proposal(id);
    let event = extract_event(&get_logs(), "proposal_finalized");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "yes_votes").is_number());
    assert!(expect_field(data, "no_votes").is_number());
    assert!(expect_field(data, "quorum").is_number());
    assert!(expect_field(data, "snapshot_verified_count").is_number());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 004 vote cast payload types.")]
#[allure_test]
fn ut_event_004_vote_cast_payload_types() {
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
    verify_vote(&mut contract, id, accounts(2), proposal.created_at.0);
    let event = extract_event(&get_logs(), "vote_cast");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "voted_at").is_string());
    assert!(expect_field(data, "choice").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 005 vote rejected payload types.")]
#[allure_test]
fn ut_event_005_vote_rejected_payload_types() {
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
    set_context_with_promise_results(
        build_context(accounts(0)),
        vec![PromiseResult::Successful(vec![])],
    );
    contract.on_vote_verification(Err(PromiseError::Failed), id, accounts(2));
    let event = extract_event(&get_logs(), "vote_rejected");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "reason").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 006 config updated payload types.")]
#[allure_test]
fn ut_event_006_config_updated_payload_types() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_quorum_bps(800);
    let event = extract_event(&get_logs(), "config_updated");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "min_proposal_bond").is_string());
    assert!(expect_field(data, "quorum_bps").is_number());
    assert!(expect_field(data, "voting_period_secs").is_number());
    assert!(expect_field(data, "pending_expiry_secs").is_number());
    assert!(expect_field(data, "finalize_grace_period_secs").is_number());
    assert!(expect_field(data, "max_start_delay_secs").is_number());
    assert!(expect_field(data, "updated_by").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 007 pending vote cleared payload types.")]
#[allure_test]
fn ut_event_007_pending_vote_cleared_payload_types() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        VoteChoice::Yes,
        1_700_000_000_000_000_000,
        NearToken::from_near(1),
    );
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_pending_vote(id, accounts(2));
    let event = extract_event(&get_logs(), "pending_vote_cleared");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "deposit_refunded").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 008 proposal cancelled payload types.")]
#[allure_test]
fn ut_event_008_proposal_cancelled_payload_types() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
    let event = extract_event(&get_logs(), "proposal_cancelled");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "cancelled_by").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 009 admin added removed payload types.")]
#[allure_test]
fn ut_event_009_admin_added_removed_payload_types() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.add_admin(accounts(2));
    let event = extract_event(&get_logs(), "admin_added");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "added_by").is_string());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(2));
    let event = extract_event(&get_logs(), "admin_removed");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "removed_by").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 010 blocklist added removed payload types.")]
#[allure_test]
fn ut_event_010_blocklist_added_removed_payload_types() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));
    set_context_with_promise_results(
        build_context(accounts(0)),
        vec![PromiseResult::Successful(vec![])],
    );
    contract.on_blocklist_verification(
        Ok(Some(governance::VerificationSummary {
            near_account_id: accounts(2),
            verified_at: 1_700_000_000_000_000_000,
        })),
        accounts(2),
    );
    let event = extract_event(&get_logs(), "blocklist_added");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "added_by").is_string());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
    let event = extract_event(&get_logs(), "blocklist_removed");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "removed_by").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 011 pending proposal expired payload types.")]
#[allure_test]
fn ut_event_011_pending_proposal_expired_payload_types() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    let proposal = contract.get_proposal(id).unwrap();
    let mut builder = build_context(accounts(0));
    with_block_timestamp(&mut builder, proposal.pending_expires_at.0);
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.expire_pending_proposal(id);
    let event = extract_event(&get_logs(), "pending_proposal_expired");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "expired_by").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 012 pending blocklist op cleared payload types.")]
#[allure_test]
fn ut_event_012_pending_blocklist_op_cleared_payload_types() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_blocklist_op();
    let event = extract_event(&get_logs(), "pending_blocklist_op_cleared");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "account_id").is_string());
    assert!(expect_field(data, "cleared_by").is_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("JSON Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "json-events")]
#[allure_description("Verifies event 013 proposal creation failed payload types.")]
#[allure_test]
fn ut_event_013_proposal_creation_failed_payload_types() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    set_context_with_promise_results(build_context(accounts(0)), vec![]);
    contract.on_snapshot(Ok(10), id);
    let event = extract_event(&get_logs(), "proposal_creation_failed");
    let data = expect_field(&event, "data");
    assert!(expect_field(data, "reason").is_string());
}
