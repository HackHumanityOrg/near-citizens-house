---
name: redeploy-clean-state
description: Redeploy the verification contract with clean state. Use when you need to reset the contract state, redeploy from scratch, or wipe all verifications on testnet or mainnet.
allowed-tools: Read, Bash, Edit, Write, Grep, Glob, TodoWrite
---

# Redeploy Verification Contract

Redeploys the `verified-accounts` contract to the same address with fresh/clean state.

## When to Use

- Reset contract state for testing
- Wipe all verifications and start fresh
- Redeploy after contract code changes

## Important Notes

- **Data Loss**: All existing verifications will be permanently deleted
- **Large State**: NEAR accounts with >10KB state cannot be deleted directly. This skill handles that by clearing state in batches first.
- **Same Address**: The contract address remains the same, so no Doppler/Vercel changes needed

## Execution Steps

### Step 1: Get Configuration from Doppler

```bash
doppler run -- printenv | grep -E '^(NEAR|NEXT_PUBLIC_NEAR)'
```

Extract:

- `NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT` - contract address (e.g., `verification-v1.parent.near`)
- `NEAR_ACCOUNT_ID` - backend wallet address
- `NEXT_PUBLIC_NEAR_NETWORK` - network (testnet or mainnet)

Derive the parent account from the contract address (everything after the first dot).

### Step 2: Check Current State Count

```bash
near contract call-function as-read-only <CONTRACT_ACCOUNT> get_verified_count \
  json-args '{}' network-config <NETWORK>-fastnear now
```

If count is 0 or state is small (<10KB), skip to Step 5.

### Step 3: Add Clean Method to Contract

Add this method to `contracts/verified-accounts/src/lib.rs` inside the `impl VersionedContract` block, before the closing brace:

```rust
// ==================== State Cleanup (Temporary) ====================

/// Clear contract state in batches (for account deletion).
/// Only callable by contract account itself.
/// Returns the number of records removed.
#[init(ignore_state)]
#[private]
pub fn clean(limit: u64) -> Self {
    let mut contract: VersionedContract =
        env::state_read().unwrap_or_else(|| env::panic_str("No state to clean"));

    match &mut contract {
        VersionedContract::V1(c) => {
            let keys: Vec<AccountId> = {
                let keys_vector = c.verifications.keys_as_vector();
                let limit = std::cmp::min(limit, keys_vector.len());
                (0..limit)
                    .filter_map(|index| keys_vector.get(index))
                    .collect()
            };
            let mut removed = 0u64;

            for account_id in keys {
                if let Some(v) = c.verifications.remove(&account_id) {
                    c.nullifiers.remove(&v.into_current().nullifier);
                    removed += 1;
                }
            }

            env::log_str(&format!("Cleaned {} records", removed));
        }
    }

    contract
}
```

Notes:

- `LookupSet` is non-iterable, so nullifiers are removed alongside their verification entries.
- Full state wipe is guaranteed after account deletion/recreation in Steps 6–9.

> Reproducible builds use committed code only. Commit the temporary `clean` method (e.g., on a short-lived branch) before building.

### Step 4: Build and Deploy Cleanup Version

```bash
pnpm build:contract:verification

near contract deploy <CONTRACT_ACCOUNT> \
  use-file contracts/verified-accounts/target/near/verified_accounts.wasm \
  without-init-call \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

### Step 5: Clear State in Batches

Call `clean` repeatedly until all records are removed:

```bash
# Clear in batches of 50
near contract call-function as-transaction <CONTRACT_ACCOUNT> clean \
  json-args '{"limit": 50}' \
  prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' \
  sign-as <CONTRACT_ACCOUNT> \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

Repeat until logs show "Cleaned 0 records" or the count check returns 0.

### Step 6: Delete the Contract Account

```bash
near account delete-account <CONTRACT_ACCOUNT> beneficiary <PARENT_ACCOUNT> \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

### Step 7: Recreate the Contract Account

```bash
near account create-account fund-myself <CONTRACT_ACCOUNT> '5 NEAR' \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as <PARENT_ACCOUNT> \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

### Step 8: Revert Contract Code and Rebuild

