use governance::VersionedContract;
use near_sdk::test_utils::accounts;
use near_sdk::NearToken;

use crate::helpers::{build_context, set_context};

#[test]
fn ut_init_001_successful_initialization() {
    let builder = build_context(accounts(0));
    set_context(builder);
    let contract = VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
    assert!(contract.is_admin(accounts(0)));
}

#[test]
#[should_panic(expected = "ERR_NO_ADMINS")]
fn ut_init_002_reject_empty_admins() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_003_quorum_bps_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        1,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_003_quorum_bps_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        10_000,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_QUORUM_BPS_OUT_OF_RANGE")]
fn ut_init_003b_quorum_bps_below_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        0,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_QUORUM_BPS_OUT_OF_RANGE")]
fn ut_init_003c_quorum_bps_above_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        10_001,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_004_voting_period_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_004_voting_period_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        7_776_000,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_VOTING_PERIOD_OUT_OF_RANGE")]
fn ut_init_004b_voting_period_below_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        59,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_VOTING_PERIOD_OUT_OF_RANGE")]
fn ut_init_004c_voting_period_above_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        7_776_001,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_005_pending_expiry_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_005_pending_expiry_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        86_400,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_PENDING_EXPIRY_OUT_OF_RANGE")]
fn ut_init_005b_pending_expiry_below_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        9,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_PENDING_EXPIRY_OUT_OF_RANGE")]
fn ut_init_005c_pending_expiry_above_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        86_401,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_006_min_proposal_bond_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_006_min_proposal_bond_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
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
#[should_panic(expected = "ERR_MIN_BOND_OUT_OF_RANGE")]
fn ut_init_006b_min_bond_below_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_yoctonear(NearToken::from_near(1).as_yoctonear() - 1),
        10,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_MIN_BOND_OUT_OF_RANGE")]
fn ut_init_006c_min_bond_above_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
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
fn ut_init_007_grace_period_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
}

#[test]
fn ut_init_007_grace_period_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        86_400,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_GRACE_PERIOD_OUT_OF_RANGE")]
fn ut_init_007b_grace_period_below_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        9,
        60,
    );
}

#[test]
#[should_panic(expected = "ERR_GRACE_PERIOD_OUT_OF_RANGE")]
fn ut_init_007c_grace_period_above_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        86_401,
        60,
    );
}

#[test]
fn ut_init_008_max_start_delay_min() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        0,
    );
}

#[test]
fn ut_init_008_max_start_delay_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        7_776_000,
    );
}

#[test]
#[should_panic(expected = "ERR_MAX_START_DELAY_OUT_OF_RANGE")]
fn ut_init_008b_max_start_delay_above_max() {
    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::new(
        accounts(1),
        vec![accounts(0)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        7_776_001,
    );
}

#[test]
fn ut_init_009_duplicate_admins_deduped() {
    let builder = build_context(accounts(0));
    set_context(builder);
    let contract = VersionedContract::new(
        accounts(1),
        vec![accounts(0), accounts(0), accounts(2)],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );

    let admins = contract.list_admins(0, 10);
    assert_eq!(admins.len(), 2);
}
