# NEAR Citizens House

[![Tests](https://img.shields.io/endpoint?url=https://hackhumanityorg.github.io/near-citizens-house/test-results.json)](https://github.com/HackHumanityOrg/near-citizens-house/actions)
[![Allure Report](https://img.shields.io/badge/Allure_Report-View-blueviolet)](https://hackhumanityorg.github.io/near-citizens-house/)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHackHumanityOrg%2Fnear-citizens-house&root-directory=apps%2Fcitizens-house&env=NEXT_PUBLIC_NEAR_NETWORK,NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,NEXT_PUBLIC_SELF_NETWORK,NEXT_PUBLIC_APP_URL,NEAR_ACCOUNT_ID,NEAR_PRIVATE_KEY,NEXT_PUBLIC_USERJOT_PROJECT_ID,NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID&envDescription=Production%20deployment.%20Mark%20NEAR_PRIVATE_KEY%20as%20Sensitive%20in%20Vercel%20after%20deploy!&envLink=https%3A%2F%2Fgithub.com%2FHackHumanityOrg%2Fnear-citizens-house%2Fblob%2Fmain%2Fdocs%2FVERIFICATION_DEPLOYMENT_PLAYBOOK.md&project-name=near-citizens-house&repository-name=near-citizens-house&integration-ids=oac_4nMvFhFSbAGAK6MU5mUFFILs&skippable-integrations=1)

A pnpm workspace monorepo for NEAR governance and identity verification.

Click the Deploy button to deploy your own instance. You'll need to deploy the [smart contracts](./docs/VERIFICATION_DEPLOYMENT_PLAYBOOK.md) first.

## Project Structure

- **apps/citizens-house** - Main Next.js app with identity verification & governance (port 3000); includes `components/ui` and `lib/shared`
- **contracts/** - NEAR smart contracts (Rust)
- **scripts/** - Repo-level operational scripts

## Quick Start

```bash
# Install dependencies
pnpm install

# Run the app (port 3000)
pnpm dev
```

## About Identity Verification

Link your real-world passport identity to your NEAR blockchain wallet using zero-knowledge proofs. Prove who you are without revealing personal information.

## What This App Does

If you want to verify your real-world identity for your NEAR wallet while maintaining privacy, this app provides a secure, privacy-preserving solution:

1. **Verify Your Identity** - Prove you have a valid government-issued passport
2. **Protect Your Privacy** - Zero-knowledge proofs ensure no personal data is exposed
3. **Link to Blockchain** - Cryptographically connect your identity to your NEAR wallet
4. **Permanent Record** - Verification stored immutably on the NEAR blockchain
5. **Public Verification** - Anyone can verify account status without accessing private data
6. **Sybil Resistance** - Each passport can only be used once, preventing duplicate accounts

## How It Works

### The Verification Process

**Step 1: Connect Your NEAR Wallet**

Connect your NEAR wallet using any compatible wallet (Meteor Wallet, MyNearWallet, etc.). The app needs access to your wallet to request a signature.

**Step 2: Sign a Message**

Your wallet will ask you to sign a simple message: "Identify myself". This cryptographic signature proves you control the wallet address. No transaction is sent, and this is completely free.

**Step 3: Scan QR Code with Self App**

A QR code appears on screen. Using the Self mobile app, scan your passport's NFC chip and generate a zero-knowledge proof. The proof confirms you have a valid passport without revealing any personal information like name, date of birth, or passport number.

**Step 4: Verification Complete**

The app verifies both your wallet signature and passport proof, then stores this verification on the NEAR blockchain. Your identity is now cryptographically linked to your NEAR wallet.

### What Gets Verified?

✅ **Verified:**

- You own the NEAR wallet (via cryptographic signature)
- You possess a valid government-issued passport (via ZK proof)
- Your passport is authentic and hasn't been used to verify another wallet

❌ **NOT Stored or Revealed:**

- Your name
- Date of birth
- Passport number
- Nationality
- Photo
- Any other personal information

### Privacy & Security

**Zero-Knowledge Proofs:**
The verification uses advanced cryptography called zero-knowledge proofs. Think of it like proving you're over 18 without showing your ID - you can prove something is true without revealing the underlying data.

**What's Stored On-Chain:**

- A unique identifier (nullifier) from your passport - this prevents the same passport from being used twice
- Your NEAR wallet address
- Timestamp of verification
- Type of document used (passport, biometric ID, etc.)

**Defense-in-Depth Security:**

- Self.xyz backend verifies the passport proof
- NEAR smart contract independently verifies your wallet signature
- Both must pass for verification to succeed

## View Verified Accounts

Anyone can view the list of verified NEAR accounts without accessing any private data. Each entry shows only the wallet address and verification timestamp - no personal information is ever revealed.

**Public Verification List:** [/verified-accounts](https://your-app.vercel.app/verified-accounts)

## Use Cases

This identity verification system enables:

- **DeFi Compliance** - KYC-compliant financial applications without data exposure
- **DAO Governance** - Verified identities for voting without revealing who voted
- **Sybil-Resistant Apps** - One person, one account systems
- **Reputation Systems** - Build reputation tied to real identities
- **Regulatory Compliance** - Meet identity requirements while preserving privacy

## Important Notes

**Privacy First:**
Your personal information never leaves your device or the Self.xyz secure enclave. Only cryptographic proofs are transmitted and stored.

**One Passport, One Wallet:**
Each passport can only verify one NEAR wallet. This prevents Sybil attacks (multiple accounts per person) in applications that require unique identities.

**Immutable Verification:**
Once verified, the record is permanently stored on the NEAR blockchain and cannot be changed or deleted. This provides strong guarantees but means you should verify with the wallet you intend to use long-term.

**Waiting Period:**
The verification process typically takes 1-2 minutes to complete as it involves:

- Generating zero-knowledge proofs on your mobile device
- Backend verification of cryptographic proofs
- On-chain transaction confirmation

## For Developers

Interested in integrating this verification system or contributing to the project? Open a GitHub issue for technical documentation and setup guidance.

## Resources

- **Self.xyz Protocol** - [https://self.xyz](https://self.xyz) | [Documentation](https://docs.self.xyz)
- **NEAR Protocol** - [https://near.org](https://near.org) | [Documentation](https://docs.near.org)
- **Smart Contract Explorer** - [v1.widefile4023.testnet](https://explorer.testnet.near.org/accounts/v1.widefile4023.testnet)
- **Wallet Selector** - [NEAR Wallet Selector](https://github.com/near/wallet-selector)

## Support

Questions or issues? Open an issue on [GitHub](https://github.com/HackHumanityOrg/near-citizens-house/issues) or reach out to the team.

---

**Created by** [HackHumanity](https://hackhumanity.com) • **Powered by** [Self.xyz](https://self.xyz) • **License:** MIT
