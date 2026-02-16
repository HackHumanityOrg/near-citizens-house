use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::{
    mock::MockAction,
    test_utils::{get_created_receipts, get_logs},
    NearToken,
};
use serde_json::Value;

use crate::helpers::{
    build_context, create_basic_proposal, insert_pending_vote, new_contract, with_deposit,
};

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 001 add admin.")]
#[allure_test]
fn ut_admin_001_add_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    contract.add_admin(accounts(2));
    assert!(contract.is_admin(accounts(2)));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 002 add admin by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_admin_002_add_admin_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    contract.add_admin(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 002b add admin by non admin with yocto.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_admin_002b_add_admin_by_non_admin_with_yocto() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    contract.add_admin(accounts(3));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 003 add admin without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_admin_003_add_admin_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);

    contract.add_admin(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 004 remove last admin.")]
#[should_panic(expected = "ERR_CANNOT_REMOVE_LAST_ADMIN")]
#[allure_test]
fn ut_admin_004_remove_last_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    contract.remove_admin(accounts(0));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 005 remove admin not found.")]
#[should_panic(expected = "ERR_ADMIN_NOT_FOUND")]
#[allure_test]
fn ut_admin_005_remove_admin_not_found() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.add_admin(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(3));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 006 is admin and list admins.")]
#[allure_test]
fn ut_admin_006_is_admin_and_list_admins() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.add_admin(accounts(2));
    contract.add_admin(accounts(3));

    assert!(contract.is_admin(accounts(2)));

    let admins = contract.list_admins(0, 2);
    assert_eq!(admins.len(), 2);

    let admins_tail = contract.list_admins(2, 2);
    assert_eq!(admins_tail.len(), 1);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 006b list admins limit too large.")]
#[should_panic(expected = "ERR_LIMIT_TOO_LARGE")]
#[allure_test]
fn ut_admin_006b_list_admins_limit_too_large() {
    let contract = new_contract();
    contract.list_admins(0, 101);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 007 list admins beyond range.")]
#[allure_test]
fn ut_admin_007_list_admins_beyond_range() {
    let contract = new_contract();
    let admins = contract.list_admins(10, 10);
    assert!(admins.is_empty());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 008 add admin duplicate.")]
#[should_panic(expected = "ERR_ADMIN_ALREADY_EXISTS")]
#[allure_test]
fn ut_admin_008_add_admin_duplicate() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    contract.add_admin(accounts(0));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 009 clear stale pending vote missing proposal.")]
#[should_panic(expected = "ERR_PROPOSAL_NOT_FOUND")]
#[allure_test]
fn ut_admin_009_clear_stale_pending_vote_missing_proposal() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    contract.clear_stale_pending_vote(999, accounts(1));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 010 clear stale pending vote missing record.")]
#[should_panic(expected = "ERR_PENDING_VOTE_NOT_FOUND")]
#[allure_test]
fn ut_admin_010_clear_stale_pending_vote_missing_record() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);

    // create a proposal to satisfy proposal existence
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_millinear(10));
    crate::helpers::set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_pending_vote(0, accounts(1));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 010b clear stale pending vote refunds deposit.")]
#[allure_test]
fn ut_admin_010b_clear_stale_pending_vote_refunds_deposit() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        governance::VoteChoice::Yes,
        1_700_000_000_000_000_000,
        NearToken::from_near(1),
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_pending_vote(id, accounts(2));

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
    assert_eq!(amount, NearToken::from_near(1).as_yoctonear());

    let logs = get_logs();
    let event = logs
        .iter()
        .find(|l| l.contains("\"event\":\"pending_vote_cleared\""))
        .expect("pending_vote_cleared event missing");
    let json = event.strip_prefix("EVENT_JSON:").unwrap_or(event);
    let value: Value = serde_json::from_str(json).unwrap();
    let refunded = value
        .get("data")
        .and_then(|data| data.get("deposit_refunded"))
        .and_then(Value::as_str)
        .expect("deposit_refunded missing");
    assert_eq!(refunded, NearToken::from_near(1).as_yoctonear().to_string());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 010c clear stale pending vote zero deposit.")]
#[allure_test]
fn ut_admin_010c_clear_stale_pending_vote_zero_deposit() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    insert_pending_vote(
        &mut contract,
        id,
        accounts(2),
        governance::VoteChoice::Yes,
        1_700_000_000_000_000_000,
        NearToken::from_yoctonear(0),
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_pending_vote(id, accounts(2));

    let receipts = get_created_receipts();
    assert!(receipts.is_empty());

    let logs = get_logs();
    let event = logs
        .iter()
        .find(|l| l.contains("\"event\":\"pending_vote_cleared\""))
        .expect("pending_vote_cleared event missing");
    let json = event.strip_prefix("EVENT_JSON:").unwrap_or(event);
    let value: Value = serde_json::from_str(json).unwrap();
    let refunded = value
        .get("data")
        .and_then(|data| data.get("deposit_refunded"))
        .and_then(Value::as_str)
        .expect("deposit_refunded missing");
    assert_eq!(refunded, "0");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 011 remove admin by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_admin_011_remove_admin_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(0));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 012 clear stale pending vote by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_admin_012_clear_stale_pending_vote_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_pending_vote(0, accounts(1));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 013 clear stale blocklist op by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_admin_013_clear_stale_blocklist_op_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_blocklist_op();
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 014 remove admin without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_admin_014_remove_admin_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(0));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 015 clear stale pending vote without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_admin_015_clear_stale_pending_vote_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    contract.clear_stale_pending_vote(0, accounts(1));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 016 clear stale blocklist op without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_admin_016_clear_stale_blocklist_op_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    contract.clear_stale_blocklist_op();
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 017 admin self removal.")]
#[allure_test]
fn ut_admin_017_admin_self_removal() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.add_admin(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(0));

    assert!(!contract.is_admin(accounts(0)));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Admin")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "admin")]
#[allure_description("Verifies admin 018 removed admin cannot act.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_admin_018_removed_admin_cannot_act() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.add_admin(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.remove_admin(accounts(0));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.add_admin(accounts(3));
}
