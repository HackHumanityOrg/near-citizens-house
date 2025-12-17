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
#[allure_description("Verifies gas constants are within reasonable ranges for contract operations.")]
#[allure_test]
#[test]
fn test_gas_constants_are_reasonable() {
    step("Verify GAS_FOR_VERIFICATION is at least 5 TGas", || {
        assert!(GAS_FOR_VERIFICATION.as_tgas() >= 5);
    });

    step("Verify GAS_FOR_ADD_PROPOSAL is at least 20 TGas", || {
        assert!(GAS_FOR_ADD_PROPOSAL.as_tgas() >= 20);
    });

    step("Verify GAS_FOR_CALLBACK is at least 10 TGas", || {
        assert!(GAS_FOR_CALLBACK.as_tgas() >= 10);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Constants")]
#[allure_severity("minor")]
#[allure_tags("unit", "constants")]
#[allure_description("Verifies MAX_DESCRIPTION_LENGTH constant has expected value of 10,000 characters.")]
#[allure_test]
#[test]
fn test_max_description_length_constant() {
    step("Verify MAX_DESCRIPTION_LEN equals 10,000", || {
        assert_eq!(MAX_DESCRIPTION_LEN, 10_000);
    });
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Constants")]
#[allure_severity("critical")]
#[allure_tags("unit", "constants", "quorum")]
#[allure_description("Verifies QUORUM_PERCENT constant has expected value of 7%.")]
#[allure_test]
#[test]
fn test_quorum_percent_constant() {
    step("Verify QUORUM_PERCENT equals 7", || {
        assert_eq!(QUORUM_PERCENT, 7);
    });
}
