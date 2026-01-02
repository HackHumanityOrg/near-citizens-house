//! Serialization tests for sputnik-dao interface types

use allure_rs::prelude::*;
use near_sdk::json_types::U128;
use sputnik_bridge::sputnik_dao::*;
use std::collections::HashMap;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "serialization", "proposals")]
#[allure_test]
#[test]
fn test_proposal_input_serialization() {
    let input = ProposalInput {
        description: "Test proposal".to_string(),
        kind: ProposalKind::Vote,
    };

    // Test JSON serialization
    let json = near_sdk::serde_json::to_string(&input).unwrap();
    assert!(json.contains("Test proposal"));
    assert!(json.contains("Vote"));

    // Verify it can be deserialized
    let decoded: ProposalInput = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.description, input.description);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "serialization", "membership")]
#[allure_test]
#[test]
fn test_add_member_to_role_serialization() {
    let input = ProposalInput {
        description: "Add new member".to_string(),
        kind: ProposalKind::AddMemberToRole {
            member_id: "alice.near".parse().unwrap(),
            role: "citizen".to_string(),
        },
    };

    let json = near_sdk::serde_json::to_string(&input).unwrap();
    assert!(json.contains("alice.near"));
    assert!(json.contains("citizen"));
    assert!(json.contains("AddMemberToRole"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "voting")]
#[allure_test]
#[test]
fn test_action_serialization() {
    let action = Action::VoteApprove;
    let json = near_sdk::serde_json::to_string(&action).unwrap();
    assert!(json.contains("VoteApprove"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "serialization", "policy")]
#[allure_test]
#[test]
fn test_change_policy_add_or_update_role_serialization() {
    let mut vote_policy = HashMap::new();
    vote_policy.insert(
        "vote".to_string(),
        VotePolicy {
            weight_kind: WeightKind::RoleWeight,
            quorum: U128(0),
            threshold: WeightOrRatio::Ratio(7, 100),
        },
    );

    let input = ProposalInput {
        description: "Update citizen role threshold".to_string(),
        kind: ProposalKind::ChangePolicyAddOrUpdateRole {
            role: RolePermission {
                name: "citizen".to_string(),
                kind: RoleKind::Group(vec!["alice.near".parse().unwrap()]),
                permissions: vec!["vote:VoteApprove".to_string()],
                vote_policy,
            },
        },
    };

    let json = near_sdk::serde_json::to_string(&input).unwrap();
    assert!(json.contains("ChangePolicyAddOrUpdateRole"));
    assert!(json.contains("citizen"));
    assert!(json.contains("alice.near"));

    // Verify it can be deserialized
    let decoded: ProposalInput = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.description, input.description);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "voting")]
