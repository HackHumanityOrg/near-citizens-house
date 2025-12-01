# NEAR Citizens House

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

**Public Verification List:** [/verifications](https://your-app.vercel.app/verifications)

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

Interested in integrating this verification system or contributing to the project? See [DEVELOPER.md](./DEVELOPER.md) for technical documentation, setup instructions, and architecture details.

## Resources

- **Self.xyz Protocol** - [https://self.xyz](https://self.xyz) | [Documentation](https://docs.self.xyz)
- **NEAR Protocol** - [https://near.org](https://near.org) | [Documentation](https://docs.near.org)
- **Smart Contract Explorer** - [v1.widefile4023.testnet](https://explorer.testnet.near.org/accounts/v1.widefile4023.testnet)
- **Wallet Selector** - [NEAR Wallet Selector](https://github.com/near/wallet-selector)

## Support

Questions or issues? Open an issue on [GitHub](https://github.com/HackHumanityOrg/near-citizens-house/issues) or reach out to the team.

---

**Created by** [HackHumanity](https://hackhumanity.com) • **Powered by** [Self.xyz](https://self.xyz) • **License:** MIT
