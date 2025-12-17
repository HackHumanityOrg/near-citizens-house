//! Unit tests for sputnik-bridge contract
//!
//! Run with: cargo test --features testing --test unit

#![cfg(feature = "testing")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic, clippy::indexing_slicing)]

#[path = "unit/helpers.rs"]
pub mod helpers;

#[path = "unit/initialization_tests.rs"]
mod initialization_tests;

#[path = "unit/read_functions_tests.rs"]
mod read_functions_tests;

#[path = "unit/backend_wallet_tests.rs"]
mod backend_wallet_tests;

#[path = "unit/quorum_tests.rs"]
mod quorum_tests;

#[path = "unit/description_validation_tests.rs"]
mod description_validation_tests;

#[path = "unit/events_tests.rs"]
mod events_tests;

#[path = "unit/constants_tests.rs"]
mod constants_tests;

#[path = "unit/invariants_tests.rs"]
mod invariants_tests;

#[path = "unit/callbacks_tests.rs"]
mod callbacks_tests;

#[path = "unit/access_control_tests.rs"]
mod access_control_tests;

#[path = "unit/write_functions_tests.rs"]
mod write_functions_tests;
