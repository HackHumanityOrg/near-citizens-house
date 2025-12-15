//! Description validation tests for sputnik-bridge contract

use super::helpers::{assert_panic_with, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use sputnik_bridge::SputnikBridge;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "proposal")]
#[allure_description("Verifies that creating a proposal with an empty description fails.")]
#[allure_test]
#[test]
fn test_create_proposal_empty_description_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.create_proposal("".to_string());
        },
        "Description cannot be empty",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "proposal")]
#[allure_description("Verifies that creating a proposal with a whitespace-only description fails.")]
#[allure_test]
#[test]
fn test_create_proposal_whitespace_only_description_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    assert_panic_with(
        || {
            let _ = contract.create_proposal("   \t\n  ".to_string());
        },
        "Description cannot be empty",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "boundary")]
#[allure_description("Verifies that a description with 9,999 characters (one less than limit) passes validation.")]
#[allure_test]
#[test]
fn test_description_boundary_limit_minus_1_passes() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    let description = "x".repeat(9999);
    assert_eq!(description.len(), 9999);
    let _ = contract.create_proposal(description);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "boundary")]
#[allure_description("Verifies that a description with exactly 10,000 characters (at limit) passes validation.")]
#[allure_test]
#[test]
fn test_description_boundary_at_limit_passes() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    let description = "x".repeat(10000);
    assert_eq!(description.len(), 10000);
    let _ = contract.create_proposal(description);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "boundary")]
#[allure_description("Verifies that a description with 10,001 characters (one more than limit) fails validation.")]
#[allure_test]
#[test]
fn test_description_boundary_limit_plus_1_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    let too_long = "x".repeat(10001);
    assert_eq!(too_long.len(), 10001);
    assert_panic_with(
        || {
            let _ = contract.create_proposal(too_long);
        },
        "Description exceeds maximum length",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("minor")]
#[allure_tags("unit", "validation", "boundary", "edge-case")]
#[allure_description("Verifies that a single-character description passes validation.")]
#[allure_test]
#[test]
fn test_description_boundary_single_char_passes() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    let _ = contract.create_proposal("x".to_string());
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Description Validation")]
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "negative")]
#[allure_description("Verifies that creating a proposal with a description exceeding maximum length fails.")]
#[allure_test]
#[test]
fn test_create_proposal_description_over_max_fails() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract =
        SputnikBridge::new(accounts(0), accounts(1), accounts(2), "citizen".to_string());

    let too_long = "x".repeat(10001);
    assert_panic_with(
        || {
            let _ = contract.create_proposal(too_long);
        },
        "Description exceeds maximum length",
    );
}
