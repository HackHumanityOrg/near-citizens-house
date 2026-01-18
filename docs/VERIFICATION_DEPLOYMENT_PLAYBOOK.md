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
- Rotate contract full-access keys to the Security Council, then delete the deployer key; optionally lock upgrades by removing all full-access keys

---

## Checklist

### Contract pre-deploy

- [ ] Confirm mainnet deployment and a funded deployer account
- [ ] Decide who controls contract full-access keys (Security Council)
- [ ] Install Docker (required for reproducible builds)
- [ ] Create deployer, backend wallet, and contract accounts

### Contract post-deploy

- [ ] `get_backend_wallet` returns the backend wallet
- [ ] Contract SHA-256 matches local WASM build
- [ ] Backend wallet keys still present (`near account list-keys $BACKEND_WALLET.$ROOT`)
- [ ] Deployer key removed from contract account (Security Council key retained)

### Frontend pre-deploy

- [ ] Register backend key pool keys (`pnpm register-backend-keys`)
- [ ] Provision Redis and collect `REDIS_URL`
- [ ] Prepare Vercel environment variables and mark `NEAR_PRIVATE_KEY` as sensitive

### Frontend post-deploy

- [ ] End-to-end verification flow completes successfully

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
# Existing funded mainnet account (top-level)
ROOT=existing-funded.near

# Deployer account (sub-account of ROOT; owns the contract account)
DEPLOYER=deploy.$ROOT

# Contract name (will be deployed as $CONTRACT.$DEPLOYER)
CONTRACT=verification-v1

# Backend wallet name (will be created as $BACKEND_WALLET.$ROOT)
BACKEND_WALLET=backend-wallet
```

Account structure (mainnet):

```
$ROOT (top-level account, funded)
├─ $DEPLOYER (sub-account used to deploy/own the contract)
│  └─ $CONTRACT.$DEPLOYER (verification contract account)
└─ $BACKEND_WALLET.$ROOT (backend signer wallet)
```

---

## Step 0: Create Deployer Account (Mainnet)

If you already have a funded mainnet account you want to use as `$DEPLOYER`, skip this step.

Otherwise, create `$DEPLOYER` as a sub-account of `$ROOT`. CLI creation on mainnet is limited to sub-accounts; use a wallet/registrar for a top-level `.near` account:

```bash
near account create-account fund-myself $DEPLOYER '10 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $ROOT \
  network-config mainnet sign-with-keychain send
```

**Expected output:**

```
New account "deploy.existing-funded.near" created successfully.
```

Ensure `$ROOT` has enough NEAR to fund the new account.

---

## Step 1: Create Backend Wallet

The backend wallet is the only account authorized to write verification records. It can be any funded mainnet account, but this playbook creates it as a sub-account of `$ROOT` (sibling of the deployer).

> **Note:** We use `save-to-legacy-keychain` here (compatible with the JS CLI) so the private key is saved under `~/.near-credentials/...` and can be exported for Vercel. `save-to-keychain` stores keys in the OS keychain, which is harder to export.

```bash
near account create-account fund-myself $BACKEND_WALLET.$ROOT '1 NEAR' \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as $ROOT \
  network-config mainnet sign-with-keychain send
```

**Expected output:**

```
New account "backend-wallet.existing-funded.near" created successfully.
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

Save the `private_key` value (starts with `ed25519:`) for Vercel.

---

## Step 2: Create Verification Contract Account

Create as a sub-account of your deployer account:

```bash
near account create-account fund-myself $CONTRACT.$DEPLOYER '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $DEPLOYER \
  network-config mainnet sign-with-keychain send
```

**Expected output:**

```
New account "verification-v1.deploy.existing-funded.near" created successfully.
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

Latest reproducible build SHA-256: `ff82868043221bb2439f74d19574af114b849d73aa87efae8df63a3d794d67ea`.

Save the SHA-256; you will compare it to the on-chain contract hash in Step 4.4.

---

## Step 4: Deploy & Initialize Contract

### 4.1 Deploy the WASM

```bash
near contract deploy $CONTRACT.$DEPLOYER \
  use-file target/near/verified_accounts.wasm \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

### 4.2 Initialize

```bash
near contract call-function as-transaction $CONTRACT.$DEPLOYER new \
  json-args "{\"backend_wallet\":\"$BACKEND_WALLET.$ROOT\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $CONTRACT.$DEPLOYER \
  network-config mainnet sign-with-keychain send
```

### 4.3 Verify

```bash
near contract call-function as-read-only $CONTRACT.$DEPLOYER get_backend_wallet \
  json-args '{}' \
  network-config mainnet now
```

**Expected output:**

```
"backend-wallet.existing-funded.near"
```

### 4.4 Verify contract hash

```bash
near account view-account-summary $CONTRACT.$DEPLOYER \
  network-config mainnet now
```

Check the `Contract (SHA-256 checksum hex)` line matches the hash from Step 3.2.

### 4.5 Secure contract account keys (recommended)

