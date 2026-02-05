# Product Requirements Document: Citizens House Voting

**Version:** 0.2.4
**Date:** 2026-01-19
**Status:** Draft
**Owner:** Dan Cunningham
**Authors:** Andrei Voinea

---

## 1. Executive Summary

This document outlines the requirements for a product that allows NEAR Community Members with NEAR Verified Accounts to vote on a proposal, on a one-person/one-vote basis, to grant NEAR Consent for the transfer of assets from the NEAR Community Purpose Trust to the House of Stake Foundation, and subsequently dissolve the Trust.

This PRD defines a custom NEAR governance smart contract that replaces SputnikDAO and its bridge. The contract supports text-only proposals, verified-account voting, configurable quorum, multi-admin governance, proposal cancellation, and voter blocklisting. It integrates directly with the existing Verified Accounts contract for eligibility checks and snapshotting.

---

## 2. Context and Legal Requirements

{%hackmd zbc-JhcpQ1uxE6sklOa0qQ %}

---

## 3. Goals

- Provide a simple, secure, and auditable governance flow for NEAR Verified Accounts.
- Enforce one-person-one-vote using Verified Accounts, with verification checked on-chain.
- Support text-only proposals (no on-chain execution or token transfers).
- Allow multiple admins to manage proposals and configuration safely.
- Provide clear lifecycle states, events, and read APIs for frontends and indexers.

---

## 4. Non-Goals

- Token-weighted or delegated voting.
- Execution of on-chain actions or transfers.
- Timelocks or queued execution (may be added in future).
- Automatic import of external identity data beyond Verified Accounts.

---

## 5. Scope and Assumptions

**In scope**

- Custom governance contract on NEAR using near-sdk (Rust).
- Direct integration with Verified Accounts contract for eligibility and snapshot count.
- Admin-only proposal creation and cancellation.
- Verified-only voting with quorum and majority rules.
- Blocklisting of accounts for future voting.

**Assumptions**

- The Verified Accounts contract remains the source of truth for verification.
- Contract account will be funded for baseline storage.
- **Storage model**:
  - **Proposals**: Require a bond (minimum 1 NEAR, proposer may attach more for higher expected participation). Bond covers storage for the proposal and votes. Bond is only refunded if the proposal fails to be created (snapshot callback failure or pending expiry). Bond is NOT refunded on success, failure, or cancellation.
  - **Votes**: Before recording a vote, the contract checks if available balance can cover storage (using `env::account_balance()`, `env::storage_usage()`, `env::storage_byte_cost()`). If sufficient, no deposit required. If insufficient, voter must attach deposit (~0.0015 NEAR). This creates a "free until bond exhausted" model.
  - **Admin operations**: Use `assert_one_yocto()`. Storage cost is minimal and absorbed by contract.
  - **Storage delta**: When a vote deposit is required, compute refund based on actual storage delta (`env::storage_usage()` before/after) and return any excess to the voter.

**NEAR execution model considerations**

- Cross-contract calls are asynchronous; callbacks always execute and must check promise results.
- The contract must not be left in an exploitable state between call and callback.
- Access keys on the contract account are security sensitive; avoid full-access keys post-deploy.

---

## 6. Actors and Roles

- **Admin**: Can create/cancel proposals, manage blocklists, update config, pause/unpause, manage admins.
- **Verified Voter**: Can vote on active proposals if verified and not blocklisted.
- **Public Reader**: Can query proposals and results.

---

## 7. Success Metrics

- 100% of votes and proposals are verifiably linked to verified accounts.
- No unauthorized proposal creation or config changes.
- On-chain state is queryable and indexable with events.
- Governance actions complete within expected gas limits.

---

## 8. Governance Rules

- **Proposal creation**: Admin-only; admin status is not tied to Verified Accounts.
- **Start time**: `created_at` is set at the initial create call time (not in the snapshot callback).
- **Time units**: `created_at` and `ends_at` are in nanoseconds; `voting_period_secs` is in seconds and must be converted to nanoseconds when computing `ends_at` and expiry checks.
- **Voting eligibility**: Verified accounts only (verified prior to proposal creation), and not blocklisted.
- **Verification timing**: Accounts must be verified before proposal creation to vote (`verified_at <= created_at`).
- **Voting period**: Global configurable; default 14 days.
- **Snapshot**: Verified account count fetched via callback after proposal creation; it may include accounts verified before the callback completes and is acceptable.
- **Quorum**: Default 7% of snapshot verified count; configurable (basis points).
  - Quorum count uses `ceil((snapshot_verified_count * quorum_bps) / 10_000)`.
