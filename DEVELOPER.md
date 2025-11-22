# Developer Guide - Self.xyz x NEAR Verification

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

- **Next.js 16** - React framework with App Router and Turbopack
- **TypeScript** - Type-safe development
- **TailwindCSS** - Utility-first styling
- **shadcn/ui** - Component library
- **@near-wallet-selector** - NEAR wallet integration (Meteor, MyNearWallet)
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

## Local Development Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/HackHumanityOrg/near-self-verify.git
cd near-self-verify

# Install dependencies
npm install

# Or with pnpm
pnpm install
```

### 2. Environment Configuration

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Environment Variables](#environment-variables) section below).

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### 4. Development Commands

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format with Prettier

# Smart Contract
npm run build:contract      # Build Rust contract
npm run lint:contract       # Lint with Clippy
npm run deploy:testnet      # Deploy to testnet
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

The NEAR smart contract (`contracts/verification-db/`) provides decentralized storage for verification records with these security features:

- **Access Control** - Only backend wallet can write
- **NEP-413 Verification** - Validates NEAR wallet signatures on-chain
- **Nullifier Checks** - Prevents passport reuse
- **Account Protection** - Prevents duplicate verifications
- **Public Reads** - Anyone can query verification status

### Contract Development

**Location:** `contracts/verification-db/`

**Build Contract:**

```bash
cd contracts/verification-db
cargo near build non-reproducible-wasm

# Or from root:
npm run build:contract
```

**Run Tests:**

```bash
cd contracts/verification-db
cargo test

# Lint with Clippy:
cargo clippy --all-targets -- -D warnings
# Or: npm run lint:contract
```

### Contract Deployment

**1. Create Contract Account:**

```bash
near account create-account fund-myself CONTRACT_ID.testnet '3 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as YOUR_ACCOUNT.testnet \
  network-config testnet sign-with-keychain send
```

**2. Deploy Contract:**

```bash
near contract deploy CONTRACT_ID.testnet \
  use-file contracts/verification-db/target/near/verification_db.wasm \
  without-init-call \
  network-config testnet sign-with-keychain send
```

**3. Initialize Contract:**

```bash
near contract call-function as-transaction CONTRACT_ID.testnet new \
  json-args '{"backend_wallet":"YOUR_BACKEND.testnet"}' \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  sign-as CONTRACT_ID.testnet \
  network-config testnet sign-with-keychain send
```

**4. Verify Deployment:**

```bash
# Check backend wallet
near contract call-function as-read-only CONTRACT_ID.testnet \
  get_backend_wallet json-args {} network-config testnet now

# Check count
near contract call-function as-read-only CONTRACT_ID.testnet \
  get_verified_count json-args {} network-config testnet now
```

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

### GET /api/verifications

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

The app uses a database abstraction layer (`lib/database.ts`) that exports:

```typescript
interface IVerificationDatabase {
  isNullifierUsed(nullifier: string): Promise<boolean>
  isAccountVerified(nearAccountId: string): Promise<boolean>
  storeVerification(data: VerificationDataWithSignature): Promise<void>
  getVerifiedAccount(nearAccountId: string): Promise<VerifiedAccount | null>
  getAllVerifiedAccounts(): Promise<VerifiedAccount[]>
}
```

**Current Implementation:** `NearContractDatabase` (lib/near-contract-db.ts)

- Connects to NEAR smart contract using @near-js packages
- Backend writes with private key authentication
- Public reads via RPC calls
- Supports pagination

**To Switch Implementations:**
Simply change the `createContractDatabase()` function to return a different implementation (e.g., PostgreSQL, MongoDB).

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
cd contracts/verification-db
cargo test
```

**Test Coverage:**

- Contract initialization
- Access control (only backend can write)
- Invalid signature handling
- Invalid nonce/signature length validation
- Nullifier uniqueness enforcement
- Read function correctness
- Pagination limits

**All 8 tests pass ✅**

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

