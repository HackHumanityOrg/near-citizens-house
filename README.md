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
| `NEXT_PUBLIC_APP_URL` | Yes | Deployed app URL |
| `NEAR_ACCOUNT_ID` | Yes | Backend wallet account ID |
| `NEAR_PRIVATE_KEY` | Yes | Backend wallet private key (server-side only) |
| `REDIS_URL` | Yes | Redis URL for session storage |
| `SUMSUB_APP_TOKEN` | Yes | SumSub API token |
| `SUMSUB_SECRET_KEY` | Yes | SumSub secret key |
| `SUMSUB_WEBHOOK_SECRET` | Yes | SumSub webhook signature secret |
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

Link your real-world identity to your NEAR blockchain wallet using SumSub identity verification. Prove you're a unique individual and connect your verified identity to your wallet.

## What This App Does

If you want to verify your real-world identity for your NEAR wallet, this app provides a secure solution:

1. **Verify Wallet Ownership** - Sign a message with your NEAR wallet to prove you control it
2. **Complete ID Verification** - Verify your identity through SumSub (ID document photo + selfie liveness check)
3. **Link to Blockchain** - Your verification status is stored on the NEAR blockchain
4. **Permanent Record** - Verification stored immutably on the NEAR blockchain
5. **Public Verification** - Anyone can verify account status without any private data being disclosed publicly
6. **Sybil Resistance** - SumSub ensures each person can only verify one wallet (identity de-duplication)

## How It Works

### The Verification Process

**Step 1: Connect Your NEAR Wallet**

Connect your NEAR wallet using any compatible wallet (Meteor Wallet, MyNearWallet, etc.). The app needs access to your wallet to request a signature.

**Step 2: Sign a Message**

Your wallet will ask you to sign a NEP-413 message. This cryptographic signature proves you control the wallet address. No transaction is sent, and this is completely free.

**Step 3: Complete Identity Verification**

Complete the SumSub verification flow directly in your browser:
- Upload a photo of your government-issued ID (Passport, Driver's License, National ID Card, or Residence Permit)
- Complete a selfie liveness check
- Wait for instant or manual review (typically seconds to minutes)

**Step 4: Verification Complete**

Once SumSub approves your verification, the result is stored on the NEAR blockchain via webhook. Your identity is now linked to your NEAR wallet.

### What Gets Verified?

✅ **Verified:**

- You own the NEAR wallet (via cryptographic signature)
- Your identity was verified by SumSub
- Your identity hasn't been used to verify another wallet (SumSub deduplication)

### Privacy & Data Handling

**What SumSub Processes:**

SumSub handles identity verification and receives your ID document photo and selfie. SumSub manages data retention according to their privacy policy and regulatory requirements.

**What's Stored On-Chain:**

- Your NEAR account ID
- Verification timestamp
- NEP-413 signature data (proves wallet ownership at time of verification)

**No personal information is stored on the blockchain.** Only your verification status is recorded on-chain.

**Defense-in-Depth Security:**

- SumSub backend verifies identity
- NEAR smart contract independently verifies your wallet signature
- Both must pass for verification to succeed

## View Verified Accounts

Anyone can view the list of verified NEAR accounts without accessing any private data. Each entry shows the wallet address and verification timestamp - no personal information is ever revealed.

**Public Verification List:** `/citizens` route on your deployed instance

## Important Notes

**Privacy Model:**
Your personal information is processed by SumSub for identity verification. Only your verification status (not personal data) is stored on the NEAR blockchain.

**One Person, One Wallet:**
SumSub's identity deduplication ensures each person can only verify one NEAR wallet. This prevents Sybil attacks (multiple accounts per person) in applications that require unique identities.

**Immutable Verification:**
Once verified, the record is permanently stored on the NEAR blockchain and cannot be changed or deleted. This provides strong guarantees but means you should verify with the wallet you intend to use long-term.

**Verification Time:**
The verification process typically completes within seconds to a few minutes:

- Instant approval for clear document photos and liveness checks
- Manual review may be required for edge cases

## Resources

- **SumSub** - [https://sumsub.com](https://sumsub.com) | [Documentation](https://docs.sumsub.com)
- **NEAR Protocol** - [https://near.org](https://near.org) | [Documentation](https://docs.near.org)
- **NEAR Explorer** - [NearBlocks Testnet](https://testnet.nearblocks.io) | [NearBlocks Mainnet](https://nearblocks.io)
- **Wallet Selector** - [NEAR Wallet Selector](https://github.com/near/wallet-selector)

## Support

Questions or issues? Open an issue on [GitHub](https://github.com/HackHumanityOrg/near-citizens-house/issues) or reach out to the team.

---

**Created by** [Hack Humanity](https://hackhumanity.com) and [NEAR Foundation](https://near.foundation) • Copyright © 2026 NEAR Foundation • MIT License
