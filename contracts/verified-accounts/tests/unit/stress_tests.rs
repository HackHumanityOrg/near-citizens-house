//! Stress tests for verified-accounts contract
//!
//! Verify behavior at maximum capacity

use super::helpers::{create_signer, create_valid_signature, get_context};
use allure_rs::prelude::*;
use near_sdk::test_utils::accounts;
use near_sdk::testing_env;
use verified_accounts::VersionedContract;

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Verified Accounts Unit Tests")]
#[allure_sub_suite("Stress Tests")]
#[allure_severity("normal")]
#[allure_tags("unit", "stress", "boundary")]
#[allure_description("Verifies that store_verification accepts maximum-length inputs for SumSub applicant ID and user context data.")]
#[allure_test]
#[test]
fn test_stress_max_length_inputs() {
    let (mut contract, user, sig_data) = step("Initialize contract with valid signature", || {
        let backend = accounts(1);
        let user = accounts(2);
        let context = get_context(backend.clone());
        testing_env!(context.build());
        let contract = VersionedContract::new(backend);
        let signer = create_signer(&user);
        let sig_data =
            create_valid_signature(&signer, &user, "Identify myself", &[1; 32], &accounts(0));
        (contract, user, sig_data)
    });

    step("Store verification with maximum-length inputs", || {
        // Maximum SumSub applicant ID is 80 characters
        let max_sumsub_applicant_id = "s".repeat(80);
        // Maximum user context data is 4096 characters
        let max_user_context = "c".repeat(4096);

        contract.store_verification(
            max_sumsub_applicant_id,
            user.clone(),
            sig_data,
            max_user_context,
        );
    });

    step("Verify account is stored correctly", || {
        assert!(contract.is_verified(user.clone()));
        assert_eq!(contract.get_verified_count(), 1);

        let verification = contract.get_verification(user).unwrap();
        assert_eq!(verification.sumsub_applicant_id.len(), 80);
    });
}
