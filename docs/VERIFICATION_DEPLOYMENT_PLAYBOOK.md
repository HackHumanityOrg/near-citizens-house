# Verification Deployment Playbook

Step-by-step guide to deploy the NEAR Verified Accounts system.

---

## Key Points

- **Rust 1.86.0 exactly** - 1.87+ has WASM incompatibilities
- Contract account needs 2-5 NEAR for storage; backend wallet needs 1+ NEAR for gas
- Private keys must NEVER be exposed to frontend
- Use reproducible builds (`cargo near build reproducible-wasm`) and record the WASM SHA-256
- **Never reinitialize on upgrades** - use `without-init-call` flag
- Self.xyz mainnet = real passports; testnet = mock/staging passports
- Plan contract-key rotation: move full-access control to a DAO/multisig and delete deployer keys

---

## Checklist

### Pre-deploy

- [ ] Confirm target network (`testnet` vs `mainnet`)
- [ ] Decide who controls contract full-access keys (Security Council DAO or multisig)
- [ ] Install Docker if you want reproducible builds
- [ ] Prepare Vercel environment variables and mark `NEAR_PRIVATE_KEY` as sensitive

### Post-deploy

- [ ] `get_backend_wallet` returns the backend wallet
- [ ] Contract SHA-256 matches local WASM build
- [ ] Deployer key removed from contract account (DAO/multisig key retained)
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
# Your parent account (will be created via faucet)
PARENT=your-account.testnet

# Contract name (will be deployed as $CONTRACT.$PARENT)
CONTRACT=verification-v1

# Backend wallet name (will be created as $BACKEND_WALLET.$PARENT)
BACKEND_WALLET=backend-wallet
```

---

## Step 0: Create Parent Account

First, create your parent account using the testnet faucet. This account will own your sub-accounts and needs funds to create them.

```bash
near account create-account sponsor-by-faucet-service $PARENT \
  autogenerate-new-keypair save-to-keychain \
  network-config testnet create
```

**Expected output:**

```
The account "your-account.testnet" was created successfully.
Transaction: ...
```

The faucet provides ~10 NEAR for testing. You can also get additional testnet tokens from [near-faucet.io](https://near-faucet.io/).

---

## Step 1: Create Backend Wallet

The backend wallet is the only account authorized to write verification records. Created as a sub-account of your parent.

> **Note:** We use `save-to-legacy-keychain` here (not `save-to-keychain`) so the private key is saved to `~/.near-credentials/...` and can be exported for Vercel. This matches near-cli-rs legacy keychain behavior (file-based credentials).

```bash
near account create-account fund-myself $BACKEND_WALLET.$PARENT '1 NEAR' \
  autogenerate-new-keypair save-to-legacy-keychain \
  sign-as $PARENT \
  network-config testnet sign-with-keychain send
```

**Expected output:**

```
New account "backend-wallet.your-account.testnet" created successfully.
```

Export the private key:

```bash
cat ~/.near-credentials/testnet/$BACKEND_WALLET.$PARENT.json
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

Create as a sub-account of your parent account:

```bash
near account create-account fund-myself $CONTRACT.$PARENT '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $PARENT \
  network-config testnet sign-with-keychain send
```

**Expected output:**

```
New account "verification-v1.your-account.testnet" created successfully.
```

---

## Step 3: Build Contract

### 3.1 Build

Reproducible builds are required for releases. Ensure Docker is installed, `Cargo.lock` is committed, the repo is clean, and `Cargo.toml` includes NEP-330 metadata (`package.metadata.near.reproducible_build`).

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

Save this hash; you will compare it to the on-chain contract hash in Step 4.4.

---

## Step 4: Deploy & Initialize Contract

### 4.1 Deploy the WASM

```bash
near contract deploy $CONTRACT.$PARENT \
  use-file target/near/verified_accounts.wasm \
  without-init-call \
  network-config testnet sign-with-keychain send
```

### 4.2 Initialize

```bash
near contract call-function as-transaction $CONTRACT.$PARENT new \
  json-args "{\"backend_wallet\":\"$BACKEND_WALLET.$PARENT\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $CONTRACT.$PARENT \
  network-config testnet sign-with-keychain send
```

### 4.3 Verify

```bash
near contract call-function as-read-only $CONTRACT.$PARENT get_backend_wallet \
  json-args '{}' \
  network-config testnet now
```

**Expected output:**

```
"backend-wallet.your-account.testnet"
```

### 4.4 Verify contract hash

```bash
near account view-account-summary $CONTRACT.$PARENT \
  network-config testnet now
```

Check the `Contract (SHA-256 checksum hex)` line matches the hash from Step 3.2.

### 4.5 Secure contract account keys (recommended)

Rotate the contract account’s full-access keys to a Security Council DAO or multisig and remove the deployer key:

```bash
# List keys
near account list-keys $CONTRACT.$PARENT network-config testnet now

# Add DAO/multisig key (replace with your DAO public key)
near account add-key $CONTRACT.$PARENT <DAO_PUBLIC_KEY> \
  network-config testnet sign-with-keychain send

# Delete deployer key (replace with the public key you used to deploy)
near account delete-key $CONTRACT.$PARENT <DEPLOYER_PUBLIC_KEY> \
  network-config testnet sign-with-keychain send

# Confirm keys after rotation
near account list-keys $CONTRACT.$PARENT network-config testnet now
```

If you want to lock upgrades permanently, delete all full-access keys. Only do this after you are sure upgrades are no longer needed.

---

## Step 5: Set Up Redis

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

## Step 6: Deploy Frontend to Vercel

### Option A: One-Click Deploy (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHackHumanityOrg%2Fnear-citizens-house&root-directory=apps%2Fcitizens-house&env=NEXT_PUBLIC_NEAR_NETWORK,NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,NEXT_PUBLIC_SELF_NETWORK,NEXT_PUBLIC_APP_URL,NEAR_ACCOUNT_ID,NEAR_PRIVATE_KEY,NEXT_PUBLIC_USERJOT_PROJECT_ID,NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID&envDescription=Production%20deployment.%20Mark%20NEAR_PRIVATE_KEY%20as%20Sensitive%20in%20Vercel%20after%20deploy!&envLink=https%3A%2F%2Fgithub.com%2FHackHumanityOrg%2Fnear-citizens-house%2Fblob%2Fmain%2Fdocs%2FVERIFICATION_DEPLOYMENT_PLAYBOOK.md&project-name=near-citizens-house&repository-name=near-citizens-house&integration-ids=oac_4nMvFhFSbAGAK6MU5mUFFILs&skippable-integrations=1)

1. Connect GitHub and create the repository
2. Add Redis Cloud store (or skip to configure manually)
3. Fill in environment variables from Steps 0-4
4. Deploy
5. **Important**: After deployment, go to Project Settings → Environment Variables and mark `NEAR_PRIVATE_KEY` as **Sensitive** (click edit → check "Sensitive"). This ensures the private key cannot be read again.

### Option B: Manual Setup

#### 6.1 Connect repository

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Root Directory** to `apps/citizens-house`

### 6.2 Build settings

| Setting          | Value                   |
| ---------------- | ----------------------- |
| Framework        | Next.js (auto-detected) |
| Build Command    | (leave default)         |
| Output Directory | (leave default)         |
| Install Command  | (leave default)         |

### 6.3 Environment variables

**Required:**

| Variable                                 | Example                                | Notes                                        |
| ---------------------------------------- | -------------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_NEAR_NETWORK`               | `testnet`                              | or `mainnet`                                 |
| `NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT` | `verification-v1.your-account.testnet` | `$CONTRACT.$PARENT`                          |
| `NEXT_PUBLIC_SELF_NETWORK`               | `mainnet`                              | `mainnet` for real passports                 |
| `NEXT_PUBLIC_APP_URL`                    | `https://your-app.vercel.app`          |                                              |
| `NEAR_ACCOUNT_ID`                        | `backend-wallet.your-account.testnet`  | `$BACKEND_WALLET.$PARENT`                    |
| `NEAR_PRIVATE_KEY`                       | `ed25519:...`                          | **Mark as Sensitive in Vercel after deploy** |
| `REDIS_URL`                              | `redis://...`                          | Auto-set by Redis Cloud integration          |

**Optional:**

| Variable                               | Purpose                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| `FASTNEAR_API_KEY`                     | FastNEAR API key for higher rate limits (X-API-Key header) |
| `CELO_RPC_URL`                         | Custom Celo RPC (default: forno.celo.org)                  |
| `NEXT_PUBLIC_POSTHOG_KEY`              | PostHog analytics                                          |
| `NEXT_PUBLIC_USERJOT_PROJECT_ID`       | UserJot feedback widget                                    |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect support (MyNearWallet, Unity Wallet)         |

**Security notes:**

After deployment, mark `NEAR_PRIVATE_KEY` as **Sensitive** in the Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Click the three dots next to `NEAR_PRIVATE_KEY` → Edit
3. Check the **Sensitive** checkbox and save

Once marked as Sensitive, the value can never be read again (even by project owners). This protects your private key from accidental exposure.

---

## Step 7: Verify Deployment

```bash
# Check contract
near contract call-function as-read-only $CONTRACT.$PARENT get_verified_count \
  json-args '{}' \
  network-config testnet now
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
near contract deploy $CONTRACT.$PARENT \
  use-file target/near/verified_accounts.wasm \
  without-init-call \
  network-config testnet sign-with-keychain send
```

---

## Mainnet

Same steps with these changes:

```bash
# Update environment variables for mainnet
PARENT=your-account.near  # mainnet uses .near suffix
CONTRACT=verification-v1
BACKEND_WALLET=backend-wallet
```

- Use `network-config mainnet` instead of `testnet`
- Set `NEXT_PUBLIC_NEAR_NETWORK=mainnet`
- Fund accounts with real NEAR (no faucet on mainnet)
- RPC uses FastNEAR: `https://rpc.mainnet.fastnear.com`