**1. Push to GitHub:**

```bash
git push origin main
```

**2. Connect to Vercel:**

- Import GitHub repository in Vercel dashboard
- Or use CLI: `vercel --prod`

**3. Configure Environment Variables:**

In Vercel dashboard, add all environment variables from `.env`:

- `NEAR_CONTRACT_ID`
- `NEAR_ACCOUNT_ID`
- `NEAR_PRIVATE_KEY` (⚠️ Use Vercel secrets)
- `NEXT_PUBLIC_NEAR_NETWORK`
- `NEXT_PUBLIC_NEAR_RPC_URL`
- `NEXT_PUBLIC_SELF_ENDPOINT` (your Vercel URL)

**4. Deploy:**

Vercel will automatically deploy on push. Monitor build logs for issues.

**Build Configuration:**

- **Framework:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Node Version:** 18.x or higher

### Smart Contract Deployment

See [Smart Contract](#contract-deployment) section above for detailed steps.

**Quick Reference:**

```bash
# Build
npm run build:contract

# Deploy
npm run deploy:testnet

# Initialize
near contract call-function as-transaction $NEAR_CONTRACT_ID new \
  json-args '{"backend_wallet":"YOUR_BACKEND.testnet"}' \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  sign-as $NEAR_CONTRACT_ID network-config testnet sign-with-keychain send
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
├── app/
│   ├── api/
│   │   ├── verify/route.ts              # Main verification endpoint
│   │   └── verifications/route.ts       # Public list endpoint
│   ├── verifications/page.tsx           # Verifications list page
│   ├── layout.tsx                       # Root layout with footer
│   ├── page.tsx                         # Homepage with verification flow
│   └── globals.css                      # Global styles
│
├── components/
│   ├── verification-flow.tsx            # Multi-step verification UI
│   ├── self-verification.tsx            # Self.xyz QR code component
│   ├── near-wallet-button.tsx           # Wallet connect/disconnect
│   ├── footer.tsx                       # App footer
│   └── ui/                              # shadcn/ui components
│
├── lib/
│   ├── database.ts                      # Database abstraction layer
│   ├── near-contract-db.ts              # NEAR contract implementation
│   ├── near-wallet-provider.tsx         # NEAR wallet React context
│   ├── near-signature-verification.ts   # NEP-413 signature validation
│   ├── self-verifier.ts                 # Self.xyz verifier configuration
│   ├── config.ts                        # App constants and configuration
│   └── types.ts                         # TypeScript type definitions
│
├── contracts/
│   └── verification-db/                 # NEAR smart contract (Rust)
│       ├── src/lib.rs                   # Contract implementation
│       ├── Cargo.toml                   # Rust dependencies
│       └── target/near/                 # Compiled WASM output
│
├── public/                              # Static assets
├── .env                                 # Environment variables (gitignored)
├── .env.example                         # Example environment file
├── package.json                         # Node dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── tailwind.config.ts                   # Tailwind configuration
├── CLAUDE.md                            # AI assistant guidance
├── LICENSE                              # MIT License
├── README.md                            # User-facing documentation (this file)
└── DEVELOPER.md                         # Developer documentation (you are here)
```

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

Uses `@near-wallet-selector` with support for:

- Meteor Wallet (recommended - supports `signMessage`)
- MyNearWallet
- Any wallet implementing NEP-413 `signMessage` API

**Wallet Context:** `lib/near-wallet-provider.tsx`

- Provides React hooks: `useNearWallet()`
- Handles wallet connection/disconnection
- Implements NEP-413 message signing
- Manages wallet state across app

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

**Cause:** Wallet doesn't implement NEP-413 `signMessage` API

**Solution:**

- Use Meteor Wallet (full NEP-413 support)
- Or use MyNearWallet (also supports signMessage)
- Avoid wallets that don't implement NEP-413

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
- **Wallet Selector:** https://github.com/near/wallet-selector

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
