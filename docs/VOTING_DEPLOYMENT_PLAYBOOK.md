# NEAR Citizens House - Voting Deployment Playbook

Step-by-step guide to deploy the governance voting contract on NEAR mainnet.

---

## Scope

- Mainnet only
- First-time deployment only
- Contract-only runbook (no app/Vercel rollout)
- near-cli-rs command syntax only

---

## Key Points

- Use Rust `1.86.0` exactly for NEAR-compatible WASM output
- Reproducible builds are required (`cargo near build reproducible-wasm`)
- Build preconditions are strict: Docker installed, clean git worktree, committed `Cargo.lock`
- Deploy with `without-init-call`, then initialize in a separate `new` transaction
- Initialization defaults follow PRD values for governance
- Record SHA-256 (hex) for each release artifact



---

## Deployment Variables

Set these once and reuse them in all commands:

```bash
ROOT=citizens-house.near
CONTRACT=vote
VOTE_CONTRACT=$CONTRACT.$ROOT

# Existing verified-accounts contract used by governance callbacks
VERIFIED_CONTRACT=verification.citizens-house.near

# Initial admin accounts
ADMIN_KLAUS=klausbrave.near
ADMIN_HACKHUMANITY=hackhumanity.near
```

---

## Prerequisites

```bash
# Rust + toolchain
rustup install 1.86.0
rustup target add wasm32-unknown-unknown
cargo install cargo-near
cargo install near-cli-rs

# Verify tooling
rustup --version
cargo near --version
near --version
docker --version
```

---

## Step 0: Pre-Deploy Dependency Checks

Verify root account, all initial admin accounts, and the verified-accounts contract are accessible on mainnet:

```bash
near account view-account-summary $ROOT network-config mainnet now
near account view-account-summary $ADMIN_KLAUS network-config mainnet now
near account view-account-summary $ADMIN_HACKHUMANITY network-config mainnet now
near account view-account-summary $VERIFIED_CONTRACT network-config mainnet now
```

Verify required verified-accounts read methods are callable:

```bash
near contract call-function as-read-only $VERIFIED_CONTRACT get_verified_count \
  json-args '{}' \
  network-config mainnet now
```

```bash
near contract call-function as-read-only $VERIFIED_CONTRACT get_verification \
  json-args "{\"account_id\":\"$ADMIN_KLAUS\"}" \
  network-config mainnet now
```

Expected for `get_verification`: either `null` (not verified yet) or a valid summary object.

---

## Step 1: Enforce Reproducible Build Preconditions

From repository root:

```bash
git status --short
```

`git status --short` should be empty for release builds.

---

## Step 2: Build Governance Contract (Reproducible)

```bash
cd contracts/governance
rustup override set 1.86.0
cargo near build reproducible-wasm
shasum -a 256 target/near/governance.wasm
```

Current reference hash for the current code snapshot:

- Commit: `c6368cb5db587686a0d7292b41305c573abe06b2`
- `governance.wasm` SHA-256 (hex): `5e13d456d3af15e93075f6d58342c91754298d68a6dbc4196aa59b7f89125f4e`

---

## Step 3: Create Voting Contract Account

Create `vote.$ROOT` and fund it for contract storage:

```bash
near account create-account fund-myself $VOTE_CONTRACT '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $ROOT \
  network-config mainnet sign-with-keychain send
```

---

## Step 4: Deploy Voting Contract (No Init)

```bash
near contract deploy $VOTE_CONTRACT \
  use-file target/near/governance.wasm \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

---

## Step 5: Initialize Voting Contract

Initialization values below are the locked PRD defaults:

- `quorum_bps = 700`
- `voting_period_secs = 1209600` (14 days)
- `pending_expiry_secs = 3600` (1 hour)
- `min_proposal_bond = 1000000000000000000000000` yoctoNEAR (1 NEAR)
- `finalize_grace_period_secs = 3600` (1 hour)
- `max_start_delay_secs = 7776000` (90 days)
- `admins = [$ADMIN_KLAUS, $ADMIN_HACKHUMANITY]`

```bash
near contract call-function as-transaction $VOTE_CONTRACT new \
  json-args "{\"verified_accounts_contract\":\"$VERIFIED_CONTRACT\",\"admins\":[\"$ADMIN_KLAUS\",\"$ADMIN_HACKHUMANITY\"],\"quorum_bps\":700,\"voting_period_secs\":1209600,\"pending_expiry_secs\":3600,\"min_proposal_bond\":\"1000000000000000000000000\",\"finalize_grace_period_secs\":3600,\"max_start_delay_secs\":7776000}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $VOTE_CONTRACT \
  network-config mainnet sign-with-keychain send
```

---

## Step 6: Minimal Read-Only Post-Deploy Verification

Verify deployed config:

```bash
near contract call-function as-read-only $VOTE_CONTRACT get_config \
  json-args '{}' \
  network-config mainnet now
```

Verify on-chain contract hash matches your local SHA-256 from Step 2:

```bash
near account view-account-summary $VOTE_CONTRACT \
  network-config mainnet now
```

Compare the `Contract (SHA-256 checksum hex)` value to your recorded build hash.

---

## Output to Share with App/Infra Owners

Canonical governance contract identifier:

```bash
NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT=$VOTE_CONTRACT
```
