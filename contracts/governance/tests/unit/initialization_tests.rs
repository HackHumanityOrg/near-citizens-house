use allure_rs::prelude::*;
use governance::VersionedContract;
use near_sdk::test_utils::accounts;
use near_sdk::NearToken;

use crate::helpers::{build_context};

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 001 successful initialization.")]
#[allure_test]
fn ut_init_001_successful_initialization() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    let contract = VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
    assert!(contract.is_admin(accounts(0)));
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 002 reject empty admins.")]
#[should_panic(expected = "ERR_NO_ADMINS")]
#[allure_test]
fn ut_init_002_reject_empty_admins() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 003 quorum bps min.")]
#[allure_test]
fn ut_init_003_quorum_bps_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        1,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 003 quorum bps max.")]
#[allure_test]
fn ut_init_003_quorum_bps_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        10_000,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 003b quorum bps below min.")]
#[should_panic(expected = "ERR_QUORUM_BPS_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_003b_quorum_bps_below_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        0,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 003c quorum bps above max.")]
#[should_panic(expected = "ERR_QUORUM_BPS_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_003c_quorum_bps_above_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        10_001,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 004 voting period min.")]
#[allure_test]
fn ut_init_004_voting_period_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 004 voting period max.")]
#[allure_test]
fn ut_init_004_voting_period_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        7_776_000,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 004b voting period below min.")]
#[should_panic(expected = "ERR_VOTING_PERIOD_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_004b_voting_period_below_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        59,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 004c voting period above max.")]
#[should_panic(expected = "ERR_VOTING_PERIOD_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_004c_voting_period_above_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        7_776_001,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 005 pending expiry min.")]
#[allure_test]
fn ut_init_005_pending_expiry_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 005 pending expiry max.")]
#[allure_test]
fn ut_init_005_pending_expiry_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        86_400,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 005b pending expiry below min.")]
#[should_panic(expected = "ERR_PENDING_EXPIRY_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_005b_pending_expiry_below_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        9,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 005c pending expiry above max.")]
#[should_panic(expected = "ERR_PENDING_EXPIRY_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_005c_pending_expiry_above_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        86_401,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 006 min proposal bond min.")]
#[allure_test]
fn ut_init_006_min_proposal_bond_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 006 min proposal bond max.")]
#[allure_test]
fn ut_init_006_min_proposal_bond_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(100),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 006b min bond below min.")]
#[should_panic(expected = "ERR_MIN_BOND_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_006b_min_bond_below_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(9),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 006c min bond above max.")]
#[should_panic(expected = "ERR_MIN_BOND_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_006c_min_bond_above_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(101),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 007 grace period min.")]
#[allure_test]
fn ut_init_007_grace_period_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 007 grace period max.")]
#[allure_test]
fn ut_init_007_grace_period_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        86_400,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 007b grace period below min.")]
#[should_panic(expected = "ERR_GRACE_PERIOD_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_007b_grace_period_below_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        9,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 007c grace period above max.")]
#[should_panic(expected = "ERR_GRACE_PERIOD_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_007c_grace_period_above_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        86_401,
        60,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 008 max start delay min.")]
#[allure_test]
fn ut_init_008_max_start_delay_min() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        0,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 008 max start delay max.")]
#[allure_test]
fn ut_init_008_max_start_delay_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        7_776_000,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 008b max start delay above max.")]
#[should_panic(expected = "ERR_MAX_START_DELAY_OUT_OF_RANGE")]
#[allure_test]
fn ut_init_008b_max_start_delay_above_max() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        7_776_001,
    );
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Initialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "initialization")]
#[allure_description("Verifies init 009 duplicate admins deduped.")]
#[allure_test]
fn ut_init_009_duplicate_admins_deduped() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    let contract = VersionedContract::new(
        accounts(1),
        vec![accounts(0), accounts(0), accounts(2)],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );

    let admins = contract.list_admins(0, 10);
    assert_eq!(admins.len(), 2);
}
