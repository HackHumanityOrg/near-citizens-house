use near_sdk::test_utils::accounts;
use near_sdk::{mock::MockAction, test_utils::{get_created_receipts, get_logs}, NearToken};
use serde_json::Value;

use crate::helpers::{
    build_context, create_basic_proposal, insert_pending_vote, new_contract, set_context,
    with_deposit,
};

#[test]
fn ut_admin_001_add_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);

    contract.add_admin(accounts(2));
    assert!(contract.is_admin(accounts(2)));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_admin_002_add_admin_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    set_context(builder);

    contract.add_admin(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_admin_002b_add_admin_by_non_admin_with_yocto() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    set_context(builder);

    contract.add_admin(accounts(3));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_admin_003_add_admin_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    set_context(builder);

    contract.add_admin(accounts(2));
}

#[test]
#[should_panic(expected = "ERR_CANNOT_REMOVE_LAST_ADMIN")]
fn ut_admin_004_remove_last_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);

    contract.remove_admin(accounts(0));
}

#[test]
#[should_panic(expected = "ERR_ADMIN_NOT_FOUND")]
fn ut_admin_005_remove_admin_not_found() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.add_admin(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.remove_admin(accounts(3));
}

#[test]
fn ut_admin_006_is_admin_and_list_admins() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.add_admin(accounts(2));
    contract.add_admin(accounts(3));

    assert!(contract.is_admin(accounts(2)));

    let admins = contract.list_admins(0, 2);
    assert_eq!(admins.len(), 2);

    let admins_tail = contract.list_admins(2, 2);
    assert_eq!(admins_tail.len(), 1);
}

#[test]
#[should_panic(expected = "ERR_LIMIT_TOO_LARGE")]
fn ut_admin_006b_list_admins_limit_too_large() {
    let contract = new_contract();
    contract.list_admins(0, 101);
}

#[test]
fn ut_admin_007_list_admins_beyond_range() {
    let contract = new_contract();
    let admins = contract.list_admins(10, 10);
    assert!(admins.is_empty());
}

#[test]
#[should_panic(expected = "ERR_ADMIN_ALREADY_EXISTS")]
fn ut_admin_008_add_admin_duplicate() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);

    contract.add_admin(accounts(0));
}

#[test]
#[should_panic(expected = "ERR_PROPOSAL_NOT_FOUND")]
fn ut_admin_009_clear_stale_pending_vote_missing_proposal() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);

    contract.clear_stale_pending_vote(999, accounts(1));
}

#[test]
#[should_panic(expected = "ERR_PENDING_VOTE_NOT_FOUND")]
fn ut_admin_010_clear_stale_pending_vote_missing_record() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);

    // create a proposal to satisfy proposal existence
    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_near(1));
    set_context(builder);
    contract.create_proposal("t".to_string(), "a".to_string(), "d".to_string(), None);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.clear_stale_pending_vote(0, accounts(1));
}

#[test]
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
    set_context(builder);
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
    assert_eq!(
        refunded,
        NearToken::from_near(1).as_yoctonear().to_string()
    );
}

#[test]
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
    set_context(builder);
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
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_admin_011_remove_admin_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.remove_admin(accounts(0));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_admin_012_clear_stale_pending_vote_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.clear_stale_pending_vote(0, accounts(1));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_admin_013_clear_stale_blocklist_op_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(3));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.clear_stale_blocklist_op();
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_admin_014_remove_admin_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    set_context(builder);
    contract.remove_admin(accounts(0));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_admin_015_clear_stale_pending_vote_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    set_context(builder);
    contract.clear_stale_pending_vote(0, accounts(1));
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_admin_016_clear_stale_blocklist_op_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    set_context(builder);
    contract.clear_stale_blocklist_op();
}

#[test]
fn ut_admin_017_admin_self_removal() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.add_admin(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.remove_admin(accounts(0));

    assert!(!contract.is_admin(accounts(0)));
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_admin_018_removed_admin_cannot_act() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.add_admin(accounts(2));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.remove_admin(accounts(0));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    set_context(builder);
    contract.add_admin(accounts(3));
}
