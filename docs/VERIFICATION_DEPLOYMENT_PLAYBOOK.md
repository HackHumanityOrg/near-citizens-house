# Verification Deployment Playbook

Step-by-step guide to deploy the NEAR Verified Accounts system.

---

## Key Points

- **Rust 1.86.0 exactly**
- Storage is billed per byte and locked from the **contract account** balance; keep a 5+ NEAR buffer
- Gas is paid by the **transaction signer**; the backend wallet signs write calls (`store_verification`, `pause`, `unpause`, `update_backend_wallet`) and pays gas + 1 yocto per call, so keep 1+ NEAR on the backend wallet
- Private keys must NEVER be exposed to frontend
- Backend wallet keys (`NEAR_ACCOUNT_ID` / `NEAR_PRIVATE_KEY`) must remain active; any funded account can serve as the backend wallet, but this playbook uses a sub-account under `$ROOT`
- Use reproducible builds (`cargo near build reproducible-wasm`) and record the WASM SHA-256
- **Never reinitialize on upgrades** - use `without-init-call` flag
- Rotate contract full-access keys to the multisig, then delete the contract's initial key; optionally lock upgrades by removing all full-access keys

---

## Checklist

### Contract pre-deploy

- [ ] Confirm mainnet deployment and a funded root account
- [ ] Create a multisig account to own the contract (e.g., `multisig.citizens-house.near`)
- [ ] Install Docker (required for reproducible builds)
- [ ] Create backend wallet and contract sub-accounts

### Contract post-deploy

- [ ] `get_backend_wallet` returns the backend wallet
- [ ] Contract SHA-256 matches local WASM build
- [ ] Backend wallet keys present (`near account list-keys $BACKEND_WALLET.$ROOT`)
- [ ] Contract's initial key removed (multisig key retained)

---

## Prerequisites

```bash
# Install rustup (Rust toolchain manager)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Rust 1.86.0 (NOT 1.87+ - has WASM incompatibilities)
rustup install 1.86.0
rustup default 1.86.0
rustup target add wasm32-unknown-unknown

# Install cargo-near (contract build tool)
cargo install cargo-near

# Install near-cli-rs (NEAR command-line interface)
cargo install near-cli-rs

# Verify
rustup --version
cargo near --version
near --version
```

**Expected output:**

```
rustup 1.28.x (or newer)
cargo-near-near 0.x.x
near x.x.x
```

---

## Environment Variables

Set these once and use throughout all commands:

```bash
# Root account (top-level, funded)
ROOT=citizens-house.near

# Contract account (sub-account of ROOT; hosts the verification contract)
CONTRACT=verification

# Backend wallet (sub-account of ROOT; used by webapp to sign transactions)
BACKEND_WALLET=backend
```

Account structure (mainnet):

```
citizens-house.near (root account)
├─ verification.citizens-house.near (verification contract)
└─ backend.citizens-house.near (backend signer wallet for webapp)
```

---

## Step 0: Acquire Root Account (Mainnet)

The root account `citizens-house.near` must be created via a wallet or registrar (CLI cannot create top-level `.near` accounts). Ensure it has at least 15 NEAR to fund sub-accounts and cover storage.

---

## Step 1: Create Backend Wallet

The backend wallet is the only account authorized to write verification records. It can be any funded mainnet account, but this playbook creates it as a sub-account of `$ROOT` (sibling of the contract account).

> **Note:** We use `save-to-legacy-keychain` here (compatible with the JS CLI) so the private key is saved under `~/.near-credentials/...` and can be exported for your backend deployment environment. `save-to-keychain` stores keys in the OS keychain, which is harder to export.

```bash
near account create-account fund-myself $BACKEND_WALLET.$ROOT '1 NEAR' \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as $ROOT \
  network-config mainnet sign-with-keychain send
```

**Expected output:**

```
New account "backend.citizens-house.near" created successfully.
```

Export the private key:

```bash
cat ~/.near-credentials/mainnet/$BACKEND_WALLET.$ROOT.json
```

**Expected output:**

```json
{
  "public_key": "ed25519:ABC...",
  "private_key": "ed25519:XYZ...",
  ...
}
```

Save the `private_key` value (starts with `ed25519:`) for your deployment environment (Vercel secret).

---

## Step 2: Create Verification Contract Account

Create as a sub-account of the root account:

```bash
near account create-account fund-myself $CONTRACT.$ROOT '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $ROOT \
  network-config mainnet sign-with-keychain send
```

**Expected output:**

```
New account "verification.citizens-house.near" created successfully.
```

---

## Step 3: Build Contract

### 3.1 Build

Reproducible builds are required for releases. Ensure Docker is installed, `Cargo.lock` is checked in, the repo is clean, and `Cargo.toml` includes NEP-330 metadata (`package.metadata.near.reproducible_build`).

```bash
cd contracts/verified-accounts
cargo near build reproducible-wasm
```

**Expected output:**

```
   Compiling verified-accounts v0.1.0
    Finished release [optimized] target(s)
Contract successfully built: target/near/verified_accounts.wasm
```

