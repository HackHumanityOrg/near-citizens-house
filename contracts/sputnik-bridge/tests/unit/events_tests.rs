//! Event serialization tests for sputnik-bridge contract

use allure_rs::prelude::*;
use sputnik_bridge::{MemberAddedEvent, ProposalCreatedEvent, QuorumUpdatedEvent};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "events", "serialization")]
#[allure_description("Verifies that MemberAddedEvent serializes correctly to JSON.")]
#[allure_test]
#[test]
fn test_member_added_event_serializes_correctly() {
    let event = MemberAddedEvent {
        member_id: "alice.near".to_string(),
        role: "citizen".to_string(),
        proposal_id: 42,
    };

    let json = near_sdk::serde_json::to_string(&event).unwrap();
    assert!(json.contains("\"member_id\":\"alice.near\""));
    assert!(json.contains("\"role\":\"citizen\""));
    assert!(json.contains("\"proposal_id\":42"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "events", "serialization")]
#[allure_description("Verifies that ProposalCreatedEvent serializes correctly to JSON.")]
#[allure_test]
#[test]
fn test_proposal_created_event_serializes_correctly() {
    let event = ProposalCreatedEvent {
        proposal_id: 123,
        description: "Test proposal description".to_string(),
    };

    let json = near_sdk::serde_json::to_string(&event).unwrap();
    assert!(json.contains("\"proposal_id\":123"));
    assert!(json.contains("\"description\":\"Test proposal description\""));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Events")]
#[allure_severity("normal")]
#[allure_tags("unit", "events", "serialization")]
#[allure_description("Verifies that QuorumUpdatedEvent serializes correctly to JSON.")]
#[allure_test]
#[test]
fn test_quorum_updated_event_serializes_correctly() {
    let event = QuorumUpdatedEvent {
        citizen_count: 100,
        new_quorum: 7,
        proposal_id: 456,
    };

    let json = near_sdk::serde_json::to_string(&event).unwrap();
    assert!(json.contains("\"citizen_count\":100"));
    assert!(json.contains("\"new_quorum\":7"));
    assert!(json.contains("\"proposal_id\":456"));
}
