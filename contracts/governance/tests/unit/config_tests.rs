use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::NearToken;

use crate::helpers::{
    activate_proposal, assert_panics_with, build_context, create_basic_proposal, new_contract,
    with_deposit};

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 001 update quorum bps boundaries.")]
#[allure_test]
fn ut_config_001_update_quorum_bps_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_quorum_bps(1);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_quorum_bps(10_000);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.update_quorum_bps(0), "ERR_QUORUM_BPS_OUT_OF_RANGE");

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.update_quorum_bps(10_001), "ERR_QUORUM_BPS_OUT_OF_RANGE");
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description(
    "Verifies config 002 update voting period while pending and applies only to future proposals."
)]
#[allure_test]
fn ut_config_002_update_voting_period_while_pending() {
    let mut contract = new_contract();
    let existing_id = create_basic_proposal(&mut contract, accounts(0));
    let existing_before = contract.get_proposal(existing_id).unwrap();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_voting_period_secs(120);

    assert_eq!(contract.get_config().voting_period_secs, 120);

    let existing_after = contract.get_proposal(existing_id).unwrap();
    assert_eq!(existing_after.ends_at.0, existing_before.ends_at.0);

    let new_id = create_basic_proposal(&mut contract, accounts(0));
    let new_proposal = contract.get_proposal(new_id).unwrap();
    assert_eq!(
        new_proposal.ends_at.0 - new_proposal.start_at.0,
        120 * 1_000_000_000
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description(
    "Verifies config 002 update voting period while active and preserves existing proposal end time."
)]
#[allure_test]
fn ut_config_002_update_voting_period_while_active() {
    let mut contract = new_contract();
    let existing_id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, existing_id, 10);
    let existing_before = contract.get_proposal(existing_id).unwrap();

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_voting_period_secs(180);

    assert_eq!(contract.get_config().voting_period_secs, 180);

    let existing_after = contract.get_proposal(existing_id).unwrap();
    assert_eq!(existing_after.ends_at.0, existing_before.ends_at.0);

    let new_id = create_basic_proposal(&mut contract, accounts(0));
    let new_proposal = contract.get_proposal(new_id).unwrap();
    assert_eq!(
        new_proposal.ends_at.0 - new_proposal.start_at.0,
        180 * 1_000_000_000
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 002b update voting period boundaries.")]
#[allure_test]
fn ut_config_002b_update_voting_period_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_voting_period_secs(60);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_voting_period_secs(7_776_000);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_voting_period_secs(59),
        "ERR_VOTING_PERIOD_OUT_OF_RANGE",
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_voting_period_secs(7_776_001),
        "ERR_VOTING_PERIOD_OUT_OF_RANGE",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 003 update verified contract locked by pending.")]
#[should_panic(expected = "ERR_CONFIG_LOCKED")]
#[allure_test]
fn ut_config_003_update_verified_contract_locked_by_pending() {
    let mut contract = new_contract();
    create_basic_proposal(&mut contract, accounts(0));
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_verified_accounts_contract(accounts(5));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 003 update verified contract locked by active.")]
#[should_panic(expected = "ERR_CONFIG_LOCKED")]
#[allure_test]
fn ut_config_003_update_verified_contract_locked_by_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_verified_accounts_contract(accounts(5));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 003b update verified contract allowed when idle.")]
#[allure_test]
fn ut_config_003b_update_verified_contract_allowed_when_idle() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_verified_accounts_contract(accounts(5));
    assert_eq!(contract.get_config().verified_accounts_contract, accounts(5));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 004 update pending expiry boundaries.")]
#[allure_test]
fn ut_config_004_update_pending_expiry_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_pending_expiry_secs(10);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_pending_expiry_secs(86_400);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_pending_expiry_secs(9),
        "ERR_PENDING_EXPIRY_OUT_OF_RANGE",
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_pending_expiry_secs(86_401),
        "ERR_PENDING_EXPIRY_OUT_OF_RANGE",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 005 update min proposal bond boundaries.")]
#[allure_test]
fn ut_config_005_update_min_proposal_bond_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_min_proposal_bond(NearToken::from_millinear(10));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_min_proposal_bond(NearToken::from_near(100));

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_min_proposal_bond(NearToken::from_millinear(9)),
        "ERR_MIN_BOND_OUT_OF_RANGE",
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_min_proposal_bond(NearToken::from_near(101)),
        "ERR_MIN_BOND_OUT_OF_RANGE",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 006 update finalize grace boundaries.")]
#[allure_test]
fn ut_config_006_update_finalize_grace_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_finalize_grace_period_secs(10);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_finalize_grace_period_secs(86_400);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_finalize_grace_period_secs(9),
        "ERR_GRACE_PERIOD_OUT_OF_RANGE",
    );

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_finalize_grace_period_secs(86_401),
        "ERR_GRACE_PERIOD_OUT_OF_RANGE",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 007 update max start delay boundaries.")]
#[allure_test]
fn ut_config_007_update_max_start_delay_boundaries() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_max_start_delay_secs(0);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_max_start_delay_secs(7_776_000);

    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_max_start_delay_secs(7_776_001),
        "ERR_MAX_START_DELAY_OUT_OF_RANGE",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 008 update quorum bps while active.")]
#[allure_test]
fn ut_config_008_update_quorum_bps_while_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_quorum_bps(800);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 009 update pending expiry while active.")]
#[allure_test]
fn ut_config_009_update_pending_expiry_while_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_pending_expiry_secs(20);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 010 update min bond while active.")]
#[allure_test]
fn ut_config_010_update_min_bond_while_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_min_proposal_bond(NearToken::from_near(2));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 011 update grace period while active.")]
#[allure_test]
fn ut_config_011_update_grace_period_while_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_finalize_grace_period_secs(20);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 012 update max start delay while active.")]
#[allure_test]
fn ut_config_012_update_max_start_delay_while_active() {
    let mut contract = new_contract();
    let id = create_basic_proposal(&mut contract, accounts(0));
    activate_proposal(&mut contract, id, 10);
    let mut builder = build_context(accounts(0));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    contract.update_max_start_delay_secs(20);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 013 config updates by non admin.")]
#[allure_test]
fn ut_config_013_config_updates_by_non_admin() {
    let mut contract = new_contract();
    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.update_quorum_bps(800), "ERR_NOT_ADMIN");

    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.update_voting_period_secs(60), "ERR_NOT_ADMIN");

    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_verified_accounts_contract(accounts(5)),
        "ERR_NOT_ADMIN",
    );

    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_pending_expiry_secs(20),
        "ERR_NOT_ADMIN",
    );

    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_min_proposal_bond(NearToken::from_near(2)),
        "ERR_NOT_ADMIN",
    );

    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_finalize_grace_period_secs(20),
        "ERR_NOT_ADMIN",
    );

    let mut builder = build_context(accounts(4));
    with_deposit(&mut builder, 1);
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_max_start_delay_secs(20),
        "ERR_NOT_ADMIN",
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Configuration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "config")]
#[allure_description("Verifies config 014 config updates without one yocto.")]
#[allure_test]
fn ut_config_014_config_updates_without_one_yocto() {
    let mut contract = new_contract();
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(|| contract.update_quorum_bps(800), "Requires attached deposit");

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_voting_period_secs(60),
        "Requires attached deposit",
    );

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_verified_accounts_contract(accounts(5)),
        "Requires attached deposit",
    );

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_pending_expiry_secs(20),
        "Requires attached deposit",
    );

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_min_proposal_bond(NearToken::from_near(2)),
        "Requires attached deposit",
    );

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_finalize_grace_period_secs(20),
        "Requires attached deposit",
    );

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    assert_panics_with(
        || contract.update_max_start_delay_secs(20),
        "Requires attached deposit",
    );
}
