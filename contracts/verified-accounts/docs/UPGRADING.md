# Contract Upgrade Guide

This document explains how to upgrade the verified-accounts contract and add new fields to either the contract state or verification records.

## Versioning Architecture

The contract uses two levels of versioning:

### 1. Contract State Versioning (`VersionedContract`)

The main contract state is wrapped in an enum to support changes to top-level fields:

```rust
#[near(contract_state)]
pub enum VersionedContract {
    V1(ContractV1),  // Original version
    V2(ContractV2),  // Adds new fields (upgrade-simulation only)
}
```

**Use this when:** Adding new fields to the contract itself (e.g., rate limiting, admin lists, counters).

### 2. Record Versioning (`VersionedVerification`)

Individual verification records use a similar pattern:

```rust
pub enum VersionedVerification {
    V1(VerificationV1),  // Original format
    V2(VerificationV2),  // Adds new fields (upgrade-simulation only)
}
```

**Use this when:** Adding new fields to stored verification records (e.g., new proof fields, metadata).

## Why Both?

| Versioning Level | Purpose                  | Migration Strategy       |
| ---------------- | ------------------------ | ------------------------ |
| Contract State   | Top-level struct changes | Immediate on first write |
| Records          | Per-verification changes | Lazy (on read)           |

Record versioning avoids expensive batch migrations - old records are upgraded only when accessed.

## How to Add a New Field

### Adding a Field to Contract State

1. **Create the new contract struct:**

```rust
// In lib.rs
#[near]
pub struct ContractV2 {
    // All fields from V1
    pub backend_wallet: AccountId,
    pub nullifiers: LookupSet<String>,
    pub verifications: UnorderedMap<AccountId, VersionedVerification>,
    pub paused: bool,
    // NEW field
    pub my_new_field: u64,
}
```

2. **Add the variant to `VersionedContract`:**

```rust
pub enum VersionedContract {
    V1(ContractV1),
    V2(ContractV2),  // Add this
}
```

3. **Update `contract_mut()` to handle migration:**

```rust
fn contract_mut(&mut self) -> &mut ContractV2 {
    let old_contract = match self {
        Self::V2(contract) => return contract,
        Self::V1(contract) => core::mem::take(contract),
    };

    // Migrate V1 -> V2
    *self = Self::V2(ContractV2 {
        backend_wallet: old_contract.backend_wallet,
        nullifiers: old_contract.nullifiers,
        verifications: old_contract.verifications,
        paused: old_contract.paused,
        my_new_field: 0,  // Default value for migrated contracts
    });

    if let Self::V2(contract) = self {
        contract
    } else {
        env::abort()
    }
}
```

4. **Update view methods to handle both versions** (if needed for reads without migration).

### Adding a Field to Verification Records

1. **Create the new verification struct:**

```rust
// In interface.rs
pub struct VerificationV2 {
    // All fields from V1
    pub nullifier: String,
    pub near_account_id: AccountId,
    pub attestation_id: String,
    pub verified_at: u64,
    pub self_proof: SelfProofData,
    pub user_context_data: String,
    // NEW field
    pub my_new_field: bool,
}
```

2. **Add the variant to `VersionedVerification`:**

```rust
pub enum VersionedVerification {
    V1(VerificationV1),
    V2(VerificationV2),  // Add this
}
```

3. **Update `into_current()` to handle migration:**

```rust
pub fn into_current(self) -> VerificationV2 {
    match self {
        Self::V1(v) => VerificationV2 {
            nullifier: v.nullifier,
            near_account_id: v.near_account_id,
            attestation_id: v.attestation_id,
            verified_at: v.verified_at,
            self_proof: v.self_proof,
            user_context_data: v.user_context_data,
            my_new_field: false,  // Default for migrated records
        },
        Self::V2(v) => v,
    }
}
```

4. **Update `From` implementations** for `VerificationSummary` if the summary needs the new field.

## Production Upgrade Process

1. **Test locally:**

   ```bash
   ./scripts/build_test_fixtures.sh
   cargo test --features integration-tests --test integration versioning
   ```

2. **Deploy the new contract code:**

   ```bash
   cargo near build non-reproducible-wasm
   near contract deploy CONTRACT_ID.testnet \
     use-file target/near/verified_accounts.wasm \
     without-init-call \
     network-config testnet sign-with-keychain send
   ```

3. **Verify the upgrade:**
   ```bash
   near view CONTRACT_ID.testnet get_state_version
   near view CONTRACT_ID.testnet get_verified_count
   ```

## Important Rules

### Never Do This

1. **Never reorder enum variants** - Borsh uses discriminants based on declaration order
2. **Never remove fields from old structs** - They're needed to deserialize existing data
3. **Never change field types** - Use a new version instead
4. **Never delete old versions** - They're needed for migration

### Always Do This

1. **Append new variants** at the end of enums
2. **Provide sensible defaults** for new fields in migration code
3. **Test upgrade paths** with both V1 and V2 fixtures
4. **Document breaking changes** in release notes

## Testing Upgrades

The `upgrade-simulation` feature flag enables testing the upgrade path:

```bash
# Build both versions
./scripts/build_test_fixtures.sh

# Run versioning tests
cargo test --features integration-tests --test integration versioning
```

Tests in `versioning_tests.rs` deploy V1, store data, upgrade to V2, and verify:

- All V1 data remains readable
- Contract state (paused, backend_wallet) persists
- Protection mechanisms (nullifiers, signatures) still work
- New V2 features work correctly

## Rollback

If an upgrade causes issues:

1. **Redeploy the previous WASM** - State migrations are lazy, so unmodified V1 data remains V1
2. **Note:** Any V1 data that was read (and thus migrated to V2) during the bad deployment may need manual attention

For critical contracts, consider:

- Staged rollouts (testnet → mainnet)
- Monitoring after deployment
- Having the previous WASM readily available
