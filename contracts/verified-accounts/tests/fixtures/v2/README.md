# V2 Test Fixture

This directory contains a **demonstration** of the upgrade pattern for the verified-accounts contract.

## Purpose

This fixture is used exclusively for **integration testing** of contract upgrades. It is **NOT production-ready V2 code**.

The fixture demonstrates:

- Adding `ContractV2` with a new `upgrade_timestamp` field
- Adding `VerificationV2` with a new `nationality_disclosed` field
- Lazy migration via `contract_mut()` and `into_current()`
- Storage key preservation using `std::mem::replace()`

## Changes from V1

| Component        | V1                 | V2 (Fixture)                       |
| ---------------- | ------------------ | ---------------------------------- |
| `ContractV1`     | Current production | Same                               |
| `ContractV2`     | N/A                | Adds `upgrade_timestamp: u64`      |
| `VerificationV1` | Current production | Same                               |
| `VerificationV2` | N/A                | Adds `nationality_disclosed: bool` |

## Usage

The fixture is built and used in `tests/integration/versioning_tests.rs` to validate:

1. V1 data persists after V2 code deployment
2. Lazy migration correctly upgrades records on access
3. New V2 fields get sensible defaults for migrated V1 records
4. Storage keys remain stable across upgrades

## Building

```bash
cd tests/fixtures/v2
cargo near build reproducible-wasm
```

> `reproducible-wasm` builds use the committed source; ensure the repo is clean before building fixtures.

The WASM output is used by integration tests to simulate contract upgrades.
