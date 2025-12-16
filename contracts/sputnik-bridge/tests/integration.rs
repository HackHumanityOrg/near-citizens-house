//! Integration tests for sputnik-bridge contract
//!
//! Run with: cargo test --features integration-tests --test integration

#![cfg(feature = "integration-tests")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

#[path = "integration/helpers.rs"]
pub mod helpers;

#[path = "integration/setup_tests.rs"]
mod setup_tests;

#[path = "integration/admin_tests.rs"]
mod admin_tests;

#[path = "integration/member_addition_tests.rs"]
mod member_addition_tests;

#[path = "integration/proposal_tests.rs"]
mod proposal_tests;

#[path = "integration/voting_tests.rs"]
mod voting_tests;

#[path = "integration/dynamic_quorum_tests.rs"]
mod dynamic_quorum_tests;

#[path = "integration/edge_case_tests.rs"]
mod edge_case_tests;

#[path = "integration/security_tests.rs"]
mod security_tests;

#[path = "integration/failure_handling_tests.rs"]
mod failure_handling_tests;

#[path = "integration/state_consistency_tests.rs"]
mod state_consistency_tests;
