//! Storage key stability tests for verified-accounts contract
//!
//! These tests ensure that enum discriminants (used as storage prefixes) remain
//! stable across contract versions. Borsh serializes enums with a 1-byte
//! discriminant based on declaration order.
//!
//! **CRITICAL:** If these tests fail, on-chain data will be corrupted after upgrade!

use allure_rs::prelude::*;
use verified_accounts::interface::VerificationV1;
use verified_accounts::{SelfProofData, StorageKey, VersionedVerification, ZkProof};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Storage Stability")]
#[allure_severity("critical")]
#[allure_tags("unit", "storage", "stability", "borsh")]
#[allure_description(
    r#"
## Purpose
Verifies that StorageKey enum discriminants remain constant across contract versions.
These discriminants are used as storage prefixes for NEAR SDK collections.

## Why This Matters
- If StorageKey::Nullifiers changes from 0x00 to 0x01, all existing nullifiers become orphaned
- This is a **silent data corruption** bug - contract deploys but data is lost
- Borsh uses enum declaration order to assign discriminants (0x00, 0x01, 0x02...)

## Expected Values
- Nullifiers: 0x00
- Accounts: 0x01
"#
)]
#[allure_test]
#[test]
fn test_storage_key_discriminants_are_stable() {
    // Serialize each variant and check the discriminant byte (first byte)
    let nullifiers_bytes =
        near_sdk::borsh::to_vec(&StorageKey::Nullifiers).expect("Nullifiers should serialize");
    let accounts_bytes =
        near_sdk::borsh::to_vec(&StorageKey::Accounts).expect("Accounts should serialize");

    assert_eq!(
        nullifiers_bytes.first().copied(),
        Some(0x00),
        "StorageKey::Nullifiers discriminant changed! This will corrupt nullifier data."
    );
    assert_eq!(
        accounts_bytes.first().copied(),
        Some(0x01),
        "StorageKey::Accounts discriminant changed! This will corrupt verification data."
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Storage Stability")]
#[allure_severity("critical")]
#[allure_tags("unit", "storage", "stability", "borsh", "versioning")]
#[allure_description(
    r#"
## Purpose
Verifies that VersionedVerification enum discriminants remain constant for record migration.

## Why This Matters
- If VersionedVerification::V1 discriminant changes, existing records become unreadable
- Lazy migration relies on correctly deserializing V1 records

## Expected Values
- V1: 0x00
"#
)]
#[allure_test]
#[test]
fn test_versioned_verification_discriminants_are_stable() {
    // Create a minimal V1 verification for testing
    let v1 = VersionedVerification::V1(VerificationV1 {
        nullifier: "test".to_string(),
        near_account_id: "test.near".parse().expect("valid account"),
        attestation_id: "1".to_string(),
        verified_at: 0,
        self_proof: SelfProofData {
            proof: ZkProof {
                a: ["0".to_string(), "0".to_string()],
                b: [
                    ["0".to_string(), "0".to_string()],
                    ["0".to_string(), "0".to_string()],
                ],
                c: ["0".to_string(), "0".to_string()],
            },
            public_signals: vec![],
        },
        user_context_data: String::new(),
    });
    let v1_bytes = near_sdk::borsh::to_vec(&v1).expect("V1 should serialize");

    assert_eq!(
        v1_bytes.first().copied(),
        Some(0x00),
        "VersionedVerification::V1 discriminant changed! Existing records will be unreadable."
    );
}