Rotate the contract account’s full-access keys to the Security Council, then delete the deployer key. This only affects the **contract account**; do **not** delete backend wallet keys used by the web app.

```bash
# List keys
near account list-keys $CONTRACT.$DEPLOYER network-config mainnet now

# Add Security Council full-access key
near account add-key $CONTRACT.$DEPLOYER \
  grant-full-access use-manually-provided-public-key <SECURITY_COUNCIL_PUBLIC_KEY> \
  network-config mainnet sign-with-keychain send

# Delete deployer key (replace with the public key you used to deploy)
near account delete-keys $CONTRACT.$DEPLOYER \
  public-keys <DEPLOYER_PUBLIC_KEY> \
  network-config mainnet sign-with-keychain send

# Confirm keys after rotation
near account list-keys $CONTRACT.$DEPLOYER network-config mainnet now
```

Rotating the backend wallet account:

```bash
near contract call-function as-transaction $CONTRACT.$DEPLOYER update_backend_wallet \
  json-args '{"new_backend_wallet":"NEW_BACKEND.$ROOT"}' \
  prepaid-gas '30.0 Tgas' attached-deposit '1 yoctoNEAR' \
  sign-as $BACKEND_WALLET.$ROOT \
  network-config mainnet sign-with-keychain send
```

Then update `NEAR_ACCOUNT_ID` / `NEAR_PRIVATE_KEY` in Vercel and rerun `pnpm register-backend-keys`.

If you want to lock upgrades permanently, delete all full-access keys. Since this contract has no self-upgrade method, upgrades become impossible.

---

## Step 5: Register Backend Key Pool

The web app uses a 10-key pool derived from `NEAR_PRIVATE_KEY`. Register those keys on the backend wallet once per environment. Make sure `NEXT_PUBLIC_NEAR_NETWORK` is set for the target network before running this script:

```bash
NEXT_PUBLIC_NEAR_NETWORK=mainnet pnpm register-backend-keys
```

This requires `NEAR_ACCOUNT_ID` and `NEAR_PRIVATE_KEY` in your environment and ~0.1 NEAR per key for gas.

---

## Step 6: Set Up Redis

Redis is required for:

- **Session storage**: User verification flow state
- **NEP-413 signature nonces**: One-time use tracking + TTL (replay attack prevention)

Options:

- **Redis Cloud** (recommended): Add via Vercel Marketplace - auto-injects `REDIS_URL`
- **Upstash**: [upstash.com](https://upstash.com/)
- **Any Redis provider**: Must support key expiration (TTL)

Connection string format:

```
redis://default:PASSWORD@host:port
```

**Security Note**: Redis must support key expiration (TTL) for nonce management. All listed providers support this feature.

---

## Step 7: Deploy Frontend to Vercel

### Option A: One-Click Deploy (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHackHumanityOrg%2Fnear-citizens-house&root-directory=apps%2Fcitizens-house&env=NEXT_PUBLIC_NEAR_NETWORK,NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,NEXT_PUBLIC_SELF_NETWORK,NEXT_PUBLIC_APP_URL,NEAR_ACCOUNT_ID,NEAR_PRIVATE_KEY,FASTNEAR_API_KEY,CELO_RPC_URL,NEXT_PUBLIC_POSTHOG_KEY,POSTHOG_PERSONAL_API_KEY,POSTHOG_PROJECT_ID,NEXT_PUBLIC_USERJOT_PROJECT_ID,NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,REDIS_URL&envDefaults=%7B%22NEXT_PUBLIC_NEAR_NETWORK%22%3A%22mainnet%22%2C%22NEXT_PUBLIC_SELF_NETWORK%22%3A%22mainnet%22%2C%22CELO_RPC_URL%22%3A%22https%3A//forno.celo.org%22%2C%22NEXT_PUBLIC_APP_URL%22%3A%22https%3A//your-app.vercel.app%22%7D&envDescription=Production%20deployment.%20Re-add%20NEAR_PRIVATE_KEY%20as%20Sensitive%20after%20deploy!&envLink=https%3A%2F%2Fgithub.com%2FHackHumanityOrg%2Fnear-citizens-house%2Fblob%2Fmain%2Fdocs%2FVERIFICATION_DEPLOYMENT_PLAYBOOK.md&project-name=near-citizens-house&repository-name=near-citizens-house&integration-ids=oac_4nMvFhFSbAGAK6MU5mUFFILs)

1. Connect GitHub and create the repository
2. Add Redis Cloud store (required). Confirm it populates `REDIS_URL` or copy it manually.
3. Fill in environment variables from Steps 0-6 for the **Production** environment
4. Deploy
5. **Important**: Delete `NEAR_PRIVATE_KEY`, re-add it as **Sensitive**, then redeploy so the new value is applied.

### Option B: Manual Setup

#### 7.1 Connect repository

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Root Directory** to `apps/citizens-house`

### 7.2 Build settings

| Setting          | Value                   |
| ---------------- | ----------------------- |
| Framework        | Next.js (auto-detected) |
| Build Command    | (leave default)         |
| Output Directory | (leave default)         |
| Install Command  | (leave default)         |

### 7.3 Environment variables

**Required (Production environment):**

| Variable                                 | Example                                       | Notes                                              |
| ---------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `NEXT_PUBLIC_NEAR_NETWORK`               | `mainnet`                                     | mainnet for production                             |
| `NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT` | `verification-v1.deploy.existing-funded.near` | `$CONTRACT.$DEPLOYER`                              |
| `NEXT_PUBLIC_SELF_NETWORK`               | `mainnet`                                     | mainnet recommended (real passports + OFAC)        |
| `NEXT_PUBLIC_APP_URL`                    | `https://your-app.vercel.app`                 | update after first deploy if needed                |
| `NEAR_ACCOUNT_ID`                        | `backend-wallet.existing-funded.near`         | `$BACKEND_WALLET.$ROOT`                            |
| `NEAR_PRIVATE_KEY`                       | `ed25519:...`                                 | must be added as **Sensitive**                     |
| `REDIS_URL`                              | `redis://...`                                 | Redis integration output                           |
| `FASTNEAR_API_KEY`                       | `fastnear_api_key`                            | required for RPC rate limits (X-API-Key header)    |
| `CELO_RPC_URL`                           | `https://forno.celo.org`                      | mainnet default (override if needed)               |
| `NEXT_PUBLIC_POSTHOG_KEY`                | `phc_...`                                     | PostHog project key                                |
| `POSTHOG_PERSONAL_API_KEY`               | `phx_...`                                     | PostHog source maps (optional)                     |
| `POSTHOG_PROJECT_ID`                         | `01234567-89ab-cdef-...`                      | PostHog project ID (optional)                      |
| `NEXT_PUBLIC_USERJOT_PROJECT_ID`         | `userjot_project_id`                          | UserJot feedback widget                            |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`   | `walletconnect_project_id`                    | WalletConnect support (MyNearWallet, Unity Wallet) |

Set these for **Production** (and Preview if you need previews). Any environment variable change requires a redeploy to take effect.

**Network pairing notes:**

- NEAR and Self networks are independent, but this playbook assumes Self mainnet; use testnet only in the appendix for mock passports.

**Security notes:**

After deployment, delete and re-add `NEAR_PRIVATE_KEY` as **Sensitive** in the Vercel dashboard (Sensitive cannot be toggled on existing values):

1. Go to Project Settings → Environment Variables
2. Delete `NEAR_PRIVATE_KEY`
3. Re-add it with the **Sensitive** option enabled (Production, and Preview if needed)
4. Redeploy so the updated value is applied

Once marked as Sensitive, the value can never be read again (even by project owners). This protects your private key from accidental exposure.

---

## Step 8: Verify Deployment

> **⚠️ ENVIRONMENT CHECK**: Confirm `$CONTRACT.$DEPLOYER` and `$BACKEND_WALLET.$ROOT` are on the target network.

```bash
# Check contract
near contract call-function as-read-only $CONTRACT.$DEPLOYER get_verified_count \
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

Test the frontend:

1. Open your Vercel URL
2. Connect a NEAR wallet
3. Complete the verification flow

---

## Upgrading

To upgrade without losing state:

```bash
# Rebuild
cd contracts/verified-accounts && cargo near build reproducible-wasm

# Deploy WITHOUT init
near contract deploy $CONTRACT.$DEPLOYER \
  use-file target/near/verified_accounts.wasm \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

---

## Rollback (if deployment fails)

Keep the last known good WASM from Step 3.2 so you can redeploy it if needed. If you already removed the deployer key, use the Security Council DAO key to sign the rollback deployment.

```bash
near contract deploy $CONTRACT.$DEPLOYER \
  use-file <PREVIOUS_WASM_PATH> \
  without-init-call \
  network-config mainnet sign-with-keychain send
```

If backend wallet rotation caused issues, restore the previous `NEAR_ACCOUNT_ID` / `NEAR_PRIVATE_KEY` and rerun `pnpm register-backend-keys`.

---

## Testnet Appendix (Optional)

If you need a testnet deployment for staging or mock passports, use the same steps with these changes:

```bash
ROOT=your-account.testnet  # testnet uses .testnet suffix
DEPLOYER=deploy.$ROOT
CONTRACT=verification-v1
BACKEND_WALLET=backend-wallet
```

- Create the ROOT account with the faucet: `near account create-account sponsor-by-faucet-service $ROOT autogenerate-new-keypair save-to-keychain network-config testnet create`
- Create DEPLOYER as a sub-account: `near account create-account fund-myself $DEPLOYER '10 NEAR' autogenerate-new-keypair save-to-keychain sign-as $ROOT network-config testnet sign-with-keychain send`
- Use `network-config testnet` in all commands
- Set `NEXT_PUBLIC_NEAR_NETWORK=testnet`
- For mock passports set `NEXT_PUBLIC_SELF_NETWORK=testnet` (no OFAC); keep Self mainnet for real passports
- Testnet tokens: faucet + https://near-faucet.io/
