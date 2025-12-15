//! Constants validation tests for sputnik-bridge contract

use allure_rs::prelude::*;
use sputnik_bridge::{
    GAS_FOR_ADD_PROPOSAL, GAS_FOR_CALLBACK, GAS_FOR_VERIFICATION, MAX_DESCRIPTION_LEN,
    QUORUM_PERCENT,
};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Constants")]
#[allure_severity("normal")]
#[allure_tags("unit", "constants", "gas")]
#[allure_test]
#[test]
fn test_gas_constants_are_reasonable() {
    // Verify gas allocations are within expected ranges
    assert!(GAS_FOR_VERIFICATION.as_tgas() >= 5);
    assert!(GAS_FOR_ADD_PROPOSAL.as_tgas() >= 20);
    assert!(GAS_FOR_CALLBACK.as_tgas() >= 10);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Constants")]
#[allure_severity("minor")]
#[allure_tags("unit", "constants")]
#[allure_test]
#[test]
fn test_max_description_length_constant() {
    // Verify the constant is as documented
    assert_eq!(MAX_DESCRIPTION_LEN, 10_000);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Constants")]
#[allure_severity("critical")]
#[allure_tags("unit", "constants", "quorum")]
#[allure_test]
#[test]
fn test_quorum_percent_constant() {
    // Verify the quorum percentage is 7%
    assert_eq!(QUORUM_PERCENT, 7);
}