- **Passing condition**: Quorum met and `yes_votes >= no_votes` (ties pass).
- **Finalize preconditions**: Finalize is only allowed for `Active` proposals; calls for `Pending`, `Cancelled`, `Succeeded`, or `Failed` must be rejected. Finalize is blocked while any `pending_votes` exist.
- **Pending expiry**: If a proposal remains `Pending` past `ends_at` (`created_at + (voting_period_secs * 1_000_000_000)`), it is expired during `finalize` (see lifecycle) and bond is refunded to creator (creation failure).
- **Blocklisting**: Prevents future voting. For Active proposals, votes from accounts blocklisted before finalize are excluded from both quorum participation and yes/no tallies. Blocklisting does not alter results of finalized proposals.
- **Zero snapshot**: If `snapshot_verified_count == 0`, the proposal auto-fails at finalization (quorum cannot be met).
- **Config updates**: Blocked while any proposal is Pending or Active.
- **Storage funding**: See storage model in Section 5 Assumptions.
- **Pause semantics**: Pause blocks new create/vote/finalize, but allows cancel and in-flight callbacks to complete.

---

## 9. Proposal Lifecycle

1. **Create (admin-only)**
   - Pending is a transient state between the create call and snapshot callback; proposals should not remain Pending indefinitely.
   - Contract stores a pending proposal record with `created_at = now` and `ends_at = created_at + (voting_period_secs * 1_000_000_000)`. Pending expiry uses `ends_at`.
   - Contract calls Verified Accounts to fetch `verified_count` (snapshot).
   - Callback finalizes proposal to Active and stores snapshot count; it must not change `created_at` or `ends_at`.
   - Snapshot count may include accounts verified between proposal creation and callback completion; this slightly raises quorum and is acceptable.
   - On callback failure (snapshot call fails), bond is refunded to creator.
   - On pending expiry (proposal remains Pending past `ends_at`), `finalize` marks it Failed and refunds bond to creator.
   - If proposal transitions to Active, bond is never refunded regardless of final outcome (success, failure, or cancellation).

2. **Vote (verified-only)**
   - Contract checks if proposal is Active and within voting window.
   - Contract checks blocklist.
   - Contract checks available storage balance:
     - If contract has sufficient balance → no deposit required
     - If contract lacks balance → voter must attach deposit (revert if insufficient)
   - Contract records a pending vote lock per proposal (`pending_votes` keyed by `(proposal_id, account_id)`) to prevent duplicate submissions.
   - Contract calls Verified Accounts `get_verification` (summary).
   - Callback re-checks status/blocklist, enforces `verified_at <= proposal.created_at`, and records vote if valid.
   - Vote timing uses **submission time**: a vote submitted before `ends_at` is eligible to be recorded even if its callback executes after `ends_at`.
   - On failure, pending lock is cleared and any attached deposit is refunded.
   - Finalization excludes votes from accounts blocklisted before finalize.

3. **Finalize**
   - Anyone can call finalize after `ends_at` when not paused.
   - Finalize is blocked while any `pending_votes` exist for the proposal.
   - Finalize is only valid for `Active` proposals.
   - Votes from accounts blocklisted before finalize are excluded from quorum participation and yes/no tallies.
   - If `snapshot_verified_count == 0`, proposal fails.
   - Proposal becomes Succeeded or Failed based on quorum and yes/no results.
   - Finalize uses `ends_at` as originally set (pause does not freeze time).
   - If a proposal is Pending and expired, finalize marks it Failed and refunds the bond.

4. **Cancel (admin-only)**
   - If Active and not finalized, proposal becomes Cancelled. Bond is NOT refunded.
   - Pending locks are cleared.

---

## 10. Functional Requirements

### 10.1 Initialization

- Must initialize with:
  - `verified_accounts_contract: AccountId`
  - `admins: Vec<AccountId>` (must include at least one)
  - `quorum_bps: u16` (default 700)
  - `voting_period_secs: u64` (default 14 days)
  - `min_proposal_bond: U128` (default 1 NEAR) — minimum bond; proposers may attach more
- Must set `paused = false`.

### 10.2 Admin Management

