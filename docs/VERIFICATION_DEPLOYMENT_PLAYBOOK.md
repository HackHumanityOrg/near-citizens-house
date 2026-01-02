# Verification Deployment Playbook

Step-by-step guide to deploy the NEAR Verified Accounts system.

---

## Key Points

- **Rust 1.86.0 exactly** - 1.87+ has WASM incompatibilities
- Contract account needs 2-5 NEAR for storage; backend wallet needs 1+ NEAR for gas
- Private keys must NEVER be exposed to frontend
- **Never reinitialize on upgrades** - use `without-init-call` flag
- Self.xyz mainnet = real passports (with OFAC checks); testnet = mock/staging passports

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

> **Note:** We use `save-to-legacy-keychain` here (not `save-to-keychain`) so the private key is saved to a file that can be exported for Vercel.

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

```bash
cd contracts/verified-accounts
cargo near build non-reproducible-wasm
```

**Expected output:**

```
   Compiling verified-accounts v0.1.0
    Finished release [optimized] target(s)
Contract successfully built: target/near/verified_accounts.wasm
```

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

---

## Step 5: Set Up Redis

Session storage requires Redis. Options:

- **Vercel Marketplace** (recommended): Add Upstash integration - auto-injects `REDIS_URL`
- **Upstash** (direct): [upstash.com](https://upstash.com/)
- **Redis Labs**: [redis.com/try-free](https://redis.com/try-free/)

Connection string format:

```
redis://default:PASSWORD@host:port
```

---

## Step 6: Deploy Frontend to Vercel

### 6.1 Connect repository

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

**Monorepo setting (important for shared packages):**

In Project Settings → General → Root Directory, ensure **"Include source files outside of the Root Directory in the Build Step"** is checked. This is enabled by default for projects created after August 2020 and is required to access `packages/shared` and `packages/ui`.

Vercel auto-detects pnpm workspace from the lockfile and installs all workspace dependencies automatically.

### 6.3 Environment variables

**Required:**

| Variable                                 | Example                                | Notes                                             |
| ---------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `NEXT_PUBLIC_NEAR_NETWORK`               | `testnet`                              | or `mainnet`                                      |
| `NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT` | `verification-v1.your-account.testnet` | `$CONTRACT.$PARENT`                               |
| `NEXT_PUBLIC_SELF_NETWORK`               | `mainnet`                              | `mainnet` for real passports                      |
| `NEXT_PUBLIC_APP_URL`                    | `https://your-app.vercel.app`          |                                                   |
| `NEAR_ACCOUNT_ID`                        | `backend-wallet.your-account.testnet`  | `$BACKEND_WALLET.$PARENT` - Sensitive             |
| `NEAR_PRIVATE_KEY`                       | `ed25519:...`                          | Sensitive                                         |
| `REDIS_URL`                              | `redis://...`                          | Sensitive (auto-set if using Upstash integration) |

**Optional:**

| Variable                         | Purpose                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_NEAR_RPC_URL`       | Custom NEAR RPC (default: rpc.mainnet/testnet.near.org) |
| `CELO_RPC_URL`                   | Custom Celo RPC (default: forno.celo.org)               |
| `NEXT_PUBLIC_POSTHOG_KEY`        | PostHog analytics                                       |
| `NEXT_PUBLIC_USERJOT_PROJECT_ID` | UserJot feedback widget                                 |

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
cd contracts/verified-accounts && cargo near build non-reproducible-wasm

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
- RPC auto-detects: `rpc.mainnet.near.org`
