# Developer Guide - NEAR Citizens House

Technical documentation for developers who want to set up, deploy, customize, or contribute to this identity verification application.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Smart Contract](#smart-contract)
- [API Documentation](#api-documentation)
- [Database Layer](#database-layer)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Architecture Overview

### Technology Stack

**Frontend:**

- **Next.js 16** - React framework with App Router and webpack
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first styling
- **shadcn/ui** - Component library
- **@hot-labs/near-connect** - NEAR wallet integration (HOT Connector)
- **@selfxyz/qrcode** - Self.xyz QR code generation

**Backend:**

- **Next.js API Routes** - Serverless functions
- **@selfxyz/core** - Self.xyz proof verification SDK
- **@near-js packages** - NEAR blockchain interaction

**Smart Contract:**

- **Rust + near-sdk** - NEAR Protocol smart contract
- **On-chain storage** - Permanent verification records
- **NEP-413** - NEAR signature standard implementation

### Architecture Flow

```
┌─────────────┐
│   Browser   │
│   (User)    │
└──────┬──────┘
       │ 1. Connect Wallet
       │ 2. Sign NEP-413 Message
       ▼
┌─────────────────┐
│   NEAR Wallet   │
│   (Signature)   │
└──────┬──────────┘
       │ 3. Embedded in QR
       ▼
┌──────────────────┐         ┌─────────────────┐
│   Self Mobile    │────────▶│  Self Backend   │
│   (NFC Scan)     │  4. ZK  │   (Verify ZK)   │
└──────────────────┘  Proof  └────────┬────────┘
                                       │ 5. Relay Proof
                                       ▼
                              ┌────────────────────┐
                              │   Your Backend     │
                              │  /api/verify       │
                              │                    │
                              │  1. Verify Self ZK │
                              │  2. Verify NEAR Sig│
                              └────────┬───────────┘
                                       │ 6. Store
                                       ▼
                              ┌────────────────────┐
                              │  NEAR Contract     │
                              │  v1.widefile...    │
                              │                    │
                              │  1. Re-verify Sig  │
                              │  2. Check Nullifier│
                              │  3. Store On-Chain │
                              └────────────────────┘
```

**Defense-in-Depth Security:**

1. Self.xyz backend verifies passport proof
2. Your backend verifies NEAR wallet signature
3. Smart contract independently verifies signature again
4. Smart contract checks nullifier uniqueness

---

## Prerequisites

### Required Software

- **Node.js 18+** - JavaScript runtime
- **pnpm, npm, or bun** - Package manager
- **Rust 1.86.0** - For smart contract development (⚠️ 1.87+ has WASM incompatibility)
- **cargo-near** - NEAR smart contract build tool
- **NEAR CLI** - For contract deployment and management
- **Git** - Version control

### Required Accounts & Services

- **NEAR Testnet Account** - For deploying contracts ([wallet.testnet.near.org](https://wallet.testnet.near.org))
- **Vercel Account** - For deploying the frontend (or any hosting platform)
- **Self Mobile App** - For testing verification flow ([https://self.xyz](https://self.xyz))

### Rust Setup (for Smart Contracts)

```bash
# Install Rust 1.86 specifically (required for NEAR contracts)
rustup install 1.86
rustup default 1.86

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install cargo-near
cargo install cargo-near

# Verify installation
rustup show
cargo near --version
```

---

## Monorepo Structure

This is a **pnpm workspace monorepo** with the following structure:

```
├── apps/
│   ├── verified-accounts/      # Identity verification app (port 3000)
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   └── package.json
│   └── citizens-house/         # DAO governance app (port 3001)
│       ├── app/
│       ├── components/
│       ├── lib/
│       └── package.json
├── packages/
│   ├── ui/                     # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.ts
│   │   └── package.json
│   └── shared/                 # Shared utilities and integrations
│       ├── src/
│       │   ├── database.ts
│       │   ├── types.ts
│       │   ├── utils.ts
│       │   └── config.ts
│       └── package.json
├── contracts/
│   ├── verified-accounts/      # Identity verification contract (Rust)
│   ├── verified-accounts-interface/  # Interface for cross-contract calls
│   ├── sputnik-bridge/         # Bridge contract for SputnikDAO integration
│   ├── sputnik-dao-interface/  # Interface for SputnikDAO v2 cross-contract calls
│   └── sputnik-dao-contract/   # SputnikDAO v2 (git submodule, pre-built WASM)
├── pnpm-workspace.yaml
├── package.json
└── .env
```

**Environment variables** are shared at the root `.env` file and inherited by all apps and packages.

---

## Local Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/HackHumanityOrg/near-citizens-house.git
cd near-citizens-house

# Install dependencies (uses pnpm workspace)
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Environment Variables](#environment-variables) section below).

### 3. Run Development Server

**Option A: All apps at once**

```bash
pnpm dev:all
```

This starts both verified-accounts (port 3000) and citizens-house (port 3001) simultaneously.

**Option B: Individual apps**

```bash
# Identity verification app only
pnpm dev:verification

# DAO governance app only
pnpm dev:governance
```

Open [http://localhost:3000](http://localhost:3000) for verified-accounts or [http://localhost:3001](http://localhost:3001) for citizens-house.

### 4. Development Commands

```bash
# All apps (runs in root)
pnpm dev:all              # Start all apps simultaneously
pnpm build:all            # Build all apps for production
pnpm lint:all             # Lint all apps
pnpm format:all           # Format all apps with Prettier

# Verified Accounts app (identity verification)
pnpm dev:verification     # Start verified-accounts dev server (port 3000)
pnpm build:verification   # Build verified-accounts for production
pnpm lint:verification    # Lint verified-accounts

# Citizens House app (DAO governance)
pnpm dev:governance       # Start citizens-house dev server (port 3001)
pnpm build:governance     # Build citizens-house for production

# Smart Contracts
pnpm build:contracts:all  # Build all Rust contracts
pnpm lint:contracts:all   # Lint all contracts with Clippy
pnpm test:contracts:all   # Run all contract tests

# Individual contracts
pnpm build:contract:verification  # Build verified-accounts contract
pnpm build:contract:bridge        # Build sputnik-bridge contract
```

---

## Environment Variables

### Required (Backend - Server-Side Only)

⚠️ **Never commit these to version control or expose to the client**

| Variable           | Description                               | Example                   |
| ------------------ | ----------------------------------------- | ------------------------- |
| `NEAR_CONTRACT_ID` | Smart contract account address            | `v1.widefile4023.testnet` |
| `NEAR_ACCOUNT_ID`  | Backend wallet that can write to contract | `widefile4023.testnet`    |
| `NEAR_PRIVATE_KEY` | Private key for backend wallet            | `ed25519:5A...XYZ`        |

### Required (Frontend - Public)

| Variable                    | Description                      | Example                                  |
| --------------------------- | -------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_NEAR_NETWORK`  | NEAR network (testnet/mainnet)   | `testnet`                                |
| `NEXT_PUBLIC_NEAR_RPC_URL`  | NEAR RPC endpoint                | `https://rpc.testnet.near.org`           |
| `NEXT_PUBLIC_SELF_ENDPOINT` | Your app's verification endpoint | `https://your-app.vercel.app/api/verify` |

### Security Notes

- Private keys should ONLY exist in server environment (Vercel secrets, not .env committed to git)
- `.env` is in `.gitignore` to prevent accidental commits
- Use Vercel environment variables for production
- Backend wallet is the ONLY account authorized to write to the contract

---

## Smart Contract

### Overview

The NEAR smart contract (`contracts/verified-accounts/`) provides decentralized storage for verification records with these security features:

- **Access Control** - Only backend wallet can write
- **NEP-413 Verification** - Validates NEAR wallet signatures on-chain
- **Nullifier Checks** - Prevents passport reuse
- **Account Protection** - Prevents duplicate verifications
- **Public Reads** - Anyone can query verification status

### Contract Development

**Location:** `contracts/verified-accounts/`

**Interface Crate:** `contracts/verified-accounts-interface/` provides types and `#[ext_contract]` trait for cross-contract calls.

**Build Contract:**

```bash
cd contracts/verified-accounts
cargo near build non-reproducible-wasm

# Or from root:
npm run build:contract
```

**Run Tests:**

```bash
cd contracts/verified-accounts
cargo test

# Lint with Clippy:
cargo clippy --all-targets -- -D warnings
# Or: npm run lint:contract
```

### Contract Deployment

This project uses **`cargo-near`** for building and deploying contracts, with credentials stored in the **macOS Keychain** (or legacy keychain on other platforms).

#### Prerequisites

```bash
# Install cargo-near
cargo install cargo-near

# Verify installation
cargo near --version
```

#### Keychain Setup

When you create a contract account, credentials are saved to the system keychain. On macOS, this uses the native Keychain. On Linux/WSL, use `save-to-legacy-keychain` instead.

```bash
# Check existing keychain accounts
cat ~/.near-credentials/accounts.json
```

#### Fresh Deployment (New Contract)

**1. Create Contract Account:**

The contract account needs at least **3 NEAR** for storage and gas costs.

```bash
# Create a sub-account for the contract (e.g., v1.YOUR_ACCOUNT.testnet)
# This saves credentials to your system keychain
cargo near create-dev-account use-specific-seed-phrase '<YOUR_SEED_PHRASE>' \
  --account-id v1.YOUR_ACCOUNT.testnet \
  network-config testnet create
```

Or using an existing funded account:

```bash
near account create-account fund-myself v1.YOUR_ACCOUNT.testnet '3 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as YOUR_ACCOUNT.testnet \
  network-config testnet sign-with-keychain send
```

**2. Build and Deploy Contract:**

The `cargo near deploy` command builds and deploys in one step:

```bash
# From the contract directory (e.g., contracts/verified-accounts)
cd contracts/verified-accounts

# Build and deploy using keychain credentials
cargo near deploy build-non-reproducible-wasm v1.YOUR_ACCOUNT.testnet \
  without-init-call \
  network-config testnet sign-with-keychain send
```

Or build separately first:

```bash
# Build only
cargo near build non-reproducible-wasm

# Deploy pre-built WASM (from project root)
near contract deploy v1.YOUR_ACCOUNT.testnet \
  use-file contracts/verified-accounts/target/near/verified_accounts.wasm \
  without-init-call \
  network-config testnet sign-with-keychain send
```

**3. Initialize Contract:**

```bash
near contract call-function as-transaction v1.YOUR_ACCOUNT.testnet new \
  json-args '{"backend_wallet":"YOUR_BACKEND.testnet"}' \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  sign-as v1.YOUR_ACCOUNT.testnet \
  network-config testnet sign-with-keychain send
```

**4. Verify Deployment:**

```bash
# Check backend wallet
near contract call-function as-read-only v1.YOUR_ACCOUNT.testnet \
  get_backend_wallet json-args {} network-config testnet now

# Check count (should be 0 for fresh deployment)
near contract call-function as-read-only v1.YOUR_ACCOUNT.testnet \
  get_verified_count json-args {} network-config testnet now
```

#### Upgrading Contract (Preserve State)

To upgrade an existing contract while **preserving all stored verification data**:

```bash
# From the contract directory
cd contracts/verified-accounts

# Build and deploy in one command (do NOT init again)
cargo near deploy build-non-reproducible-wasm v1.YOUR_ACCOUNT.testnet \
  without-init-call \
  network-config testnet sign-with-keychain send
```

**Verify the upgrade preserved state:**

```bash
# Check count - should show existing verifications
near contract call-function as-read-only v1.YOUR_ACCOUNT.testnet \
  get_verified_count json-args {} network-config testnet now
```

> **Note:** When upgrading in place:
>
> - Do NOT call `new` again (this would fail or reset state)
> - State is preserved as long as data structures are compatible
> - If you change the contract's data schema, you may need state migration

#### Bridge Contract Deployment

The sputnik-bridge contract connects verified accounts to SputnikDAO. For detailed deployment instructions including DAO setup and policy configuration, see [SPUTNIK_BRIDGE_DEPLOYMENT.md](SPUTNIK_BRIDGE_DEPLOYMENT.md).

**Quick Reference:**

```bash
# From the bridge contract directory
cd contracts/sputnik-bridge

# Build and deploy
cargo near deploy build-non-reproducible-wasm sputnik-bridge-v1.YOUR_ACCOUNT.testnet \
  without-init-call \
  network-config testnet sign-with-keychain send
```

Initialize with required contract references:

```bash
near contract call-function as-transaction sputnik-bridge-v1.YOUR_ACCOUNT.testnet new \
  json-args '{
    "backend_wallet":"YOUR_BACKEND.testnet",
    "sputnik_dao":"sputnik-dao-v1.YOUR_ACCOUNT.testnet",
    "verified_accounts_contract":"verification-v1.YOUR_ACCOUNT.testnet",
    "citizen_role":"citizen"
  }' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' \
  sign-as sputnik-bridge-v1.YOUR_ACCOUNT.testnet \
  network-config testnet sign-with-keychain send
```

#### Deleting a Contract

NEAR contracts with stored state cannot be easily deleted. If you see:

```
Error: Delete account <CONTRACT_ID> whose state is large is temporarily banned.
```

**Options:**

1. **Deploy new version** - Create a new sub-account (e.g., `v2.YOUR_ACCOUNT.testnet`)
2. **Add clear function** - Implement a migration/clear function in the contract
3. **Upgrade in place** - Deploy new code over existing contract (preserves state)

#### Funding Requirements

| Action          | Approximate Cost |
| --------------- | ---------------- |
| Create account  | ~0.1 NEAR        |
| Deploy contract | ~1-2 NEAR        |
| Initialize      | ~0.01 NEAR       |
| Store 1 record  | ~0.01 NEAR       |
| **Recommended** | **3+ NEAR**      |

> **Tip:** Keep at least 1 NEAR in reserve for transaction gas fees

### Contract Methods

**Write Methods** (Backend Only):

```rust
store_verification(
  nullifier: String,
  near_account_id: AccountId,
  user_id: String,
  attestation_id: String,
  signature_data: NearSignatureData
)
```

**Read Methods** (Public):

- `get_backend_wallet()` - Returns authorized backend account
- `get_verified_count()` - Total number of verified accounts
- `get_verified_accounts(from_index, limit)` - Paginated list (max 100)
- `get_verified_account(near_account_id)` - Single account details
- `is_nullifier_used(nullifier)` - Check if passport already used
- `is_account_verified(account_id)` - Check if account verified

**Composability Methods** (For Cross-Contract Calls):

- `get_verification_status(account_id)` - Lightweight status without proof data (gas-efficient)
- `are_accounts_verified(Vec<account_id>)` - Batch boolean check (max 100, for DAO voting)
- `get_verification_statuses(Vec<account_id>)` - Batch status check (max 100)
- `interface_version()` - Returns "1.0.0" for compatibility checking
- `contract_source_metadata()` - NEP-330 metadata

---

## API Documentation

### POST /api/verify

Verifies Self.xyz proof and NEAR signature, stores verification on-chain.

**Request Body:**

```typescript
{
  proof: {
    // Self.xyz ZK proof data
  },
  publicSignals: string[],
  userContextData: {
    nearSignature: {
      accountId: string,
      signature: string,
      publicKey: string,
      challenge: string,
      nonce: number[],
      recipient: string
    }
  }
}
```

**Response:**

```typescript
{
  status: "success" | "error",
  result: boolean,
  reason?: string,
  attestationId?: string
}
```

**Error Codes:**

- `400` - Invalid proof or signature format
- `403` - Nullifier already used (duplicate passport)
- `500` - Verification or storage failed

### GET /api/verified-accounts

Returns paginated list of all verified accounts.

**Query Parameters:**

- `page` (number) - Page number (0-indexed)
- `pageSize` (number) - Items per page (default: 20, max: 100)

**Response:**

```typescript
{
  accounts: VerifiedAccount[],
  total: number,
  page: number,
  pageSize: number
}
```

---

## Database Layer

### Abstraction Pattern

The shared database abstraction layer (`packages/shared/src/database.ts`) exports:

```typescript
interface IVerificationDatabase {
  isAccountVerified(nearAccountId: string): Promise<boolean>
  storeVerification(data: VerificationDataWithSignature): Promise<void>
  getVerifiedAccount(nearAccountId: string): Promise<VerifiedAccount | null>
  getAllVerifiedAccounts(): Promise<VerifiedAccount[]>
}
```

**Note:** Nullifier uniqueness is validated by the contract during `store_verification()`. No separate pre-check method exists to avoid unnecessary RPC overhead.

**Current Implementation:** `NearContractDatabase` (`packages/shared/src/near-contract-db.ts`)

- Connects to NEAR smart contract using @near-js packages
- Backend writes with private key authentication
- Public reads via RPC calls
- Supports pagination

**Usage:** Both apps import from the shared package:

```typescript
import { db, IVerificationDatabase } from "@near-citizens-house/shared"
```

**To Switch Implementations:**
Simply change the implementation in `packages/shared/src/database.ts` to return a different database backend (e.g., PostgreSQL, MongoDB). All apps will automatically use the new implementation.

### Data Models

**VerifiedAccount:**

```typescript
{
  nullifier: string // Unique passport identifier
  nearAccountId: string // NEAR wallet address
  userId: string // Self.xyz user identifier
  attestationId: string // Document type (1=Passport, 2=BiometricID, 3=Aadhaar)
  verifiedAt: number // Timestamp (milliseconds)
}
```

**NearSignatureData:**

```typescript
{
  accountId: string
  signature: string         // Base64 encoded
  publicKey: string         // NEAR public key
  challenge: string         // Message that was signed
  timestamp: number
  nonce: number[]          // 32-byte NEP-413 nonce
  recipient: string        // NEP-413 recipient
}
```

---

## Testing

### Contract Tests

```bash
cd contracts/verified-accounts
cargo test
```

**Test Coverage:**

**verified-accounts contract:**
- Contract initialization
- Access control (only backend can write)
- Invalid signature handling
- Invalid nonce/signature length validation
- Nullifier uniqueness enforcement
- Read function correctness
- Pagination limits
- Input validation (size constraints)

**sputnik-bridge contract:**
- Member addition flow
- Proposal creation
- Dynamic quorum updates
- Access control and backend wallet rotation
- Event emission
- Cross-contract call handling

Run all contract tests:
```bash
pnpm test:contracts:all  # 48 unit + 23 integration (verified-accounts), 58 (sputnik-bridge)
```

### Frontend Testing

Currently no automated frontend tests. Manual testing checklist:

- [ ] Connect wallet (Meteor Wallet recommended)
- [ ] Sign NEP-413 message
- [ ] Generate Self.xyz QR code
- [ ] Scan with Self mobile app
- [ ] Verify backend receives proof
- [ ] Check on-chain storage
- [ ] View verifications list
- [ ] Test pagination

---

## Deployment

### Frontend Deployment (Vercel)

#### Verified Accounts App

**1. Push to GitHub:**

```bash
git push origin main
```

**2. Create Vercel project for verified-accounts:**

- Create new project in Vercel dashboard
- Select GitHub repository
- Set **Root Directory** to `apps/verified-accounts`
- Or use CLI: `vercel --prod --cwd apps/verified-accounts`

**3. Configure Environment Variables:**

In Vercel dashboard, add all environment variables:

- `NEAR_CONTRACT_ID`
- `NEAR_ACCOUNT_ID`
- `NEAR_PRIVATE_KEY` (⚠️ Use Vercel secrets - server-side only)
- `NEXT_PUBLIC_NEAR_NETWORK`
- `NEXT_PUBLIC_NEAR_RPC_URL`
- `NEXT_PUBLIC_SELF_ENDPOINT` (your Vercel URL)
- `CELO_RPC_URL`
- `SELF_USE_MOCK_PASSPORT`

**4. Deploy:**

Vercel will automatically deploy on push. Monitor build logs for issues.

**Build Configuration:**

- **Framework:** Next.js
- **Root Directory:** `apps/verified-accounts`
- **Build Command:** `pnpm build:verification`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install --frozen-lockfile`
- **Node Version:** 18.x or higher

#### Citizens House App

**1. Create separate Vercel project for citizens-house:**

- Create new project in Vercel dashboard
- Select same GitHub repository
- Set **Root Directory** to `apps/citizens-house`

**2. Configure Environment Variables:** (same as above)

**3. Build Configuration:**

- **Framework:** Next.js
- **Root Directory:** `apps/citizens-house`
- **Build Command:** `pnpm build:governance`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install --frozen-lockfile`

### Smart Contract Deployment

See [Smart Contract](#contract-deployment) section above for detailed steps.

**Quick Reference - Fresh Deployment:**

```bash
# 1. Create contract account (needs ~3 NEAR)
near account create-account fund-myself v1.YOUR_ACCOUNT.testnet '3 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as YOUR_ACCOUNT.testnet \
  network-config testnet sign-with-keychain send

# 2. Build and deploy (from contract directory)
cd contracts/verified-accounts
cargo near deploy build-non-reproducible-wasm v1.YOUR_ACCOUNT.testnet \
  without-init-call \
  network-config testnet sign-with-keychain send

# 3. Initialize
near contract call-function as-transaction v1.YOUR_ACCOUNT.testnet new \
  json-args '{"backend_wallet":"YOUR_BACKEND.testnet"}' \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  sign-as v1.YOUR_ACCOUNT.testnet \
  network-config testnet sign-with-keychain send
```

**Quick Reference - Upgrade (Preserve State):**

```bash
# From contract directory - build and deploy in one step (do NOT init again)
cd contracts/verified-accounts
cargo near deploy build-non-reproducible-wasm v1.YOUR_ACCOUNT.testnet \
  without-init-call \
  network-config testnet sign-with-keychain send

# Verify state preserved
near contract call-function as-read-only v1.YOUR_ACCOUNT.testnet \
  get_verified_count json-args {} network-config testnet now
```

**Quick Reference - Bridge Contract Upgrade:**

```bash
cd contracts/sputnik-bridge
cargo near deploy build-non-reproducible-wasm sputnik-bridge-v1.YOUR_ACCOUNT.testnet \
  without-init-call \
  network-config testnet sign-with-keychain send
```

### Production Checklist

**Security:**

- [ ] Private keys in Vercel environment (not committed)
- [ ] `mockPassport: false` in production (currently `true` for testnet)
- [ ] OFAC checking enabled if required by your jurisdiction
- [ ] Rate limiting on `/api/verify` endpoint
- [ ] HTTPS enforced on all endpoints

**Configuration:**

- [ ] Update `NEXT_PUBLIC_SELF_ENDPOINT` to production URL
- [ ] Verify NEAR network setting (testnet vs mainnet)
- [ ] Contract deployed to appropriate network
- [ ] Backend wallet funded with sufficient NEAR for transactions

**Monitoring:**

- [ ] Error tracking (Sentry, LogRocket, etc.)
- [ ] Analytics (Vercel Analytics, Google Analytics)
- [ ] Contract storage monitoring
- [ ] Gas usage monitoring

---

## File Structure

```
near-citizens-house/
├── apps/
│   ├── verified-accounts/               # Identity verification app (port 3000)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── verify/route.ts      # Main verification endpoint
│   │   │   │   └── verified-accounts/   # List endpoints
│   │   │   ├── verified-accounts/page.tsx
│   │   │   ├── layout.tsx               # Root layout
│   │   │   ├── page.tsx                 # Homepage with verification flow
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── verification-flow.tsx
│   │   │   ├── self-verification.tsx
│   │   │   ├── near-wallet-button.tsx
│   │   │   └── shared/
│   │   ├── lib/
│   │   │   ├── config.ts
│   │   │   └── types.ts
│   │   ├── public/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── citizens-house/                  # DAO governance app (port 3001)
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── public/
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── ui/                              # Shared UI components
│   │   ├── src/
│   │   │   ├── components/              # Reusable UI components
│   │   │   ├── hooks/                   # Custom React hooks
│   │   │   ├── index.ts
│   │   │   └── globals.css
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                          # Shared utilities and integrations
│       ├── src/
│       │   ├── config.ts                # App configuration
│       │   ├── types.ts                 # Shared TypeScript types
│       │   ├── verification.ts          # Verification logic
│       │   ├── verification-contract.ts # Verified accounts contract client
│       │   ├── bridge-contract.ts       # Sputnik bridge contract client
│       │   ├── sputnik-dao-contract.ts  # SputnikDAO contract client
│       │   ├── sputnik-dao-types.ts     # DAO type definitions
│       │   ├── self-verifier.ts         # Self.xyz verifier
│       │   └── zk-verify.ts             # ZK proof verification
│       ├── package.json
│       └── tsconfig.json
│
├── contracts/
│   ├── verified-accounts/               # Identity verification contract
│   │   ├── src/lib.rs                   # Contract implementation
│   │   ├── tests/integration.rs         # Integration tests
│   │   ├── Cargo.toml
│   │   └── target/near/                 # Compiled WASM output
│   ├── verified-accounts-interface/     # Interface for cross-contract calls
│   ├── sputnik-bridge/                  # Bridge to SputnikDAO
│   │   ├── src/lib.rs                   # Bridge implementation
│   │   ├── tests/                       # Test files
│   │   ├── dao-policy.json              # Example DAO policy
│   │   └── target/near/
│   ├── sputnik-dao-interface/           # SputnikDAO v2 interface
│   └── sputnik-dao-contract/            # Pre-built SputnikDAO (submodule)
│       └── sputnikdao2/res/sputnikdao2.wasm
│
├── docs/                                # Documentation
│   ├── DEVELOPER.md                     # Developer guide (this file)
│   ├── SPUTNIK_BRIDGE_DEPLOYMENT.md     # Bridge deployment playbook
│   └── ...                              # Other docs
│
├── pnpm-workspace.yaml                  # pnpm workspace config
├── package.json                         # Root package.json with scripts
├── .env                                 # Environment variables (gitignored)
├── .env.example                         # Example environment file
├── CLAUDE.md                            # AI assistant guidance
├── LICENSE                              # MIT License
└── README.md                            # User-facing documentation
```

**Key Points:**

- **Shared packages** (`packages/`) are installed as dependencies in both apps
- **Environment variables** are at the root and inherited by all apps/packages
- **Contracts** remain at the root level (unchanged from previous structure)
- Each app has its own `package.json`, `tsconfig.json`, and Next.js configuration
- UI components are published to `packages/ui` for reuse across apps
- Shared utilities and database logic are in `packages/shared`

---

## Key Implementation Details

### NEP-413 Signature Verification

The contract implements the full NEP-413 standard for NEAR message signing:

1. **Prefix Tag:** `2^31 + 413 = 2147484061` (prevents transaction replay attacks)
2. **Borsh Serialization:** Payload structure serialized according to NEP-413 spec
3. **SHA-256 Hashing:** Message hash is what gets signed
4. **Ed25519 Verification:** Contract uses `env::ed25519_verify()` to validate

**Reference:** [NEP-413 Specification](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)

### Self.xyz Integration

**Backend Verifier Configuration** (lib/self-verifier.ts):

```typescript
new SelfBackendVerifier(
  scope, // Verification scope
  endpoint, // Your /api/verify endpoint
  mockPassport, // false for production
  AllowedAttestationIds, // Document types accepted
  configStore, // Verification config (age, OFAC)
  "uuid", // User ID type
)
```

**Attestation Types:**

- `1` = Passport
- `2` = Biometric ID Card
- `3` = Aadhaar

### NEAR Wallet Integration

Uses `@hot-labs/near-connect` (HOT Connector) for wallet connections.

**Wallet Context:** `lib/near-wallet-provider.tsx`

- Provides React hooks: `useNearWallet()`
- Handles wallet connection/disconnection via `NearConnector`
- Implements NEP-413 message signing
- Manages wallet state across app
- Supports auto-connect and session persistence

**Example Usage:**

```typescript
import { NearConnector } from "@hot-labs/near-connect"

const connector = new NearConnector({
  network: "testnet",
  autoConnect: true,
})

// Event handlers
connector.on("wallet:signIn", (payload) => {
  /* ... */
})
connector.on("wallet:signOut", () => {
  /* ... */
})

// Sign NEP-413 messages
const wallet = await connector.wallet()
await wallet.signMessage({ message, recipient, nonce })
```

---

## Troubleshooting

### Common Issues

**"Please provide a public key" Error**

**Cause:** @near-js package version incompatibility

**Solution:**

- Ensure all @near-js packages are compatible versions
- Current working setup uses individual @near-js packages v2.x
- Use `KeyPairSigner` for backend signing (not deprecated `InMemorySigner`)

**"Wallet does not support message signing"**

**Cause:** Connected wallet doesn't implement NEP-413 `signMessage` API

**Solution:**

- Ensure wallet supports NEP-413 message signing
- Try reconnecting with a different wallet
- Check HOT Connector wallet compatibility list

**"Self verification failed"**

**Possible causes:**

- `scope` mismatch between frontend QR and backend verifier
- `endpoint` URL not accessible from Self.xyz relayer
- `mockPassport` setting incorrect for environment
- Self mobile app version incompatible

**Solution:**

- Verify `lib/config.ts` has matching scope with `lib/self-verifier.ts`
- Ensure endpoint is publicly accessible (not localhost in production)
- Check `mockPassport: true` for testnet, `false` for production

**"Invalid NEAR signature - NEP-413 verification failed"**

**Cause:** Signature verification mismatch

**Solutions:**

- Verify contract has correct NEP-413 implementation (not raw byte concatenation)
- Check nonce is exactly 32 bytes
- Ensure signature, publicKey, and accountId match
- Verify recipient matches accountId

**Contract "Cannot deserialize" Error**

**Cause:** Contract state schema changed (e.g., after removing merkle_root)

**Solution:**

- Deploy fresh contract (state is incompatible with old schema)
- Or implement state migration (advanced)

### Development Tips

**Testing Locally:**

- Self.xyz doesn't allow `localhost` endpoints
- Use the demo endpoint fallback in `components/self-verification.tsx` for local dev
- Or use a tunnel service (ngrok, CloudFlare Tunnel) to expose localhost

**Debugging Contract Calls:**

- Check transaction on [NEAR Explorer](https://explorer.testnet.near.org)
- View contract state with `near contract call-function as-read-only`
- Add logging in contract (use `env::log_str`)

**Cache Issues:**

- Delete `.next` folder if seeing stale environment variables
- Clear browser cache for wallet selector issues
- Rebuild contract with `cargo clean` if seeing WASM issues

---

## NEAR SDK API Compatibility

The @near-js packages have specific API requirements (documented in CLAUDE.md):

```typescript
// Account constructor
new Account(accountId: string, provider: Provider, signer: Signer)

// KeyPair requires type assertion
KeyPair.fromString(privateKey as any)

// Function calls use BigInt
actionCreators.functionCall(methodName, args, BigInt("30000000000000"), BigInt("0"))
```

---

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Run linting:** `npm run lint && npm run lint:contract`
5. **Test thoroughly** (manual testing checklist above)
6. **Commit with clear message**
7. **Push and create Pull Request**

### Code Style

- **TypeScript:** Strict mode, no `any` without ESLint suppression
- **Formatting:** Prettier (auto-formatted on commit)
- **Linting:** ESLint + Clippy for Rust
- **Comments:** Explain why, not what
- **Type Safety:** Prefer library types over custom types

### AI Assistance

This project includes `CLAUDE.md` with guidance for Claude Code (AI assistant). When working on this codebase with AI tools, the CLAUDE.md file provides important context about:

- Architecture decisions
- API compatibility notes
- Common issues and solutions
- Development patterns

---

## Additional Documentation

- **CLAUDE.md** - AI assistant guidance for this codebase
- **NEP413_FIX_SUMMARY.md** - NEP-413 signature verification implementation
- **CONTRACT_LINTING_SUMMARY.md** - Clippy linting configuration
- **MERKLE_ROOT_REMOVAL.md** - Why merkle_root field was removed
- **COMPLETE_OPTIMIZATION_SUMMARY.md** - Code quality improvements
- **LICENSE** - MIT License

---

## Resources

### Self.xyz

- **Documentation:** https://docs.self.xyz
- **Quickstart:** https://docs.self.xyz/use-self/quickstart
- **GitHub:** https://github.com/selfxyz/self

### NEAR Protocol

- **Documentation:** https://docs.near.org
- **Smart Contracts:** https://docs.near.org/smart-contracts
- **NEP-413 Spec:** https://github.com/near/NEPs/blob/master/neps/nep-0413.md
- **HOT Connector:** https://github.com/here-wallet/near-connect

### Development Tools

- **cargo-near:** https://github.com/near/cargo-near
- **NEAR CLI:** https://docs.near.org/tools/near-cli
- **Vercel:** https://vercel.com/docs

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

## Support

For development questions or issues:

- Open an issue: [GitHub Issues](https://github.com/HackHumanityOrg/near-self-verify/issues)
- NEAR Discord: [near.chat](https://near.chat)
- Self.xyz Support: [self.xyz](https://self.xyz)

---

**Created by** [HackHumanity](https://hackhumanity.com) • **Built with** [Self.xyz](https://self.xyz) & [NEAR Protocol](https://near.org)
