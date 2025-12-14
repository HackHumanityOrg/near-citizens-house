# Alpha Testing Guide

Welcome to the NEAR Citizens House alpha testing program! This guide will help you set up everything needed to test the identity verification and governance applications.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Part 1: Wallet Setup](#part-1-wallet-setup)
- [Part 2: Get Test NEAR](#part-2-get-test-near)
- [Part 3: Test Cases](#part-3-test-cases)
- [Part 4: Providing Feedback](#part-4-providing-feedback)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, make sure you have:

- **Passport with NFC chip** - Required for identity verification (most passports issued after 2006 have NFC)
- **Smartphone** - iPhone (iOS 15.1+) or Android device with NFC capability
- **Desktop browser** - Chrome or Firefox recommended

---

## Part 1: Wallet Setup

You need a NEAR wallet to interact with the applications. We recommend Meteor Wallet.

### Meteor Wallet

1. Go to [wallet.meteorwallet.app](https://wallet.meteorwallet.app/)
2. In the top right select Testnet
   ![Screenshot 2025-12-11 at 18.12.21](https://hackmd.io/_uploads/rJBO6v_MZe.png)
3. Set up a password and create a new wallet.
4. Optional: Choose a username for your wallet
5. **Important:** Write down and securely store your 12-word seed phrase in Settings -> Security and Recovery -> View Secret Phrase.

---

## Part 2: Get Test NEAR

### Option 1: NEAR Faucet (near-faucet.io)

1. Go to [near-faucet.io](https://near-faucet.io/)
2. Select **"NEAR"** as the token
3. Enter your testnet account address (e.g., `yourname.testnet`)
4. Complete any verification if prompted
5. Click **"Request"**
6. Tokens will be sent to your wallet

### Option 2: NEAR Documentation Faucet

1. Go to [docs.near.org/faucet](https://docs.near.org/faucet)
2. Enter your testnet account ID
3. Click **"Request"**

**Note:** Faucets may have rate limits. If one doesn't work, try another.

---

## Part 3: Test Cases

For structured testing, we have defined specific test scenarios covering all app functionality.

### Test Case Reference

Follow the **T1-T27 test cases** documented in [TESTING_STRATEGY.md](https://hackmd.io/rfHEC6oLSBeo9skaorCR9Q?view#Part-2-Alpha-Testing).

We recommend working through these test cases sequentially and documenting your findings. Tests requiring admin access can be skipped. For permissioned actions—such as being added to the citizen role after verification—please contact a team member for assistance.

---

## Part 4: Providing Feedback

We use Vercel's built-in toolbar for collecting feedback during alpha testing.

We will need to add your email address to an allow list for you to be able to use the Vercel toolbar feedback feature. Please reach out to any Hack Humanity team member to request access.

### Using the Vercel Toolbar

1. **Locate the Toolbar**
   - Look for a small toolbar/widget on the right side of the screen. It appears on all deployed pages

![Screenshot 2025-12-11 at 18.23.06](https://hackmd.io/_uploads/SJPleO_fWg.png)

2. **Leave a Comment**
   - Click on the comment/feedback icon in the toolbar
   - Click on any UI element you want to comment on
   - Type your feedback
   - Submit the comment

3. **What to Report**
   - Bugs and errors you encounter
   - Confusing UI/UX elements
   - Missing features or functionality
   - Suggestions for improvement
   - Performance issues

### Tips for Good Feedback

- **Be specific** - describe exactly what you did and what happened
- **Include steps to reproduce** - how can we see the same issue?
- **Note your browser** - Chrome, Firefox, Safari, etc.
- **Screenshot if possible** - visual evidence helps!

---

## Troubleshooting

### Common Issues and Solutions

| Problem                                                | Solution                                                                                                                                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| "This wallet does not support message signing"         | Use Meteor Wallet - it supports NEP-413 message signing                                                                                       |
| Wallet won't connect to testnet app                    | Make sure you're using Meteor Wallet and allow it to create a testnet account if prompted                                                     |
| "Signature expired" error                              | Signatures are valid for 10 minutes. Sign a new message and complete verification faster                                                      |
| "Not a citizen yet" message                            | Your account is verified but not added to the DAO yet. Contact an admin to be added to the citizen role                                       |
| "Nullifier already used - passport already registered" | This passport was already used to verify another account. Each passport can only link to one wallet                                           |
| "Contract is paused - no new verifications allowed"    | The verification contract is temporarily disabled. Try again later                                                                            |
| Can't find NFC on passport                             | The NFC chip is usually embedded in the front cover or photo page of your passport. Try different positions and hold steady                   |
| Self app won't scan passport                           | Ensure NFC is enabled on your phone. Remove any phone case that might block NFC. Make sure you have a biometric passport (issued after ~2006) |

### Getting Help

If you encounter issues not covered here:

1. Use the Vercel toolbar to report the issue with details
2. Contact a Hack Humanity team member

---

## Resources

### Wallet

- **Meteor Wallet**: [wallet.meteorwallet.app](https://wallet.meteorwallet.app/)

### Faucets

- **NEAR Faucet**: [near-faucet.io](https://near-faucet.io/)
- **NEAR Docs Faucet**: [docs.near.org/faucet](https://docs.near.org/faucet)

### Self App

- **iOS (App Store)**: [Self - zk Passport & Identity](https://apps.apple.com/us/app/self-zk-passport-identity/id6478563710)
- **Android (Google Play)**: [Self – zk Passport & Identity](https://play.google.com/store/apps/details?id=com.proofofpassportapp)

### Documentation

- **Test Cases**: [TESTING_STRATEGY.md](https://hackmd.io/rfHEC6oLSBeo9skaorCR9Q?view#Part-2-Alpha-Testing)

---

Thank you for participating in the NEAR Citizens House alpha testing program!
