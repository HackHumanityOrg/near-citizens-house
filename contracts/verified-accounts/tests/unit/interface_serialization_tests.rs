//! Serialization tests for verified-accounts interface types

use allure_rs::prelude::*;
use verified_accounts::interface::*;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json", "borsh")]
#[allure_test]
#[test]
fn test_verification_summary_serialization() {
    let summary = VerificationSummary {
        near_account_id: "test.near".parse().unwrap(),
        verified_at: 1234567890,
    };

    // Test JSON serialization
    let json = near_sdk::serde_json::to_string(&summary).unwrap();
    assert!(json.contains("test.near"));

    // Test Borsh serialization
    let borsh = near_sdk::borsh::to_vec(&summary).unwrap();
    let decoded: VerificationSummary = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.near_account_id, summary.near_account_id);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "borsh")]
#[allure_test]
#[test]
fn test_verification_serialization() {
    let verification = Verification {
        near_account_id: "test.near".parse().unwrap(),
        verified_at: 1234567890,
        user_context_data: "context".to_string(),
    };

    // Test Borsh serialization
    let borsh = near_sdk::borsh::to_vec(&verification).unwrap();
    let decoded: Verification = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.near_account_id, verification.near_account_id);
    assert_eq!(decoded.user_context_data, verification.user_context_data);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json")]
#[allure_test]
#[test]
fn test_verification_summary_json_roundtrip() {
    let summary = VerificationSummary {
        near_account_id: "alice.testnet".parse().unwrap(),
        verified_at: 1700000000000000000, // Realistic nanosecond timestamp
    };

    let json = near_sdk::serde_json::to_string(&summary).unwrap();
    let decoded: VerificationSummary = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.near_account_id, summary.near_account_id);
    assert_eq!(decoded.verified_at, summary.verified_at);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "json")]
#[allure_test]
#[test]
fn test_verification_json_roundtrip() {
    let verification = Verification {
        near_account_id: "user.near".parse().unwrap(),
        verified_at: 1700000000000000000,
        user_context_data: "test context data".to_string(),
    };

    let json = near_sdk::serde_json::to_string(&verification).unwrap();
    let decoded: Verification = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.near_account_id, verification.near_account_id);
    assert_eq!(decoded.verified_at, verification.verified_at);
    assert_eq!(decoded.user_context_data, verification.user_context_data);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("minor")]
#[allure_tags("unit", "serialization", "edge-case")]
#[allure_test]
#[test]
fn test_empty_user_context_data() {
    let verification = Verification {
        near_account_id: "test.near".parse().unwrap(),
        verified_at: 0,
        user_context_data: "".to_string(), // Empty context
    };

    let json = near_sdk::serde_json::to_string(&verification).unwrap();
    let decoded: Verification = near_sdk::serde_json::from_str(&json).unwrap();
    assert!(decoded.user_context_data.is_empty());
}
