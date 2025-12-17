//! Integration tests for verified-accounts contract
//!
//! Run with: cargo test --features integration-tests --test integration

#![cfg(feature = "integration-tests")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

#[path = "integration/helpers.rs"]
pub mod helpers;

#[path = "integration/initialization_tests.rs"]
mod initialization_tests;

#[path = "integration/read_functions_tests.rs"]
mod read_functions_tests;

#[path = "integration/access_control_tests.rs"]
mod access_control_tests;

#[path = "integration/pause_tests.rs"]
mod pause_tests;

#[path = "integration/input_validation_tests.rs"]
mod input_validation_tests;

#[path = "integration/signature_verification_tests.rs"]
mod signature_verification_tests;

#[path = "integration/pagination_tests.rs"]
mod pagination_tests;

#[path = "integration/security_tests.rs"]
mod security_tests;

#[path = "integration/edge_case_tests.rs"]
mod edge_case_tests;