- **add_admin(account_id)**: Admin-only; uses `assert_one_yocto()`.
- **remove_admin(account_id)**: Admin-only; uses `assert_one_yocto()`; cannot remove last admin.
- **is_admin(account_id)** view.
- **list_admins(from_index, limit)** view with pagination.
- All admin writes require `predecessor_account_id` checks and `assert_one_yocto()`.

### 10.3 Proposal Management

- **create_proposal(title, author, description)**: Admin-only.
  - Validates length limits (see Section 12).
  - Requires attached bond (minimum configurable, default 1 NEAR; proposer may attach more).
  - Stores `creator = predecessor_account_id()` for auditability.
  - Stores pending proposal with `created_at = now` and `ends_at = created_at + (voting_period_secs * 1_000_000_000)`.
  - Initiates async call to fetch snapshot; callback activates proposal.
  - Bond is only refunded if snapshot callback fails. Once proposal is Active, bond is never refunded.
  - **cancel_proposal(proposal_id)**: Admin-only; only if not finalized. Bond is NOT refunded. Allowed while paused.
- **finalize_proposal(proposal_id)**: Public; only after `ends_at` and when not paused.
  - Only valid for `Active` proposals.
  - Blocked while any `pending_votes` exist for the proposal.
  - Excludes votes from accounts blocklisted before finalize.
  - If `snapshot_verified_count == 0`, proposal fails.
  - Pending proposals that expired are marked Failed and the bond is refunded.
- **get_proposal(proposal_id)** view.
- **list_proposals(from_index, limit)** view with pagination, ordered by `created_at` then `id`.

### 10.4 Voting

- **cast_vote(proposal_id, choice)**: Verified-only (verified before proposal creation), not blocklisted.
  - `choice` is `Yes` or `No`. One vote per proposal per account.
  - Requires active proposal within `[created_at, ends_at]`.
  - **Storage check**: Contract checks available balance vs estimated vote storage cost.
    - If sufficient balance: no deposit required.
    - If insufficient: requires attached deposit (~0.0015 NEAR); excess refunded after storage delta is computed.
  - Async `get_verification` callback enforces `verified_at <= proposal.created_at`.
  - Pending vote lock prevents concurrent submissions; cleared on callback.
  - On failure, pending lock is cleared and any deposit is refunded.
- **has_voted(proposal_id, account_id)** view — O(1) lookup.
- **get_vote(proposal_id, account_id)** view — O(1) lookup.
- **is_vote_free(proposal_id)** view — Returns `true` if contract has enough balance to cover vote storage, `false` if deposit is required. Useful for frontend UX; treat as a hint only (balance may change before the vote is recorded).
- **Note**: No on-chain `list_votes`. For vote enumeration, use an indexer (NEAR Lake, QueryAPI) to query `vote_cast` events. This avoids storage duplication and scales to 10,000+ votes.

### 10.5 Reject List

- **blocklist_account(account_id)**: Admin-only; uses `assert_one_yocto()`. Prevents future votes; excludes account's votes from Active proposals at finalize.
- **unblocklist_account(account_id)**: Admin-only; uses `assert_one_yocto()`.
- **is_blocklisted(account_id)** view.
- **list_blocklist(from_index, limit)** view with pagination.
- Actions emit events and are reversible only by admin.

### 10.6 Configuration

- **update_quorum_bps(new_bps)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be within `[0, 10_000]`.
  - Uses `assert_one_yocto()`.
- **update_voting_period_secs(new_period)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be > 0 and within safe bounds.
  - Uses `assert_one_yocto()`.
- **update_verified_accounts_contract(new_contract)**: Admin-only; blocked while any proposal is Pending or Active.
  - Uses `assert_one_yocto()`.
- **update_min_proposal_bond(new_min)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be >= 1 NEAR.
  - This sets the minimum; proposers may attach more.
  - Uses `assert_one_yocto()`.
- **get_config()** view: Returns current configuration including `quorum_bps`, `voting_period_secs`, `verified_accounts_contract`, and `min_proposal_bond`.

### 10.7 Pause Controls

- **pause() / unpause()**: Admin-only; uses `assert_one_yocto()`.
  - Paused state blocks proposal creation, voting, and finalization.
  - Pause does not freeze proposal time: `ends_at` and pending expiry timers continue to advance while paused.
  - Admin config updates and admin/blocklist management remain allowed while paused.
  - Admin cancellation remains allowed while paused.
  - In-flight callbacks from pre-pause actions are allowed to complete.
  - View methods remain accessible.

