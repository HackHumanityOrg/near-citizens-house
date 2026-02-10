use allure_rs::prelude::*;
use governance::VersionedContract;
use near_sdk::test_utils::accounts;
use near_sdk::{env, NearToken};

use crate::helpers::{build_context};

fn write_state_with_admin(admin: near_sdk::AccountId) {
    let mut state = VersionedContract::new(
        accounts(1),
        vec![admin.clone()],
        700,
        60,
        10,
        NearToken::from_millinear(10),
        10,
        60,
    );
    env::state_write(&state);
    // Ensure the admin set is present in storage for state_read in migrate().
    let VersionedContract::V1(ref mut c) = state;
    c.admins.insert(admin);
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Migration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "migration")]
#[allure_description("Verifies mig 001 migrate without one yocto.")]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
#[allure_test]
fn ut_mig_001_migrate_without_one_yocto() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    write_state_with_admin(accounts(0));

    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    VersionedContract::migrate();
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Migration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "migration")]
#[allure_description("Verifies mig 002 migrate non admin with one yocto.")]
#[should_panic(expected = "ERR_NOT_ADMIN")]
#[allure_test]
fn ut_mig_002_migrate_non_admin_with_one_yocto() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    write_state_with_admin(accounts(0));

    let mut builder = build_context(accounts(2));
    builder.attached_deposit(NearToken::from_yoctonear(1));
    crate::helpers::set_context(builder);
    VersionedContract::migrate();
}

#[test]
#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Governance Unit Tests")]
#[allure_sub_suite("Migration")]
#[allure_severity("normal")]
#[allure_tags("unit", "governance", "migration")]
#[allure_description("Verifies mig 003 migrate admin with one yocto.")]
#[allure_test]
fn ut_mig_003_migrate_admin_with_one_yocto() {
    let builder = build_context(accounts(0));
    crate::helpers::set_context(builder);
    write_state_with_admin(accounts(0));

    let mut builder = build_context(accounts(0));
    builder.attached_deposit(NearToken::from_yoctonear(1));
    crate::helpers::set_context(builder);
    let migrated = VersionedContract::migrate();
    assert!(migrated.is_admin(accounts(0)));
}
