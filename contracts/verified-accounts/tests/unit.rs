//! Unit tests for verified-accounts contract
//!
//! Run with: cargo test --features testing --test unit

#![cfg(feature = "testing")]
#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]

#[path = "unit/helpers.rs"]
pub mod helpers;

#[path = "unit/initialization_tests.rs"]
mod initialization_tests;

#[path = "unit/access_control_tests.rs"]
mod access_control_tests;

#[path = "unit/signature_tests.rs"]
mod signature_tests;

#[path = "unit/pause_tests.rs"]
mod pause_tests;

#[path = "unit/backend_wallet_tests.rs"]
mod backend_wallet_tests;

#[path = "unit/read_functions_tests.rs"]
mod read_functions_tests;

#[path = "unit/composability_tests.rs"]
mod composability_tests;

#[path = "unit/input_validation_tests.rs"]
mod input_validation_tests;

#[path = "unit/invariants_tests.rs"]
mod invariants_tests;

#[path = "unit/stress_tests.rs"]
mod stress_tests;

#[path = "unit/store_verification_tests.rs"]
mod store_verification_tests;

#[path = "unit/interface_serialization_tests.rs"]
mod interface_serialization_tests;

#[path = "unit/interface_validation_tests.rs"]
mod interface_validation_tests;

#[path = "unit/storage_stability_tests.rs"]
mod storage_stability_tests;
