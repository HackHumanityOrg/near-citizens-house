//! Access control tests for verified-accounts contract

use super::helpers::{assert_panic_with, get_context, test_self_proof};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::{Contract, NearSignatureData};

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Access Control")]
#[allure_severity("critical")]
#[allure_tags("unit", "security", "authorization")]
#[allure_test]
#[test]
fn test_unauthorized_write() {
    let context = get_context(accounts(0));
    testing_env!(context.build());

    let mut contract = Contract::new(accounts(1));

    assert_panic_with(
        || {
            let public_key_str = "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847";
            let sig_data = NearSignatureData {
                account_id: accounts(2),
                signature: vec![0; 64],
                public_key: public_key_str.parse().unwrap(),
                challenge: "test".to_string(),
                nonce: vec![0; 32],
                recipient: accounts(2),
            };

            contract.store_verification(
                "test_nullifier".to_string(),
                accounts(2),
                "user1".to_string(),
                "1".to_string(),
                sig_data,
                test_self_proof(),
                "test_user_context_data".to_string(),
            );
        },
        "Only backend wallet can store verifications",
    );
}
