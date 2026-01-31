# NEAR Citizens House

[![Tests](https://img.shields.io/endpoint?url=https://hackhumanityorg.github.io/near-citizens-house/test-results.json)](https://github.com/HackHumanityOrg/near-citizens-house/actions)
[![Allure Report](https://img.shields.io/badge/Allure_Report-View-blueviolet)](https://hackhumanityorg.github.io/near-citizens-house/)

A pnpm workspace monorepo for NEAR governance and identity verification.

## Project Structure

```
near-citizens-house/
├── apps/
│   └── citizens-house/          # Main Next.js app (port 3000)
│       ├── app/                  # Next.js App Router pages
│       ├── components/           # React components (including ui/)
│       ├── lib/                  # Utilities, config, contracts client
│       ├── e2e/                  # Playwright E2E tests
│       └── scripts/              # Operational scripts
├── contracts/
│   ├── verified-accounts/        # Identity verification contract (Rust)
│   └── governance/               # Governance contract (planned)
├── checkly/                      # Synthetic monitoring
└── docs/                         # Documentation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment template and configure
cp .env.example .env
# Edit .env with your values (see Environment Configuration below)

# Run the app (port 3000)
pnpm dev
```

> **Prerequisites:** Node.js 18+, pnpm 8+

## Environment Configuration

Copy `.env.example` to `.env` and configure the required variables. See `.env.example` for detailed documentation.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_NEAR_NETWORK` | Yes | NEAR network (`testnet` or `mainnet`) |
| `NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT` | Yes | Verification contract ID |
| `NEXT_PUBLIC_APP_URL` | Yes | Deployed app URL (for Self.xyz callbacks) |
| `NEAR_ACCOUNT_ID` | Yes | Backend wallet account ID |
| `NEAR_PRIVATE_KEY` | Yes | Backend wallet private key (server-side only) |
| `REDIS_URL` | Yes | Redis URL for session storage |
| `NEXT_PUBLIC_SELF_NETWORK` | Yes | Self.xyz network (`testnet` or `mainnet`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect project ID for wallet support |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog API key for analytics |

## Available Scripts

**Development**

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run development server (port 3000) |
| `pnpm build` | Build for production |
| `pnpm lint` | Run linting |
| `pnpm format` | Format code with Prettier |

**Testing**

| Script | Description |
|--------|-------------|
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm test:contract:verification` | Run contract unit tests |

**Contracts**

| Script | Description |
|--------|-------------|
| `pnpm build:contract:verification` | Build verification contract (reproducible WASM) |
| `pnpm deploy:testnet:verification` | Deploy verification contract to testnet |

**Operations**

| Script | Description |
|--------|-------------|
| `pnpm register-backend-keys` | Register backend wallet keys on contract |
| `pnpm clean` | Clean build artifacts and node_modules |

## About Identity Verification

Link your real-world identity to your NEAR blockchain wallet using zero-knowledge proofs. Prove who you are without revealing personal information.

## What This App Does

If you want to verify your real-world identity for your NEAR wallet while maintaining privacy, this app provides a secure, privacy-preserving solution:

1. **Verify Your Identity** - Prove you have a valid government-issued ID (passport, biometric ID card, or Aadhaar)
2. **Protect Your Privacy** - Zero-knowledge proofs ensure no personal data is exposed
3. **Link to Blockchain** - Cryptographically connect your identity to your NEAR wallet
4. **Permanent Record** - Verification stored immutably on the NEAR blockchain
5. **Public Verification** - Anyone can verify account status without accessing private data
6. **Sybil Resistance** - Each identity document can only be used once, preventing duplicate accounts

## How It Works

### The Verification Process

**Step 1: Connect Your NEAR Wallet**

Connect your NEAR wallet using any compatible wallet (Meteor Wallet, MyNearWallet, etc.). The app needs access to your wallet to request a signature.

**Step 2: Sign a Message**

Your wallet will ask you to sign a message identifying you for the verification contract. This cryptographic signature proves you control the wallet address. No transaction is sent, and this is completely free.

**Step 3: Scan QR Code with Self App**

A QR code appears on screen. Using the Self mobile app, scan your document's NFC chip and generate a zero-knowledge proof. The proof confirms you have a valid government-issued ID without revealing any personal information like name, date of birth, or document number.

**Step 4: Verification Complete**

The app verifies both your wallet signature and identity proof, then stores this verification on the NEAR blockchain. Your identity is now cryptographically linked to your NEAR wallet.

### What Gets Verified?

✅ **Verified:**

- You own the NEAR wallet (via cryptographic signature)
- You possess a valid government-issued ID (via ZK proof)
- Your document is authentic and hasn't been used to verify another wallet

❌ **NOT Stored or Revealed:**

- Your name
- Date of birth
- Document number
- Nationality
- Photo
- Any other personal information

### Privacy & Security

**Zero-Knowledge Proofs:**
The verification uses advanced cryptography called zero-knowledge proofs. Think of it like proving you're over 18 without showing your ID - you can prove something is true without revealing the underlying data.

**What's Stored On-Chain:**

- A unique identifier (nullifier) from your document - this prevents the same document from being used twice
- Your NEAR wallet address
- Timestamp of verification
- Type of document used (passport, biometric ID card, or Aadhaar)
- The ZK proof itself (for independent re-verification)

**Defense-in-Depth Security:**

- Self.xyz backend verifies the identity proof
- NEAR smart contract independently verifies your wallet signature
- Both must pass for verification to succeed

## View Verified Accounts

Anyone can view the list of verified NEAR accounts without accessing any private data. Each entry shows the wallet address, document type, and verification timestamp - no personal information is ever revealed.

**Public Verification List:** `/citizens` route on your deployed instance

## Important Notes

**Privacy First:**
Your personal information never leaves your device or the Self.xyz secure enclave. Only cryptographic proofs are transmitted and stored.

**One Document, One Wallet:**
Each identity document can only verify one NEAR wallet. This prevents Sybil attacks (multiple accounts per person) in applications that require unique identities.

**Immutable Verification:**
Once verified, the record is permanently stored on the NEAR blockchain and cannot be changed or deleted. This provides strong guarantees but means you should verify with the wallet you intend to use long-term.

**Waiting Period:**
The verification process typically takes 1-2 minutes to complete as it involves:

- Generating zero-knowledge proofs on your mobile device
- Backend verification of cryptographic proofs
- On-chain transaction confirmation

## Resources

- **Self.xyz Protocol** - [https://self.xyz](https://self.xyz) | [Documentation](https://docs.self.xyz)
- **NEAR Protocol** - [https://near.org](https://near.org) | [Documentation](https://docs.near.org)
- **NEAR Explorer** - [NearBlocks Testnet](https://testnet.nearblocks.io) | [NearBlocks Mainnet](https://nearblocks.io)
- **Wallet Selector** - [NEAR Wallet Selector](https://github.com/near/wallet-selector)

## Support

Questions or issues? Open an issue on [GitHub](https://github.com/HackHumanityOrg/near-citizens-house/issues) or reach out to the team.

---

**Created by** [HackHumanity](https://hackhumanity.com) • **Powered by** [Self.xyz](https://self.xyz) • **License:** MIT
