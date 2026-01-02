# Test Fixtures

This directory contains pre-built WASM artifacts for versioning integration tests.

## Directory Structure

```
fixtures/
├── v1/
│   └── verified_accounts.wasm  # Production build (no feature flags)
└── v2/
    └── verified_accounts.wasm  # Upgrade simulation build (--features upgrade-simulation)
```

## Purpose

These fixtures enable testing the contract upgrade path:

1. **V1 WASM**: The production contract without any upgrade simulation features
2. **V2 WASM**: The contract with `upgrade-simulation` feature enabled, which includes:
   - `ContractV2` with `total_verifications_stored` field
   - `VerificationV2` with `nationality_disclosed` field

## Rebuilding Fixtures

Run the build script whenever you make changes that affect versioning:

```bash
./scripts/build_test_fixtures.sh
```

This will:

1. Build V1 (default features)
2. Build V2 (with `upgrade-simulation` feature)
3. Copy both to this directory
4. Verify they have different checksums

## Versioning Tests

The fixtures are used by `tests/integration/versioning_tests.rs` to test:

- V1 data remains readable after upgrading to V2 code
- Contract state (backend_wallet, paused, etc.) persists across upgrades
- Nullifier and signature protection works across versions
- New V2 fields have sensible defaults for migrated V1 data

## Important Notes

- **Commit these files to git** - Tests depend on them
- **Rebuild after version changes** - If you modify versioning logic, rebuild fixtures
- **Different checksums expected** - V1 and V2 should have different SHA256 hashes
