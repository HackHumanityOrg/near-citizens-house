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
fn test_verified_account_info_json_missing_nullifier_fails() {
    // JSON without required "nullifier" field should fail deserialization
    let json =
        r#"{"near_account_id":"test.near","user_id":"u","attestation_id":"1","verified_at":0}"#;
    let result: Result<VerifiedAccountInfo, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when nullifier is missing"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_zk_proof_json_invalid_a_array_length_fails() {
    // 'a' should have exactly 2 elements, not 1
    let json = r#"{"a":["1"],"b":[["1","2"],["3","4"]],"c":["1","2"]}"#;
    let result: Result<ZkProof, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when 'a' has wrong array length"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_self_proof_data_invalid_proof_type_fails() {
    // 'proof' should be an object, not a string
    let json = r#"{"proof":"not_an_object","public_signals":[]}"#;
    let result: Result<SelfProofData, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when 'proof' is not an object"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Validation")]
#[allure_severity("normal")]
#[allure_tags("unit", "validation", "negative")]
#[allure_test]
#[test]
fn test_zk_proof_json_missing_b_field_fails() {
    // Missing 'b' field should fail
    let json = r#"{"a":["1","2"],"c":["1","2"]}"#;
    let result: Result<ZkProof, _> = near_sdk::serde_json::from_str(json);
    assert!(
        result.is_err(),
        "Deserialization should fail when 'b' field is missing"
    );
}
