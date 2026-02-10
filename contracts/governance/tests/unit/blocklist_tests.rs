use near_sdk::test_utils::accounts;

use crate::helpers::{
    activate_proposal, build_context, create_basic_proposal, new_contract, set_context, with_deposit,
};

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
fn ut_block_001_blocklist_locked_by_pending() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
fn ut_block_001_blocklist_locked_by_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_OP_PENDING")]
fn ut_block_002_blocklist_pending_op_prevention() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(3));
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
fn ut_block_003_unblocklist_locked_by_pending() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_LOCKED")]
fn ut_block_003_unblocklist_locked_by_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_ACCOUNT_NOT_BLOCKLISTED")]
fn ut_block_004_unblocklist_nonexistent() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_OP_PENDING")]
fn ut_block_006_unblocklist_blocked_by_pending_op() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
fn ut_block_007_clear_stale_blocklist_op_success() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.clear_stale_blocklist_op();

    assert!(!contract.is_blocklist_locked());
}

#[test]
#[should_panic(expected = "ERR_BLOCKLIST_OP_NOT_PENDING")]
fn ut_block_008_clear_stale_blocklist_op_no_pending() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.clear_stale_blocklist_op();
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_block_009_blocklist_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_block_010_unblocklist_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_block_011_blocklist_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    set_context(builder);
    contract.blocklist_account(accounts(2));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_block_012_unblocklist_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    set_context(builder);
    contract.unblocklist_account(accounts(2));
}

#[test]
fn ut_block_005_is_blocklist_locked() {
    let mut contract = new_contract();
    assert!(!contract.is_blocklist_locked());

    let id = create_basic_proposal(&mut contract, accounts(0));
    assert!(contract.is_blocklist_locked());

    activate_proposal(&mut contract, id, 10);
    assert!(contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id);
    assert!(!contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.blocklist_account(accounts(2));
    assert!(contract.is_blocklist_locked());
}

#[test]
fn ut_block_005b_blocklist_locked_multiple_proposals() {
    let mut contract = new_contract();
    let id1 = create_basic_proposal(&mut contract, accounts(0));
    let id2 = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id1, 10);
    activate_proposal(&mut contract, id2, 10);
    assert!(contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id1);
    assert!(contract.is_blocklist_locked());

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.cancel_proposal(id2);
    assert!(!contract.is_blocklist_locked());
}
