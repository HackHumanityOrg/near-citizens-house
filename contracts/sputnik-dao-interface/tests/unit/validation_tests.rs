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
#[allure_severity("critical")]
#[allure_tags("unit", "validation", "edge-case")]
#[allure_description(
    "Documents that WeightOrRatio::Ratio allows zero denominator at the type level. \
     This is a dangerous edge case that could cause division-by-zero in consuming contracts. \
     Validation must happen in the DAO contract, not the interface."
)]
#[allure_test]
#[test]
fn test_weight_or_ratio_zero_denominator_allowed() {
    // Zero denominator is type-valid but logically dangerous (division by zero)
    // This test documents that the interface allows it - validation must happen downstream
    let json = r#"[1,0]"#;
    let result: Result<WeightOrRatio, _> = near_sdk::serde_json::from_str(json);

    // Interface allows zero denominator - no validation at this layer
    assert!(
        result.is_ok(),
        "Interface allows zero denominator - validation must happen in DAO contract"
    );

    if let Ok(WeightOrRatio::Ratio(num, denom)) = result {
        assert_eq!(num, 1);
        assert_eq!(denom, 0, "Zero denominator should be preserved");
    } else {
        panic!("Expected Ratio variant with zero denominator");
    }
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