```bash
# Switch back to the baseline branch/commit without the clean method
# (reproducible builds require a clean git state)
git checkout <BASE_BRANCH>

pnpm build:contract:verification
```

### Step 9: Deploy Fresh Contract

```bash
near contract deploy <CONTRACT_ACCOUNT> \
  use-file contracts/verified-accounts/target/near/verified_accounts.wasm \
  without-init-call \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

### Step 10: Initialize Contract

```bash
near contract call-function as-transaction <CONTRACT_ACCOUNT> new \
  json-args '{"backend_wallet":"<BACKEND_WALLET>"}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as <CONTRACT_ACCOUNT> \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

### Step 11: Verify Deployment

```bash
# Check count is 0
near contract call-function as-read-only <CONTRACT_ACCOUNT> get_verified_count \
  json-args '{}' network-config <NETWORK>-fastnear now

# Check backend wallet is correct
near contract call-function as-read-only <CONTRACT_ACCOUNT> get_backend_wallet \
  json-args '{}' network-config <NETWORK>-fastnear now

# Check state version
near contract call-function as-read-only <CONTRACT_ACCOUNT> get_state_version \
  json-args '{}' network-config <NETWORK>-fastnear now
```

## Network Configuration

Always use `<NETWORK>-fastnear` (e.g., `mainnet-fastnear` or `testnet-fastnear`) to avoid rate limiting on the default RPC.

The NEAR CLI config at `~/Library/Application Support/near-cli/config.toml` has these network aliases pre-configured.

## Verification Checklist

- [ ] State cleared to 0
- [ ] Account deleted successfully
- [ ] Account recreated with sufficient NEAR
- [ ] Fresh contract deployed
- [ ] Contract initialized with correct backend wallet
- [ ] `get_verified_count` returns 0
- [ ] `get_backend_wallet` returns correct address

---

## Last Resort: NEAR Clear State Tool

**IMPORTANT**: Only use this approach when the standard clean method fails due to incompatible data structures (e.g., "Cannot deserialize value with Borsh" errors). This happens when the on-chain contract state was created with a different version of the contract code.

**Requires explicit user confirmation before proceeding.**

Reference: https://docs.near.org/tools/clear-state

### When to Use

- The `clean` method fails with Borsh deserialization errors
- The on-chain state has incompatible data structures from an older contract version
- Standard state cleanup approaches don't work

### Step 1: Clone the Clear State Tool

```bash
cd /tmp && rm -rf near-clear-state
git clone https://github.com/near-examples/near-clear-state.git
cd near-clear-state && npm install
```

### Step 2: Deploy the Cleanup Contract

The tool includes a pre-built `state_cleanup.wasm` that can remove storage keys without deserializing them:

```bash
near contract deploy <CONTRACT_ACCOUNT> \
  use-file /tmp/near-clear-state/contractWasm/state_cleanup.wasm \
  without-init-call \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

### Step 3: Get All Storage Keys

Run the tool to list all storage keys (it will fail to sign but will print the keys):

```bash
cd /tmp/near-clear-state
node index.js clear-state --account <CONTRACT_ACCOUNT> --network <NETWORK>
```

The output will show base64-encoded storage keys like:
```
[
  "AWkJAAAAYWltbC5uZWFy",
  "U1RBVEU=",
  ...
]
```

### Step 4: Call Clean with the Keys

Call the cleanup contract's `clean` method with all the keys:

```bash
near contract call-function as-transaction <CONTRACT_ACCOUNT> clean \
  json-args '{"keys": ["<KEY1>", "<KEY2>", ..., "U1RBVEU="]}' \
  prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' \
  sign-as <CONTRACT_ACCOUNT> \
  network-config <NETWORK>-fastnear sign-with-keychain send
```

**Note**: Include all keys from Step 3, including `"U1RBVEU="` which is the base64-encoded `STATE` key.

### Step 5: Verify State is Empty

```bash
near contract view-storage <CONTRACT_ACCOUNT> all as-text \
  network-config <NETWORK>-fastnear now
```

Should show empty state.

### Step 6: Continue with Standard Steps

Once state is cleared, continue from **Step 6** (Delete the Contract Account) in the standard process above.
