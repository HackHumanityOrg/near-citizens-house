//! Validation tests for sputnik-dao-interface types

use allure_rs::prelude::*;
use sputnik_dao_interface::*;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_proposal_kind_unknown_variant_deserialization_fails() {
    // Unknown enum variant should fail deserialization
    let json = r#"{"UnknownVariant":{}}"#;
    let result: Result<ProposalKind, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail for unknown ProposalKind variant"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_action_invalid_string_deserialization_fails() {
    // Invalid Action variant should fail deserialization
    let json = r#""InvalidAction""#;
    let result: Result<Action, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail for invalid Action string"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_weight_or_ratio_empty_array_fails() {
    // WeightOrRatio with empty array should fail
    let json = r#"[]"#;
    let result: Result<WeightOrRatio, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail for empty WeightOrRatio array"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_role_permission_missing_name_fails() {
    // RolePermission without required 'name' field should fail
    let json = r#"{"kind":"Everyone","permissions":[],"vote_policy":{}}"#;
    let result: Result<RolePermission, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when 'name' is missing"
    );
}
