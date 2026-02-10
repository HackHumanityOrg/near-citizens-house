use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;

use crate::helpers::{
    activate_proposal, build_context, create_basic_proposal, new_contract, with_deposit};

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 001 blocklist locked by pending.")]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
#[allure_test]
fn ut_block_001_blocklist_locked_by_pending() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 001 blocklist locked by active.")]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
#[allure_test]
fn ut_block_001_blocklist_locked_by_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 002 blocklist pending op prevention.")]
#[should_panic(expected = "ERR_BLOCKLIST_OP_PENDING")]
#[allure_test]
fn ut_block_002_blocklist_pending_op_prevention() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(3));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 003 unblocklist locked by pending.")]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
#[allure_test]
fn ut_block_003_unblocklist_locked_by_pending() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 003 unblocklist locked by active.")]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
#[allure_test]
fn ut_block_003_unblocklist_locked_by_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 004 unblocklist nonexistent.")]
#[should_panic(expected = "ERR_ACCOUNT_NOT_BLOCKLISTED")]
#[allure_test]
fn ut_block_004_unblocklist_nonexistent() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 006 unblocklist blocked by pending op.")]
#[should_panic(expected = "ERR_BLOCKLIST_OP_PENDING")]
#[allure_test]
fn ut_block_006_unblocklist_blocked_by_pending_op() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 007 clear stale blocklist op success.")]
#[allure_test]
fn ut_block_007_clear_stale_blocklist_op_success() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_blocklist_op();

    assert!(!contract.is_blocklist_locked());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 008 clear stale blocklist op no pending.")]
#[should_panic(expected = "ERR_BLOCKLIST_OP_NOT_PENDING")]
#[allure_test]
fn ut_block_008_clear_stale_blocklist_op_no_pending() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.clear_stale_blocklist_op();
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 009 blocklist by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_block_009_blocklist_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 010 unblocklist by non admin.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_block_010_unblocklist_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 011 blocklist without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_block_011_blocklist_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 012 unblocklist without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_block_012_unblocklist_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 005 is blocklist locked.")]
#[allure_test]
fn ut_block_005_is_blocklist_locked() {
    let mut contract = new_contract();
    assert!(!contract.is_blocklist_locked());

    let id = create_basic_proposal(&mut contract, accounts(0));
    assert!(contract.is_blocklist_locked());

    activate_proposal(&mut contract, id, 10);
    assert!(contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id);
    assert!(!contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.blocklist_account(accounts(2));
    assert!(contract.is_blocklist_locked());
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Blocklist")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "blocklist")]
#[allure_description("Verifies block 005b blocklist locked multiple proposals.")]
#[allure_test]
fn ut_block_005b_blocklist_locked_multiple_proposals() {
    let mut contract = new_contract();
    let id1 = create_basic_proposal(&mut contract, accounts(0));
    let id2 = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id1, 10);
    activate_proposal(&mut contract, id2, 10);
    assert!(contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id1);
    assert!(contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.cancel_proposal(id2);
    assert!(!contract.is_blocklist_locked());
}
