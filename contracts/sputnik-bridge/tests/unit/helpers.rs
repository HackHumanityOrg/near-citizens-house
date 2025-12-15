//! Shared test utilities for sputnik-bridge unit tests

#![allow(dead_code)]

use near_sdk::test_utils::VMContextBuilder;
use near_sdk::AccountId;

/// Create a test VM context with the given predecessor
pub fn get_context(predecessor: AccountId) -> VMContextBuilder {
    let mut builder = VMContextBuilder::new();
    builder.predecessor_account_id(predecessor);
    builder
}

/// Helper function to assert that a closure panics with the expected message.
/// This allows panic tests to work with allure_test annotations.
pub fn assert_panic_with<F: FnOnce()>(f: F, expected: &str) {
    use std::panic::{catch_unwind, AssertUnwindSafe};
    let result = catch_unwind(AssertUnwindSafe(f));
    match result {
        Ok(_) => panic!("Expected panic with '{}' but no panic occurred", expected),
        Err(err) => {
            let msg = if let Some(s) = err.downcast_ref::<&str>() {
                s.to_string()
            } else if let Some(s) = err.downcast_ref::<String>() {
                s.clone()
            } else {
                format!("{:?}", err)
            };
            assert!(
                msg.contains(expected),
                "Panic message '{}' does not contain expected '{}'",
                msg,
                expected
            );
        }
    }
}
