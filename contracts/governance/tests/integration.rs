//! Integration tests for governance contract
//!
//! Run with: cargo test --test integration

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]

#[path = "integration/helpers.rs"]
mod helpers;

#[path = "integration/e2e_tests.rs"]
mod e2e_tests;

#[path = "integration/snapshot_tests.rs"]
mod snapshot_tests;

#[path = "integration/vote_async_tests.rs"]
mod vote_async_tests;

#[path = "integration/finalize_tests.rs"]
mod finalize_tests;

#[path = "integration/blocklist_tests.rs"]
mod blocklist_tests;

#[path = "integration/config_tests.rs"]
mod config_tests;

#[path = "integration/view_tests.rs"]
mod view_tests;

#[path = "integration/store_tests.rs"]
mod store_tests;

#[path = "integration/bond_tests.rs"]
mod bond_tests;

#[path = "integration/security_tests.rs"]
mod security_tests;

#[path = "integration/init_tests.rs"]
mod init_tests;

#[path = "integration/migrate_tests.rs"]
mod migrate_tests;

#[path = "integration/event_tests.rs"]
mod event_tests;

#[path = "integration/proposal_tests.rs"]
mod proposal_tests;