### 3.2 Record the WASM hash

```bash
shasum -a 256 target/near/verified_accounts.wasm
```

Record the SHA-256 output in your release notes.

Latest reproducible build SHA-256: `76eb5664455f8302ec53692fbe4af1fb6d7819ee08d044cd65cbc3e1f811c9e4`.

Save the SHA-256; you will compare it to the on-chain contract hash in Step 4.4.

---

## Step 4: Deploy & Initialize Contract

### 4.1 Deploy the WASM

```bash
near contract deploy $CONTRACT.$ROOT \
  use-file target/near/verified_accounts.wasm \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

### 4.2 Initialize

```bash
near contract call-function as-transaction $CONTRACT.$ROOT new \
  json-args "{\"backend_wallet\":\"$BACKEND_WALLET.$ROOT\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $CONTRACT.$ROOT \
  network-config mainnet sign-with-keychain send
```

### 4.3 Verify

```bash
near contract call-function as-read-only $CONTRACT.$ROOT get_backend_wallet \
  json-args '{}' \
  network-config mainnet now
```

**Expected output:**

```
"backend.citizens-house.near"
```

### 4.4 Verify contract hash

```bash
near account view-account-summary $CONTRACT.$ROOT \
  network-config mainnet now
```

Check the `Contract (SHA-256 checksum hex)` line matches the hash from Step 3.2.

### 4.5 Secure contract account keys (recommended)

Rotate the contract account's full-access keys to the multisig, then delete the contract's initial key. This only affects the **contract account**; do **not** delete backend wallet keys used by the web app.

> **Note:** A NEAR multisig is a deployed contract that requires multiple signatures to authorize transactions. To give a multisig control over another account, you add a full-access key that the multisig infrastructure controls.

```bash
# List keys
near account list-keys $CONTRACT.$ROOT network-config mainnet now

# Add multisig full-access key
near account add-key $CONTRACT.$ROOT \
  grant-full-access use-manually-provided-public-key <MULTISIG_PUBLIC_KEY> \
  network-config mainnet sign-with-keychain send

# Delete the contract account's initial key (replace with the public key shown above)
near account delete-keys $CONTRACT.$ROOT \
  public-keys <CONTRACT_INITIAL_PUBLIC_KEY> \
  network-config mainnet sign-with-keychain send

# Confirm keys after rotation
near account list-keys $CONTRACT.$ROOT network-config mainnet now
```

Rotating the backend wallet account:

```bash
NEW_BACKEND=new-backend  # the new backend wallet account name
near contract call-function as-transaction $CONTRACT.$ROOT update_backend_wallet \
  json-args "{\"new_backend_wallet\":\"$NEW_BACKEND.$ROOT\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '1 yoctoNEAR' \
  sign-as $BACKEND_WALLET.$ROOT \
  network-config mainnet sign-with-keychain send
```

Then update `NEAR_ACCOUNT_ID` / `NEAR_PRIVATE_KEY` in your deployment environment.

If you want to lock upgrades permanently, delete all full-access keys. Since this contract has no self-upgrade method, upgrades become impossible.

---

## Step 5: Verify Deployment

> **⚠️ ENVIRONMENT CHECK**: Confirm `$CONTRACT.$ROOT` and `$BACKEND_WALLET.$ROOT` are on the target network.

```bash
# Check contract
near contract call-function as-read-only $CONTRACT.$ROOT get_verified_count \
  json-args '{}' \
  network-config mainnet now
```

```bash
# Check backend wallet keys are still present
near account list-keys $BACKEND_WALLET.$ROOT network-config mainnet now
```

**Expected output:**

```
0
```

(Returns the number of verified accounts, 0 for fresh deployment)

---

## Upgrading

To upgrade without losing state:

```bash
# Rebuild
cd contracts/verified-accounts && cargo near build reproducible-wasm

# Deploy WITHOUT init
near contract deploy $CONTRACT.$ROOT \
  use-file target/near/verified_accounts.wasm \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

---

## Rollback (if deployment fails)

Keep the last known good WASM from Step 3.2 so you can redeploy it if needed. If you already removed the contract's initial key, use the multisig to sign the rollback deployment.

```bash
near contract deploy $CONTRACT.$ROOT \
  use-file <PREVIOUS_WASM_PATH> \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

If backend wallet rotation caused issues, restore the previous `NEAR_ACCOUNT_ID` / `NEAR_PRIVATE_KEY`.

---

## Testnet Appendix (Optional)

If you need a testnet deployment for staging or mock passports, use the same steps with these changes:

```bash
ROOT=your-account.testnet  # testnet uses .testnet suffix
CONTRACT=verification
BACKEND_WALLET=backend
```

- Create the ROOT account with the faucet: `near account create-account sponsor-by-faucet-service $ROOT autogenerate-new-keypair save-to-keychain network-config testnet create`
- Use `network-config testnet` in all commands
- Testnet tokens: faucet + https://near-faucet.io/
