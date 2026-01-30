//! Validation tests for verified-accounts interface types

use allure_rs::prelude::*;
use verified_accounts::interface::*;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_verification_summary_json_missing_near_account_id_fails() {
    // JSON without required "near_account_id" field should fail deserialization
    let json = r#"{"verified_at":0}"#;
    let result: Result<VerificationSummary, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when near_account_id is missing"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_verification_json_missing_user_context_data_fails() {
    // JSON without required "user_context_data" field should fail deserialization
    let json = r#"{"near_account_id":"test.near","verified_at":0}"#;
    let result: Result<Verification, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when user_context_data is missing"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_verification_summary_json_invalid_timestamp_type_fails() {
    // verified_at should be a number, not a string
    let json = r#"{"near_account_id":"test.near","verified_at":"not_a_number"}"#;
    let result: Result<VerificationSummary, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when verified_at is not a number"
    );
}