#[allure_test]
#[test]
fn test_all_action_variants_serialization() {
    // Test all Action variants serialize correctly
    let actions = vec![
        (Action::VoteApprove, "VoteApprove"),
        (Action::VoteReject, "VoteReject"),
        (Action::VoteRemove, "VoteRemove"),
        (Action::Finalize, "Finalize"),
        (Action::MoveToHub, "MoveToHub"),
    ];

    for (action, expected_str) in actions {
        let json = near_sdk::serde_json::to_string(&action).unwrap();
        assert!(
            json.contains(expected_str),
            "Action {:?} should serialize to contain '{}'",
            action,
            expected_str
        );
    }
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "membership")]
#[allure_test]
#[test]
fn test_remove_member_from_role_serialization() {
    let kind = ProposalKind::RemoveMemberFromRole {
        member_id: "bob.near".parse().unwrap(),
        role: "council".to_string(),
    };

    let json = near_sdk::serde_json::to_string(&kind).unwrap();
    assert!(json.contains("RemoveMemberFromRole"));
    assert!(json.contains("bob.near"));
    assert!(json.contains("council"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "roles")]
#[allure_test]
#[test]
fn test_role_kind_everyone_serialization() {
    let kind = RoleKind::Everyone;
    let json = near_sdk::serde_json::to_string(&kind).unwrap();
    assert!(json.contains("Everyone"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "roles")]
#[allure_test]
#[test]
fn test_role_kind_group_serialization() {
    let kind = RoleKind::Group(vec![
        "alice.near".parse().unwrap(),
        "bob.near".parse().unwrap(),
        "carol.near".parse().unwrap(),
    ]);

    let json = near_sdk::serde_json::to_string(&kind).unwrap();
    assert!(json.contains("alice.near"));
    assert!(json.contains("bob.near"));
    assert!(json.contains("carol.near"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "voting")]
#[allure_test]
#[test]
fn test_weight_kind_serialization() {
    let role_weight = WeightKind::RoleWeight;
    let token_weight = WeightKind::TokenWeight;

    let json1 = near_sdk::serde_json::to_string(&role_weight).unwrap();
    let json2 = near_sdk::serde_json::to_string(&token_weight).unwrap();

    assert!(json1.contains("RoleWeight"));
    assert!(json2.contains("TokenWeight"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "voting")]
#[allure_test]
#[test]
fn test_weight_or_ratio_weight_serialization() {
    let weight = WeightOrRatio::Weight(U128(1000));
    let json = near_sdk::serde_json::to_string(&weight).unwrap();
    assert!(json.contains("1000"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "voting")]
#[allure_test]
#[test]
fn test_weight_or_ratio_ratio_serialization() {
    let ratio = WeightOrRatio::Ratio(1, 2);
    let json = near_sdk::serde_json::to_string(&ratio).unwrap();
    // Ratio serializes as [1,2] due to #[serde(untagged)]
    assert!(json.contains("1"));
    assert!(json.contains("2"));
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "serialization", "voting")]
#[allure_test]
#[test]
fn test_vote_policy_serialization() {
    let policy = VotePolicy {
        weight_kind: WeightKind::RoleWeight,
        quorum: U128(7),
        threshold: WeightOrRatio::Ratio(1, 2),
    };

    let json = near_sdk::serde_json::to_string(&policy).unwrap();
    assert!(json.contains("RoleWeight"));
    assert!(json.contains("\"7\"")); // U128 serializes as string

    // Test roundtrip
    let decoded: VotePolicy = near_sdk::serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.quorum.0, 7);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "borsh")]
#[allure_test]
#[test]
fn test_proposal_input_borsh_roundtrip() {
    let input = ProposalInput {
        description: "Test proposal for Borsh".to_string(),
        kind: ProposalKind::Vote,
    };

    let borsh = near_sdk::borsh::to_vec(&input).unwrap();
    let decoded: ProposalInput = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.description, input.description);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("normal")]
#[allure_tags("unit", "serialization", "borsh")]
#[allure_test]
#[test]
fn test_role_permission_borsh_roundtrip() {
    let role = RolePermission {
        name: "citizen".to_string(),
        kind: RoleKind::Group(vec!["alice.near".parse().unwrap()]),
        permissions: vec![
            "vote:VoteApprove".to_string(),
            "vote:VoteReject".to_string(),
        ],
        vote_policy: HashMap::new(),
    };

    let borsh = near_sdk::borsh::to_vec(&role).unwrap();
    let decoded: RolePermission = near_sdk::borsh::from_slice(&borsh).unwrap();
    assert_eq!(decoded.name, role.name);
    assert_eq!(decoded.permissions.len(), 2);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("critical")]
#[allure_tags("unit", "serialization", "edge-case")]
#[allure_description(
    "Documents serialization behavior for WeightOrRatio::Ratio with zero denominator. \
     This dangerous edge case (potential division-by-zero) is allowed at the type level. \
     Consuming DAO contracts must validate that Ratio denominators are non-zero."
)]
#[allure_test]
#[test]
fn test_weight_or_ratio_zero_denominator_serialization() {
    // Zero denominator could cause division by zero in DAO contract
    // This test documents that serialization allows it
    let ratio = WeightOrRatio::Ratio(1, 0);

    // Test that it serializes (type system allows it)
    let json = near_sdk::serde_json::to_string(&ratio).unwrap();
    assert!(
        json.contains('0'),
        "JSON should contain the zero denominator"
    );

    // Test roundtrip preserves the dangerous value
    let decoded: WeightOrRatio = near_sdk::serde_json::from_str(&json).unwrap();
    if let WeightOrRatio::Ratio(num, denom) = decoded {
        assert_eq!(num, 1);
        assert_eq!(denom, 0, "Zero denominator should survive roundtrip");
        // Note: Actual validation must happen in the consuming DAO contract
    } else {
        panic!("Expected Ratio variant");
    }
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik DAO Interface Tests")]
#[allure_sub_suite("Serialization")]
#[allure_severity("minor")]
#[allure_tags("unit", "serialization", "edge-case")]
#[allure_test]
#[test]
fn test_empty_group_serialization() {
    let kind = RoleKind::Group(vec![]);
    let json = near_sdk::serde_json::to_string(&kind).unwrap();

    let decoded: RoleKind = near_sdk::serde_json::from_str(&json).unwrap();
    if let RoleKind::Group(members) = decoded {
        assert!(members.is_empty());
    } else {
        panic!("Expected Group variant");
    }
}