---

## 11. Data Model (On-Chain)

### 11.1 Proposal

- `id: u64`
- `creator: AccountId`
- `title: String`
- `author: String` (display-only)
- `description: String`
- `created_at: u64` (nanoseconds)
- `ends_at: u64` (nanoseconds)
- `status: ProposalStatus` (Pending, Active, Succeeded, Failed, Cancelled)
- `quorum_bps: u16`
- `snapshot_verified_count: u64`
- `yes_votes: u64`
- `no_votes: u64`

### 11.2 Vote

- `proposal_id: u64`
- `voter: AccountId`
- `choice: Yes | No`
- `voted_at: u64` (nanoseconds, recorded in vote callback)

### 11.3 Collections

All collections use `near_sdk::store` (not the deprecated `near_sdk::collections`).

- `proposals: IterableMap<u64, Proposal>` — iteration needed for `list_proposals`
- `votes: LookupMap<(u64, AccountId), Vote>` — O(1) lookup; no on-chain iteration (use indexer)
- `pending_votes: LookupSet<(u64, AccountId)>` — vote lock during async verification
- `admins: IterableSet<AccountId>` — iteration needed for `list_admins`
- `blocklist: IterableSet<AccountId>` — iteration needed for `list_blocklist`

```rust
/// Conservative estimate of vote storage size in bytes
/// Includes: key (u64 + AccountId) + value (Vote struct) + serialization overhead
const ESTIMATED_VOTE_BYTES: u64 = 150;
```

### 11.4 Storage Keys

Use an enum with `BorshStorageKey` to ensure unique prefixes:

```rust
#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Proposals,
    Votes,
    PendingVotes,
    Admins,
    Blocklist,
}
```

---

## 12. Limits and Validation

- **Title length**: <= 140 chars
- **Author length**: <= 120 chars
- **Description length**: <= 10,000 chars
- **Pagination limit**: max 100

These limits prevent storage abuse and keep gas costs predictable.

---

## 13. Events

Use NEP-297 event format (`EVENT_JSON`) with `standard = "citizens-house-vote"` and a dedicated `version`. Events must keep payloads minimal (IDs, status, counts) to avoid the 16kb log limit; do not emit full proposal descriptions.

Event names and payloads:

- `proposal_created`: `{ proposal_id, creator, created_at, ends_at, quorum_bps }`
- `proposal_cancelled`: `{ proposal_id, cancelled_by }`
- `proposal_finalized`: `{ proposal_id, status, yes_votes, no_votes, quorum, snapshot_verified_count }` where `quorum` is the required vote count (not bps).
- `vote_cast`: `{ proposal_id, voter, choice, voted_at }`
- `admin_added`: `{ account_id, added_by }`
- `admin_removed`: `{ account_id, removed_by }`
- `blocklist_added`: `{ account_id, added_by }`
- `blocklist_removed`: `{ account_id, removed_by }`
- `config_updated`: `{ quorum_bps, voting_period_secs, verified_accounts_contract, min_proposal_bond, updated_by }`
- `paused`: `{ paused_by }`
- `unpaused`: `{ unpaused_by }`

**Implementation guidance**

- Use `near-sdk-contract-tools` to emit NEP-297 events via the `#[event]` macro or `#[derive(Nep297)]`, which provides `.emit()` and formats `EVENT_JSON` automatically.
- The macro defaults to `snake_case` naming for struct names or enum variants, which matches the event names above (e.g., `ProposalCreated` -> `proposal_created`).
- Emit events after state is finalized (e.g., in snapshot/vote callbacks, and after finalize/cancel state transitions), not on request submission.

---

## 14. Security Requirements

