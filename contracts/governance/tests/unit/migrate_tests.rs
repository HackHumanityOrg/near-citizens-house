use governance::VersionedContract;
use near_sdk::test_utils::accounts;
use near_sdk::{env, NearToken};

use crate::helpers::{build_context, set_context};

fn write_state_with_admin(admin: near_sdk::AccountId) {
    let mut state = VersionedContract::new(
        accounts(1),
        vec![admin.clone()],
        700,
        60,
        10,
        NearToken::from_near(1),
        10,
        60,
    );
    env::state_write(&state);
    // Ensure the admin set is present in storage for state_read in migrate().
    let VersionedContract::V1(ref mut c) = state;
    c.admins.insert(admin);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn ut_mig_001_migrate_without_one_yocto() {
    let builder = build_context(accounts(0));
    set_context(builder);
    write_state_with_admin(accounts(0));

    let builder = build_context(accounts(0));
    set_context(builder);
    VersionedContract::migrate();
}

#[test]
#[should_panic(expected = "ERR_NOT_ADMIN")]
fn ut_mig_002_migrate_non_admin_with_one_yocto() {
    let builder = build_context(accounts(0));
    set_context(builder);
    write_state_with_admin(accounts(0));

    let mut builder = build_context(accounts(2));
    builder.attached_deposit(NearToken::from_yoctonear(1));
    set_context(builder);
    VersionedContract::migrate();
}

#[test]
fn ut_mig_003_migrate_admin_with_one_yocto() {
    let builder = build_context(accounts(0));
    set_context(builder);
    write_state_with_admin(accounts(0));

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_yoctonear(1));
    set_context(builder);
    let migrated = VersionedContract::migrate();
    assert!(migrated.is_admin(accounts(0)));
}
