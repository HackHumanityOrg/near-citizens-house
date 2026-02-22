//! Unit tests for governance contract
//!
//! Run with: cargo test --features testing --test unit

#![allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::arithmetic_side_effects,
    clippy::indexing_slicing
)]

#[path = "unit/helpers.rs"]
pub mod helpers;

#[path = "unit/initialization_tests.rs"]
mod initialization_tests;

#[path = "unit/admin_tests.rs"]
mod admin_tests;

#[path = "unit/proposal_tests.rs"]
mod proposal_tests;

#[path = "unit/voting_tests.rs"]
mod voting_tests;

#[path = "unit/blocklist_tests.rs"]
mod blocklist_tests;

#[path = "unit/config_tests.rs"]
mod config_tests;

#[path = "unit/view_tests.rs"]
mod view_tests;

#[path = "unit/callback_tests.rs"]
mod callback_tests;

#[path = "unit/json_event_tests.rs"]
mod json_event_tests;

#[path = "unit/migrate_tests.rs"]
mod migrate_tests;