- **Access control**: Use `predecessor_account_id()` for all admin checks, not `signer_account_id()`.
- **One-yocto**: Use `assert_one_yocto()` (from `near_sdk`) on all admin state changes to prevent function-call key abuse. This function asserts exactly 1 yoctoNEAR is attached and must be used with `#[payable]` methods.
- **Private callbacks**: Mark callbacks `#[private]`, verify `promise_results_count`, and handle `promise_result` errors.
- **Async safety**: Treat cross-contract calls as asynchronous; only finalize proposal/vote state in callbacks.
- **Vote race protection**: Record a pending vote lock before the async call to prevent concurrent submissions; clear on failure. Lock is enforced per proposal and per account.
- **Callback refunds**: If a cross-contract call fails or a vote/proposal is not recorded: (1) for proposals, refund bond only if proposal never became Active; (2) for votes, refund any attached deposit to the voter.
- **Callback gas safety**: Reserve gas for refund + cleanup logic; callbacks must not call external contracts.
- **Callback robustness**: Handle errors explicitly and avoid panicking in callbacks; ensure sufficient gas for refunds and cleanup. Minimum gas budgets: snapshot callback 20 Tgas, vote callback 30 Tgas.
- **Callback cleanup order**: Clear pending locks, then apply state changes, then process refunds if needed.
- **Reentrancy safety**: Avoid any exploitable intermediate state between call and callback.
- **Fail fast**: Validate inputs early (lengths, roles, status) and return clear errors.
- **Overflow checks**: Enable `overflow-checks = true` in `Cargo.toml`.
- **Storage security**: Follow storage model in Section 5. Limit text sizes and enforce pagination to prevent DoS. Use `env::storage_byte_cost()` for accurate storage cost calculations. When vote deposit is required (bond exhausted), compute storage delta and refund excess.
- **Access key hygiene**: Avoid full-access keys on the contract account after deployment to prevent `#[private]` bypass.
- **Upgrade access**: Admin-only upgrades must be protected by `predecessor_account_id` and 1 yoctoⓃ.
- **Unique storage prefixes**: Ensure all collections have unique storage keys/prefixes.

---

## 15. Governance Threat Model and Mitigations

- **Low participation / quorum manipulation**: Use snapshot-based quorum with a default 7% and make quorum configurable.
- **Sybil or identity farming**: Only allow verified accounts, and require verification prior to proposal creation.
- **Admin compromise**: Use multi-admin and recommend operational multisig; emit events for all admin changes.
- **Proposal spam**: Restrict proposal creation to admins; consider rate limits or bonds if scope expands.
- **Last-minute vote swings**: Snapshot verified count via callback after creation; consider late-quorum extension in future if needed.
- **Blocklist abuse**: Require admin-only actions with auditable events; do not retroactively change results of finalized proposals. For Active proposals, exclude votes from accounts blocklisted before finalize from both quorum participation and yes/no tallies. This introduces governance risk; mitigate via multisig admin control, published policy, and transparency on blocklist actions.
- **Blast radius**: Text-only proposals limit on-chain damage if governance is attacked.

---

## 16. Integration with Verified Accounts

### 16.1 Contract Interface (from `contracts/verified-accounts/src/interface.rs`)

- `get_verified_count() -> u32`
- `get_verification(account_id: AccountId) -> Option<VerificationSummary>`
- `get_full_verification(account_id: AccountId) -> Option<Verification>`
- `is_verified(account_id: AccountId) -> bool`
- `are_verified(account_ids: Vec<AccountId>) -> Vec<bool>`
- `get_verifications(account_ids: Vec<AccountId>) -> Vec<Option<VerificationSummary>>`
- `is_paused() -> bool`

### 16.2 Types

- `VerificationSummary`
  - `near_account_id: AccountId`
  - `verified_at: u64` (Unix timestamp in nanoseconds)
- `Verification`
  - `near_account_id: AccountId`
  - `verified_at: u64`
  - `user_context_data: String` (includes NEAR signature data)

### 16.3 Usage in Governance

- **Snapshot at creation**: Use `get_verified_count()` via async callback; snapshot can include verifications completed before the callback returns. Convert `u32` to `u64` when storing `snapshot_verified_count`.
- **Vote eligibility**: Use `get_verification(account_id)` and require `verified_at <= proposal.created_at`.
- **Contract address**: Stored in config and updateable by admin only when no proposal is Pending or Active.
- **Callback gas**: Snapshot callback uses at least 20 Tgas; vote callback uses at least 30 Tgas.
- **Error handling**: If cross-contract call fails, creation/vote must fail cleanly and any pending vote lock must be cleared.
- **Serialization**: Promise results are JSON; parse with `serde_json::from_slice` in callbacks and treat deserialization failures as callback failures.
- **Verification pause behavior**: Verified Accounts pause only blocks writes; reads remain available, so governance reads may proceed unless governance intentionally blocks them.

---

## 17. Error Handling

