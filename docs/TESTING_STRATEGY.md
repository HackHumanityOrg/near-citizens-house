# Testing Strategy for NEAR Citizens House

This document outlines the testing strategy for the NEAR Citizens House monorepo, organized into three phases: Technical Tests (automated and code review), Alpha Testing (manual by select users), and Beta Testing (broader release).

## Table of Contents

- [Part 1 Technical Tests](#Part-1-Technical-Tests)
- [Part 2 Alpha Testing](#Part-2-Alpha-Testing)
- [Part 3 Beta Testing](#Part-3-Beta-Testing)

---

## Part 1 Technical Tests

Automated tests that run in CI/CD pipelines and during local development.

### 1.1 Code Review (Static Analysis & Best Practices)

Security and type-safety review checklist to be verified before deployment:

| Area                      | Check                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| **API Boundaries**        | All API routes use Zod schemas with `safeParse()` for request validation |
| **Server Actions**        | All server actions validate input parameters before processing           |
| **Strict Schemas**        | No `any` types at API boundaries; strict TypeScript enabled              |
| **Input Validation**      | All user inputs validated before processing                              |
| **Contract Inputs**       | All contract method inputs have length/range constraints                 |
| **Contract Responses**    | All RPC responses validated with Zod before use                          |
| **Error Messages**        | No sensitive data leaked in error responses                              |
| **Type Coercion**         | No implicit type coercion at boundaries (explicit parsing)               |
| **Null Safety**           | Proper null/undefined handling throughout                                |
| **Environment Variables** | All env vars validated at startup with Zod                               |
| **NEAR Amounts**          | BigInt used for all token amounts (no floating point)                    |
| **Signature Data**        | Proper encoding with length validation                                   |
| **Cross-Contract Types**  | Borsh/JSON serialization matches between contracts                       |
| **Clippy Lints**          | All contracts pass strict Clippy (no unwrap, expect, panic, indexing)    |

**Key Files to Review:**

- `apps/verified-accounts/app/api/verify/route.ts` - API schema validation
- `apps/*/lib/actions/*.ts` - Server action validation
- `packages/shared/src/config.ts` - Environment variable validation
- `packages/shared/src/verification.ts` - Signature parsing
- `packages/shared/src/zk-verify.ts` - ZK proof verification and RPC handling
- `packages/shared/src/verification-contract.ts` - Contract database abstraction
- `packages/shared/src/types.ts` - Zod validation schemas for all API boundaries
- `contracts/*/src/lib.rs` - Input validation and panic prevention

### 1.2 Unit Tests for Critical Cryptographic Functions

Automated tests for custom cryptographic operations:

| Function                       | File            | Test Coverage                                                                                                                        |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `computeNep413Hash()`          | verification.ts | NEP-413 tag (2^31 + 413) as little-endian bytes, Borsh payload structure, 32-byte hash output                                        |
| `verifyNearSignature()`        | verification.ts | Valid signatures accepted, invalid signatures rejected, wrong signer detection, wrong message detection, signature format validation |
| `extractEd25519PublicKeyHex()` | verification.ts | "ed25519:" prefix handling, base58 decoding, 32-byte hex output, invalid input handling                                              |
| `parseUserContextData()`       | verification.ts | Hex-encoded input parsing, JSON input parsing, null byte removal, malformed input handling                                           |
| `verifyStoredProof()`          | zk-verify.ts    | Groth16 proof coordinate ordering (b array swap), public signals extraction, RPC timeout handling                                    |
| Borsh NEP-413 Schema           | verification.ts | 32-byte nonce array, optional callbackUrl field, TypeScript/Rust serialization compatibility                                         |

### 1.3 Unit Tests for Smart Contracts

Contract-level unit tests using `near-sdk` with `unit-testing` feature:

**verified-accounts contract:**

- Nullifier format validation (max 80 chars, fits uint256)
- User ID validation (max 80 chars, fits uint256)
- Attestation ID validation (max 1 char, Self.xyz uses "1", "2", "3")
- User context data validation (max 4096 chars)
- Public signals array validation (max 21 items for passport, 19 for Aadhaar; each max 80 chars)
- ZK proof component validation (a[2], b[2][2], c[2], each max 80 chars)
- Batch size limits (max 100 accounts)
- NEP-413 signature validation (32-byte nonce, 64-byte signature)
- State getter functions return correct data
- Authorization checks (backend wallet only for all write operations)
- Signature replay prevention (same signature rejected on reuse)
- Nullifier uniqueness enforcement (same passport cannot verify two accounts)
- Account uniqueness enforcement (same account cannot verify twice)
- Contract pause/unpause state transitions

### 1.4 Sandbox Integration Tests

End-to-end contract tests using `near-workspaces` sandbox.

**verified-accounts integration:**

_Core Flow:_

- Full verification flow (deploy → initialize → store verification)
- Access control (only backend wallet can write)
- NEP-413 signature verification on-chain
- Signature reuse prevention (same signature rejected)
- Nullifier uniqueness (same passport cannot verify twice)
- Account uniqueness (same account cannot verify twice)
- Pagination of verified accounts
- Contract pause/unpause functionality
- Storage cost verification (writes fail if insufficient balance)
- Event emission (verification_stored, contract_paused, backend_wallet_updated)

_Input Validation:_

- NEP-413 nonce must be exactly 32 bytes
- NEP-413 signature must be exactly 64 bytes
- Signature account ID must match near_account_id
- Signature recipient must match near_account_id
- Nullifier max length (80 chars)
- User ID max length (80 chars)
- Attestation ID max length (1 char)
- User context data max length (4096 chars)
- Public signals array max count (21 items)
- Public signal item max length (80 chars)
- Proof component a/b/c max length (80 chars each)
- Empty string rejection for required fields
- Unicode handling in string fields

_Batch Operations:_

- Batch size at limit (100 accounts) succeeds
- Batch size over limit (101 accounts) fails
- Empty batch handling

_Invariants:_

- `verified_count` always equals actual accounts stored
- Nullifier used → account cannot use same nullifier
- Signature used → signature cannot be replayed

_Composability:_

- Interface version returns "1.0.0"
- Cross-contract calls from other contracts work correctly
- View function gas usage within acceptable limits

---

## Part 2 Alpha Testing

**Scope:** Guided testing with specific test cases and expected outcomes. A select group of testers follows the defined scenarios on testnet, documenting results and any issues encountered.

**Feedback Collection:** Vercel Toolbar integration for in-app bug reports and feedback.

### 2.1 Combined Test Cases (Chronological Order)

Tests are ordered for a single tester to run sequentially across both apps.

| #                                     | App          | Test Case                                  | Preconditions                                                             | Steps                                                                                                                         | Expected Result                                                                                                                            |
| ------------------------------------- | ------------ | ------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Phase 1: Unverified User**          |              |                                            |                                                                           |                                                                                                                               |
| T1                                    | Verification | **Self App Install**                       | Wallet disconnected; Self.xyz app **not** installed; valid passport       | Connect wallet → Sign NEP-413 message → Scan QR with Self app                                                                 | QR code redirects to Self.xyz install                                                                                                      |
| T2                                    | Governance   | **Vote Without Verification**              | Wallet disconnected; unverified account; active proposal exists           | Connect unverified wallet → Navigate to active proposal → Try to vote                                                         | Vote buttons disabled; message: "Only verified citizens can vote. Get verified →" with link                                                |
| **Phase 2: Verification Flow**        |              |                                            |                                                                           |                                                                                                                               |
| T3                                    | Verification | **Too Old Signature**                      | Wallet disconnected; unverified account                                   | Connect → Sign message → Wait >10 minutes → Complete QR flow                                                                  | Rejection with "signature expired" error                                                                                                   |
| T4                                    | Verification | **Happy Path Verification**                | Wallet disconnected; unverified account                                   | Connect → Sign message → Scan QR Code in Self.xyz app → Validate proof in app                                                 | Account is verified successfully                                                                                                           |
| T5                                    | Verification | **Already Used Wallet**                    | Wallet disconnected; account already verified (run T4 first)              | Connect same wallet → Try to verify again                                                                                     | Block with "Verification Complete" message, signature not required, no QR shown                                                            |
| **Phase 3: Verified But Not Citizen** |              |                                            |                                                                           |                                                                                                                               |
| T6                                    | Governance   | **Verified But Not Citizen**               | Wallet disconnected; account verified but not yet added to DAO            | Connect wallet → Navigate to active proposal → Try to vote                                                                    | Vote buttons disabled; message: "You have a verified account, but you are not a citizen yet. Ask an admin to add you to the citizen list." |
| **Phase 4: Become Citizen (Admin)**   |              |                                            |                                                                           |                                                                                                                               |
| T7                                    | Governance   | **Member Addition Flow (Admin)**           | Wallet disconnected; backend_wallet credentials; verified account from T4 | Connect as backend_wallet → Navigate to /admin/members → Add verified account                                                 | Citizens count in dashboard updates                                                                                                        |
| **Phase 5: Citizen Voting**           |              |                                            |                                                                           |                                                                                                                               |
| T8                                    | Governance   | **Happy Path Vote**                        | Wallet disconnected; verified citizen (from T7); active proposal exists   | Connect wallet → Open active proposal → Cast For/Against                                                                      | Vote recorded, UI shows "You voted: [choice]", vote counts update                                                                          |
| T9                                    | Governance   | **Double Vote**                            | Wallet connected as citizen; already voted (run T8 first)                 | Try to vote again on same proposal                                                                                            | Vote buttons hidden; shows "You voted: [For/Against]" with colored icon                                                                    |
| T10                                   | Governance   | **Change Vote**                            | Wallet connected as citizen; already voted (run T8 first)                 | Try to change to different option                                                                                             | Vote cannot be changed; UI shows "You voted: [choice]" with vote buttons hidden                                                            |
| **Phase 6: Proposal States**          |              |                                            |                                                                           |                                                                                                                               |
| T11                                   | Governance   | **Countdown Timer**                        | Active proposal with visible countdown                                    | View active proposal → Watch countdown                                                                                        | Timer shows "Xd Yh remaining" or "Xh Ym remaining"                                                                                         |
| T12                                   | Governance   | **Finalize Before End**                    | Active proposal with voting period not ended                              | Open active proposal → Look for finalize button                                                                               | Finalize button not shown; only vote buttons visible                                                                                       |
| T13                                   | Governance   | **Vote on Ended Proposal (Not Finalized)** | Proposal with ended voting period but status still "InProgress"           | Navigate to ended proposal → Try to vote                                                                                      | Vote buttons hidden; finalize button shown with alert: "This proposal has expired and needs to be finalized."                              |
| T14                                   | Governance   | **Finalize - Quorum Met**                  | Proposal with ended voting period; sufficient votes cast                  | Navigate to proposal → Click Finalize                                                                                         | Status changes to Approved (green "Passed" badge) or Rejected (red badge)                                                                  |
| T15                                   | Governance   | **Finalize - Quorum Not Met**              | Proposal with ended voting period; insufficient votes                     | Navigate to proposal → Click Finalize                                                                                         | Status changes to Expired (amber badge); bond returned to proposer                                                                         |
| T16                                   | Governance   | **Vote on Finalized Proposal**             | Proposal already finalized (status: Approved/Rejected/Expired)            | Navigate to finalized proposal → Try to vote                                                                                  | Vote buttons hidden; message: "Voting has ended. Final status: [Passed/Rejected/Expired]"                                                  |
| **Phase 7: Browse & Verify Proofs**   |              |                                            |                                                                           |                                                                                                                               |
| T17                                   | Verification | **Browse Verified Accounts**               | At least one verified account exists                                      | Navigate to verified accounts page → Paginate through list                                                                    | Correct data displayed                                                                                                                     |
| T18                                   | Verification | **Verify Signature on Existing**           | At least one verified account exists                                      | Click "verify" on a listed verified account                                                                                   | Modal shows 4-step verification; all checks pass                                                                                           |
| T19                                   | Verification | **3rd-Party Signature Verification**       | T18 completed with all checks passed                                      | In modal → Click "NEAR Signature" → Open Cyphr.me Ed25519 tool → Set Algorithm=Ed25519, encodings=Hex → Paste values → Verify | Cyphr.me shows "Signature is valid"                                                                                                        |
| T20                                   | Verification | **3rd-Party ZK Proof Verification**        | T18 completed with all checks passed                                      | In modal → Click "ZK Proof" → Download files → Run `snarkjs groth16 verify vkey.json public.json proof.json`                  | snarkjs outputs verification OK                                                                                                            |
| **Phase 8: Sybil Resistance**         |              |                                            |                                                                           |                                                                                                                               |
| T21                                   | Verification | **Already Used Nullifier (Sybil)**         | Account A verified with passport X; Account B unverified                  | Connect wallet B → Complete verification with same passport X                                                                 | Rejection with "Nullifier already used - passport already registered"                                                                      |
| **Phase 9: Admin Proposal Tests**     |              |                                            |                                                                           |                                                                                                                               |
| T22                                   | Governance   | **Create Proposal - Unauthorized**         | Wallet is NOT backend_wallet                                              | Connect wallet → Navigate to /admin/proposals                                                                                 | Access denied message shown                                                                                                                |
| T23                                   | Governance   | **Create Proposal - Happy Path (Admin)**   | backend_wallet credentials available                                      | Connect as backend_wallet → Navigate to /admin/proposals → Fill description → Submit                                          | Proposal bond deducted; proposal created; success message with ID                                                                          |
| T24                                   | Governance   | **Description Too Long (Admin)**           | Connected as backend_wallet; on /admin/proposals                          | Enter description >10,000 characters                                                                                          | Counter turns yellow at 9,000+; red at 10,000+; button disabled                                                                            |
| T25                                   | Governance   | **Filter Proposals (Admin)**               | backend_wallet; proposals of different categories exist                   | Navigate to /admin/all-proposals → Use category tabs                                                                          | Tab filters: All, Votes, Membership, Policy; counts shown                                                                                  |
| T26                                   | Governance   | **Proposal Pagination**                    | At least 10+ proposals exist                                              | View proposals page → Click "Load More"                                                                                       | Pagination works; loads 10 more per click                                                                                                  |
| **Phase 10: Special Cases**           |              |                                            |                                                                           |                                                                                                                               |
| T27                                   | Verification | **Verification Contract Paused**           | Admin has paused verified-accounts contract                               | Connect wallet → Try to verify                                                                                                | Rejection with "Contract is paused - no new verifications allowed"                                                                         |

### 2.3 Alpha Testing Checklist

Before marking alpha testing complete:

- [ ] All T1-T27 test cases executed and documented
- [ ] Edge cases and unexpected behaviors logged as issues
- [ ] Performance observations noted (slow transactions, UI lag)
- [ ] Mobile browser testing completed (if applicable)
- [ ] Multiple wallet types tested (HOT, other supported wallets)

---

## Part 3 Beta Testing

**Status: TBD**

**Scope:** Open, unguided testing with real users. Unlike alpha testing, beta testers use the application naturally without predefined test cases, providing feedback based on their actual experience and use cases.

**Feedback Collection:** UserJot for structured user feedback and feature requests.

**Monitoring:** PostHog integration for analytics, user behavior tracking, and error monitoring.

Beta testing phase will be defined based on:

- Results and learnings from alpha testing
- Identified issues and their resolutions
- Broader release timeline and user acquisition plans
- Additional test cases discovered during alpha

Potential beta testing scope:

- Larger user group (50-100 testers)
- Mainnet deployment testing
- Load testing with concurrent users
- Long-running stability tests
- Cross-browser compatibility matrix
- Accessibility testing
- Localization testing (if applicable)