- Clear error strings for:
  - Not admin / not verified
  - Verified after proposal creation
  - Blocklisted
  - Proposal not active / expired / finalized
  - Pending proposal expired
  - Finalize blocked by pending votes
  - Contract paused
  - Config locked due to active proposals
  - Already voted / vote already pending
  - Insufficient bond (for proposals)
  - Insufficient deposit when vote requires payment (contract balance exhausted)
  - Invalid parameters
  - Callback failures (including JSON deserialization errors)

---

## 18. Upgradeability

- Use `VersionedContract` and optional `VersionedProposal` enum.
- Provide `migrate()` method with `#[init(ignore_state)]`.
- Keep storage keys stable across versions.
- Upgrade model: admin-controlled upgrades; restrict `migrate()` and code updates to admin-only paths and require 1 yoctoⓃ.

---

## 19. Testing Requirements

- Unit tests:
  - Admin access control, role changes, and list_admins pagination.
  - Proposal creation, cancellation, finalization, and list_proposals pagination.
  - Vote counting, quorum, and tie handling.
  - Vote pending lock and double-submit prevention.
  - Proposal bond coverage: verify votes are free when contract has sufficient balance.
  - Vote deposit required: verify deposit is required when contract balance is exhausted.
  - Deposit refund: verify excess deposit is refunded after storage delta computed.
  - Bond refunded on creation failure: snapshot callback fail OR pending expiry.
  - Bond NOT refunded on cancel, fail, or success (Active proposals).
  - `is_vote_free` view method returns correct state.
  - Config updates blocked while proposals are Active.
  - Blocklist behavior and list_blocklist pagination.
  - Pause/unpause behavior, including finalize blocked while paused.
- Integration tests:
  - Mock Verified Accounts contract for snapshot and is_verified.
  - Async callbacks and failure paths, including deposit/bond refunds on failure.
  - Event emission for indexer consumption (vote_cast events).

---

## 20. Deployment and Ops

- Fund contract account for baseline storage (see storage model in Section 5).
- Configure Verified Accounts contract address at init.
- Admin list should include operational multisig or trusted account(s).
- Remove full-access keys from the contract account after deployment.
- Obtain external security review/audit before production deployment.
- Monitor gas usage, storage growth, and errors.

---

## 21. References

- NEAR security checklist: https://docs.near.org/smart-contracts/security/checklist
- NEAR best practices: https://docs.near.org/smart-contracts/anatomy/best-practices
- NEAR collections: https://docs.near.org/smart-contracts/anatomy/collections
- NEAR SDK store module: https://docs.rs/near-sdk/latest/near_sdk/store/index.html
- NEAR indexers: https://docs.near.org/data-infrastructure/indexers
- NEAR cross-contract callbacks: https://docs.near.org/smart-contracts/security/callbacks
- NEAR reentrancy: https://docs.near.org/smart-contracts/security/reentrancy
- NEAR frontrunning: https://docs.near.org/smart-contracts/security/frontrunning
- NEAR sybil: https://docs.near.org/smart-contracts/security/sybil
- NEAR storage staking: https://docs.near.org/protocol/storage/storage-staking
- NEP-297 events: https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0297.md
- near-sdk-contract-tools (NEP-297 event macros): https://github.com/near/near-sdk-contract-tools
- NEAR storage DoS: https://docs.near.org/smart-contracts/security/storage
- NEAR access control auditing notes: https://blog.sigmaprime.io/near-accounts-and-access-control.html
- NEAR storage auditing notes: https://blog.sigmaprime.io/near-storage.html
- NEAR cross-contract call auditing notes: https://blog.sigmaprime.io/near-sharding-cross-contract-calls.html
- Governance best practices (OpenZeppelin): https://docs.openzeppelin.com/contracts/4.x/api/governance
- Governance security guidelines: https://blog.openzeppelin.com/smart-contract-security-guidelines-4-strategies-for-safer-governance-systems
- DAO governance attacks (a16z): https://a16zcrypto.com/posts/article/dao-governance-attacks-and-how-to-avoid-them/
- Uniswap adversarial circumstances: https://docs.uniswap.org/concepts/governance/adversarial-circumstances
- NEAR auditing overview (Pessimistic): https://learnnear.club/auditing-projects-on-the-near-blockchain-from-zero-to-hero
- DeFi governance security best practices (Halborn): https://www.halborn.com/blog/post/best-practices-for-secure-defi-governance
