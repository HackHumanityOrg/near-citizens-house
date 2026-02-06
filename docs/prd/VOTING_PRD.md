# Product Requirements Document: Citizens House Voting

**Version:** 0.3.2
**Date:** 2026-02-06
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

- Provide a simple, secure, and auditable voting flow for NEAR Verified Accounts.
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

- Voting should be available within the same app as Verification was, with the ability to turn each module (Verification, Voting) on or off at any given time
- The Verified Accounts contract remains the source of truth for verification.
- Contract account will be funded for baseline storage.
- **Storage model**:
  - **Proposals**: Require a bond (minimum 1 NEAR, proposer may attach more for higher expected participation). Each proposal stores the actual `bond_amount` attached by the proposer (which may exceed `min_proposal_bond`) for refund calculations. Bond covers storage for the proposal and votes. Bond is only refunded if the proposal fails to be created (snapshot callback failure, pending expiry, or cancellation while Pending). Bond is NOT refunded on success, failure, or cancellation of Active proposals.
  - **Votes**: Before recording a vote, the contract checks if available balance can cover storage (using `env::account_balance()`, `env::storage_usage()`, `env::storage_byte_cost()`). If sufficient, no deposit required. If insufficient, voter must attach deposit (~0.0015 NEAR). This creates a "free until bond exhausted" model.
  - **Admin operations**: Use `assert_one_yocto()`. Storage cost is minimal and absorbed by contract.
  - **Storage delta**: When a vote deposit is required, compute refund based on actual storage delta (`env::storage_usage()` after minus before, multiplied by `env::storage_byte_cost()`). The refund follows checks-effects-interactions: record the vote and finalize all state changes first, then compute the storage delta, then verify the contract retains sufficient balance for storage (see Section 14, "Storage balance guard"), then issue the excess refund via `Promise::new(voter).transfer(excess)`.

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
- At least 7% of NEAR Verified Accounts vote (hopefully signifantly higher).
- Voting is concluded within a 2-week time period.
- We do not need to pause voting e.g. due to any major bugs or security incidents.

---

## 8. Governance Rules

- **Proposal creation**: Admin-only; admin status is not tied to Verified Accounts.
- **Start time**: `created_at` is set at the initial create call time (not in the snapshot callback).
- **Time units**: `created_at`, `ends_at`, and `pending_expires_at` are in nanoseconds; `voting_period_secs` and `pending_expiry_secs` are in seconds and must be converted to nanoseconds when computing `ends_at`, `pending_expires_at`, and expiry checks.
- **Voting eligibility**: Verified accounts only (verified prior to proposal creation), and not blocklisted.
- **Verification timing**: Accounts must be verified before proposal creation to vote (`verified_at <= created_at`).
- **Voting period**: Global configurable; default 14 days.
- **Snapshot**: Verified account count fetched via `get_verified_count()` cross-contract call after proposal creation. The snapshot count is an upper bound on the eligible voter population: it may include accounts verified in the 1-2 block window between `created_at` (set in the create call) and the cross-contract call (executed in the next block). These accounts cannot vote (`verified_at > created_at`) but are counted in the quorum denominator. At any realistic verification rate, this adds zero additional required quorum votes due to ceiling rounding (e.g., at 10,000 verified accounts and 7% quorum, even 5 extra accounts do not change `ceil(count * 700 / 10_000)`). This is accepted as policy: the snapshot is conservative (slightly harder to reach quorum) rather than permissive. If verification rates become extreme in the future, a `get_verified_count_before(timestamp)` method could be added to the verified-accounts contract to tighten the snapshot.
- **Quorum**: Default 7% of snapshot verified count; configurable (basis points, minimum 1 bps).
  - Quorum count uses `ceil((snapshot_verified_count * quorum_bps) / 10_000)`.
- **Passing condition**: Quorum met and `yes_votes >= no_votes` (ties pass).
- **Finalize preconditions**: Finalize is only allowed for `Active` proposals; calls for `Pending`, `Cancelled`, `Succeeded`, or `Failed` must be rejected. Finalize is blocked while any `pending_votes` exist for the proposal.
- **Pending expiry**: If a proposal remains `Pending` past `pending_expires_at` (`created_at + (pending_expiry_secs * 1_000_000_000)`), it is handled by the admin-only `expire_pending_proposal` method (not `finalize`). This marks the proposal as Failed with `failure_kind: PendingExpired` and refunds the bond to the creator. `pending_expiry_secs` is a distinct config parameter from `voting_period_secs`, with a default of 3600 seconds (1 hour), reflecting that Pending is a transient state (normally 1-2 blocks for the snapshot callback).
- **Blocklisting**: Prevents future voting. For Active proposals, votes from blocklisted accounts are excluded via real-time counter adjustment: when `blocklist_account` is called, the contract iterates Active proposals and for each where the account voted, sets the vote's `blocklisted` field to `true` and decrements the proposal's `yes_votes` or `no_votes`. This means `yes_votes` and `no_votes` on the Proposal are always effective tallies. `unblocklist_account` reverses this. At finalize, counters are read directly with no further adjustment needed. Blocklisting does not alter results of finalized proposals.
- **Zero snapshot**: If the snapshot callback returns `verified_count == 0`, proposal creation fails (bond is refunded, `proposal_creation_failed` event emitted). As a defensive fallback, `finalize` also checks for `snapshot_verified_count == 0` and fails the proposal with `failure_kind: ZeroSnapshot`, though this path should not be reachable in normal operation.
- **Config updates**: Updates to `voting_period_secs`, `verified_accounts_contract`, and `min_proposal_bond` are blocked while any proposal is Pending or Active. `quorum_bps` and `pending_expiry_secs` may be updated at any time since they are snapshotted per-proposal at creation.
- **Storage funding**: See storage model in Section 5 Assumptions.
- **Pause semantics**: Pause blocks new create/vote/finalize, but allows cancel, `expire_pending_proposal`, `clear_stale_pending_vote`, and in-flight callbacks to complete.

---

## 9. Proposal Lifecycle

1. **Create (admin-only)**
   - Pending is a transient state between the create call and snapshot callback; proposals should not remain Pending indefinitely.
   - Contract stores a pending proposal record with `created_at = now`, `ends_at = created_at + (voting_period_secs * 1_000_000_000)`, and `pending_expires_at = created_at + (pending_expiry_secs * 1_000_000_000)`. Pending expiry uses `pending_expires_at`.
   - Contract calls Verified Accounts to fetch `verified_count` (snapshot).
   - Callback finalizes proposal to Active and stores snapshot count; it must not change `created_at`, `ends_at`, or `pending_expires_at`.
   - Snapshot count is an upper bound on the eligible voter population. It may include accounts verified in the 1-2 block window between `created_at` (set in the create call) and the `get_verified_count()` cross-contract call (executed in the next block). These accounts cannot vote (`verified_at > created_at`) but are counted in the quorum denominator. At any realistic verification rate, this adds zero additional required quorum votes due to ceiling rounding. This is accepted as policy: the snapshot is conservative (slightly harder to reach quorum) rather than permissive.
   - On callback failure (snapshot call fails), the snapshot callback must: (1) check that the proposal is still in `Pending` status (checks); (2) update proposal status and clear any pending state (effects); (3) verify sufficient balance remains for storage after refund (see Section 14, "Storage balance guard"); (4) issue bond refund via `Promise::new(creator).transfer(bond_amount)` (interactions). All state mutations complete before the refund transfer promise is created. If the proposal was cancelled between the create call and callback, the callback checks status, finds it Cancelled (bond already refunded by cancel), and aborts without further state changes or refunds.
   - On callback success, if `get_verified_count()` returned 0, the callback should fail the proposal creation (refund bond) rather than creating an Active proposal that will auto-fail at finalization.
   - On pending expiry (proposal remains Pending past `pending_expires_at`), an admin calls `expire_pending_proposal` which marks it Failed (with `failure_kind: PendingExpired`) and refunds the bond to the creator.
   - If proposal transitions to Active, bond is never refunded regardless of final outcome (success, failure, or cancellation).

2. **Vote (verified-only)**
   - Contract checks if proposal is Active and within voting window.
   - Contract checks blocklist.
   - Contract checks available storage balance:
     - If contract has sufficient balance → no deposit required
     - If contract lacks balance → voter must attach deposit (revert if insufficient)
   - Contract records a `PendingVote` per proposal (`pending_votes` keyed by `(proposal_id, account_id)` → `PendingVote { submitted_at, choice, voter_deposit }`) to prevent duplicate submissions and preserve submission context for the callback.
   - Contract calls Verified Accounts `get_verification` (summary).
   - Callback reads the `PendingVote` from storage, re-checks blocklist, enforces `verified_at <= proposal.created_at` and `pending_vote.submitted_at <= proposal.ends_at`, and records vote if valid (using `choice` and `submitted_at` from the pending record).
   - Vote timing uses **submission time**: the callback enforces `pending_vote.submitted_at <= proposal.ends_at` (where `submitted_at` was recorded during `cast_vote`), so a vote submitted before `ends_at` is eligible even if its callback executes after `ends_at`.
   - On failure, the `PendingVote` record is removed (clearing the lock) and `pending_vote.voter_deposit` is refunded to the voter.
   - If a vote callback fails (e.g., insufficient gas), all callback state changes are rolled back per NEAR's receipt-level atomicity, but the `PendingVote` record from the initial `cast_vote` call persists (including the trapped `voter_deposit`). Stuck records can be cleared via the admin-only `clear_stale_pending_vote` method, which also refunds the trapped deposit.

3. **Finalize**
   - Anyone can call finalize after `ends_at` when not paused.
   - Finalize is blocked while any `pending_votes` exist for the proposal.
   - Finalize is only valid for `Active` proposals. Expired Pending proposals must use `expire_pending_proposal` instead.
   - `yes_votes` and `no_votes` are always effective tallies (already adjusted for blocklisted accounts in real-time), so finalize reads them directly.
   - Defensive check: if `snapshot_verified_count == 0`, proposal fails (with `failure_kind: ZeroSnapshot`). This should not be reachable in normal operation since zero-snapshot proposals are rejected at creation (see Section 9.1).
   - Proposal becomes Succeeded or Failed based on quorum and yes/no results. On failure, `failure_kind` is set (`QuorumNotMet` or `Rejected`).
   - Finalize uses `ends_at` as originally set (pause does not freeze time).

4. **Cancel (admin-only)**
   - Requires `assert_one_yocto()` to prevent function-call key abuse.
   - If Active or Pending and not finalized, proposal becomes Cancelled.
   - Bond is NOT refunded for Active proposals. Bond IS refunded for Pending proposals (creation never completed). The cancel operation itself performs the refund.
   - If a Pending proposal is cancelled, the snapshot callback (which will still execute per NEAR protocol guarantees) must check the proposal status. If already Cancelled, the callback aborts without state changes or refunds (the cancel operation already handled the refund).
   - Pending vote locks are cleared.

---

## 10. Functional Requirements

### 10.1 Initialization

- Must initialize with:
  - `verified_accounts_contract: AccountId`
  - `admins: Vec<AccountId>` (must include at least one)
  - `quorum_bps: u16` (default 700)
  - `voting_period_secs: u64` (default 14 days)
  - `pending_expiry_secs: u64` (default 3600 = 1 hour)
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
  - Stores pending proposal with `created_at = now`, `ends_at = created_at + (voting_period_secs * 1_000_000_000)`, and `pending_expires_at = created_at + (pending_expiry_secs * 1_000_000_000)`.
  - Initiates async call to fetch snapshot; callback activates proposal.
  - Bond is only refunded if snapshot callback fails, if the proposal is cancelled while Pending, or if it is expired via `expire_pending_proposal`. Once proposal is Active, bond is never refunded.
- **cancel_proposal(proposal_id)**: Admin-only (`predecessor_account_id()` must be admin); uses `assert_one_yocto()`. Works on both Active and Pending proposals, only if not finalized. Bond is NOT refunded for Active proposals. Bond IS refunded for Pending proposals: the method updates proposal status to Cancelled and finalizes all state changes before verifying sufficient balance for storage (see Section 14, "Storage balance guard") and issuing the bond refund via `Promise::new(creator).transfer(bond_amount)`. Allowed while paused.
- **expire_pending_proposal(proposal_id)**: Admin-only; only valid for Pending proposals past `pending_expires_at`. Marks proposal as Failed with `failure_kind: PendingExpired`, finalizes all state changes, verifies sufficient balance for storage (see Section 14, "Storage balance guard"), then issues bond refund via `Promise::new(creator).transfer(bond_amount)`. Uses `assert_one_yocto()`. Allowed while paused.
- **clear_stale_pending_vote(proposal_id, account_id)**: Admin-only; removes a stuck `PendingVote` record. Uses `assert_one_yocto()`. This is a safety mechanism for vote callbacks that failed due to insufficient gas, which leaves the `PendingVote` from the initial call permanently set (per NEAR's receipt-level atomicity). If the removed `PendingVote` has a non-zero `voter_deposit`, the deposit is refunded to the voter (`account_id`). Allowed while paused.
- **finalize_proposal(proposal_id)**: Public; only after `ends_at` and when not paused.
  - Only valid for `Active` proposals. Expired Pending proposals must use `expire_pending_proposal` instead.
  - Blocked while any `pending_votes` exist for the proposal.
  - `yes_votes` and `no_votes` are read directly (already adjusted for blocklisted accounts in real-time).
  - Defensive check: if `snapshot_verified_count == 0`, proposal fails with `failure_kind: ZeroSnapshot`. Under normal operation, zero-snapshot proposals are rejected at creation and never reach Active status.
- **get_proposal(proposal_id)** view.
- **list_proposals(from_index, limit)** view with pagination, ordered by `id`. IDs are sequential starting from 0, and `Vector` append-only ordering matches ID order (index = proposal ID).

### 10.4 Voting

- **cast_vote(proposal_id, choice)**: Verified-only (verified before proposal creation), not blocklisted. Voter identity is `predecessor_account_id()`.
  - `choice` is `Yes` or `No`. One vote per proposal per account.
  - Requires active proposal within `[created_at, ends_at]`.
  - **Storage check**: Contract checks available balance vs estimated storage cost (`max(ESTIMATED_PENDING_VOTE_BYTES, ESTIMATED_VOTE_BYTES)`, since the pending entry is replaced by the final vote).
    - If sufficient balance: no deposit required.
    - If insufficient: requires attached deposit (~0.0015 NEAR); excess refunded after storage delta is computed.
  - Records a `PendingVote` with `submitted_at = env::block_timestamp()`, `choice`, and `voter_deposit = env::attached_deposit()` (or 0 if no deposit required).
  - Initiates async `get_verification` call. Callback enforces `verified_at <= proposal.created_at` and `pending_vote.submitted_at <= proposal.ends_at`.
  - `PendingVote` record prevents concurrent submissions; removed on callback completion (success or failure).
  - **Vote callback refund ordering (success path)**: On successful vote recording, the callback must: (1) read and remove the `PendingVote` record (clearing the lock, extracting `submitted_at`, `choice`, `voter_deposit`) and decrement `pending_vote_count`; (2) record the vote (using stored `choice`, setting `voted_at = submitted_at`) and update tallies; (3) compute storage delta (`env::storage_usage()` after minus before); (4) calculate excess deposit (`voter_deposit` minus actual storage cost); (5) issue refund of excess via `Promise::new(voter).transfer(excess)`. All state mutations complete before the refund transfer promise is created.
  - **Vote callback refund ordering (failure path)**: On callback failure (verification failed, proposal cancelled, etc.), the callback must: (1) read and remove the `PendingVote` record (clearing the lock, extracting `voter_deposit`) and decrement `pending_vote_count`; (2) issue full deposit refund via `Promise::new(voter).transfer(voter_deposit)`. The record removal must complete before the refund transfer is created.
- **has_voted(proposal_id, account_id)** view — O(1) lookup.
- **get_vote(proposal_id, account_id)** view — O(1) lookup.
- **is_vote_free(proposal_id)** view — Returns `true` if contract has enough balance to cover vote storage, `false` if deposit is required. Useful for frontend UX; treat as a hint only (balance may change before the vote is recorded).
- **get_proposal_count()** view — returns `next_proposal_id` as `U64` (total proposals created, including cancelled/failed).
- **get_pending_votes_count(proposal_id)** view — returns the proposal's `pending_vote_count` field as `U64`. Needed for frontends to show "finalization blocked" state.
- **get_votes_summary(proposal_id)** view — returns `{ yes_votes: U64, no_votes: U64, quorum_required: U64, quorum_met: bool, total_votes: U64 }` so frontends don't need to replicate quorum math. `yes_votes` and `no_votes` are always effective tallies (already adjusted for blocklist). All integer fields use `U64` for JSON safety (see Section 11.6).
- **Note**: No on-chain `list_votes`. For vote enumeration, use an indexer (NEAR Lake, QueryAPI) to query `vote_cast` events. This avoids storage duplication and scales to 10,000+ votes.

### 10.5 Reject List

- **blocklist_account(account_id)**: Admin-only; uses `assert_one_yocto()`. Prevents future votes. When blocklisting, the contract iterates all Active proposals and checks if the account has voted (via `LookupMap` O(1) lookup). For each proposal where the account voted and `vote.blocklisted == false`: sets `vote.blocklisted = true` in the LookupMap and decrements the proposal's `yes_votes` or `no_votes` based on the vote choice. This keeps the proposal's counters as always-accurate effective tallies.
- **unblocklist_account(account_id)**: Admin-only; uses `assert_one_yocto()`. When unblocklisting, the contract reverses the adjustments: iterates Active proposals, checks if the account voted, and for each vote where `vote.blocklisted == true`: sets `vote.blocklisted = false` and increments the proposal's `yes_votes` or `no_votes` accordingly.
- **is_blocklisted(account_id)** view.
- **list_blocklist(from_index, limit)** view with pagination.
- Actions emit events and are reversible only by admin.

### 10.6 Configuration

- **update_quorum_bps(new_bps)**: Admin-only. May be updated at any time; only affects future proposals since each proposal snapshots its own `quorum_bps` at creation.
  - Must be within `[1, 10_000]`.
  - Uses `assert_one_yocto()`.
- **update_voting_period_secs(new_period)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be >= 86,400 (1 day) and <= 7,776,000 (90 days).
  - Uses `assert_one_yocto()`.
- **update_pending_expiry_secs(new_period)**: Admin-only. May be updated at any time; only affects future proposals since each proposal snapshots its own `pending_expires_at` at creation.
  - Must be >= 300 (5 minutes) and <= 86,400 (1 day).
  - Uses `assert_one_yocto()`.
- **update_verified_accounts_contract(new_contract)**: Admin-only; blocked while any proposal is Pending or Active.
  - Uses `assert_one_yocto()`.
- **update_min_proposal_bond(new_min)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be >= 1 NEAR and <= 100 NEAR.
  - This sets the minimum; proposers may attach more.
  - Uses `assert_one_yocto()`.
- **get_config()** view: Returns current configuration including `quorum_bps`, `voting_period_secs`, `pending_expiry_secs`, `verified_accounts_contract`, and `min_proposal_bond`.

### 10.7 Pause Controls

- **pause() / unpause()**: Admin-only; uses `assert_one_yocto()`.
  - Paused state blocks proposal creation, voting, and finalization.
  - Pause does not freeze proposal time: `ends_at` and pending expiry timers continue to advance while paused.
  - Admin config updates, admin/blocklist management, `expire_pending_proposal`, and `clear_stale_pending_vote` remain allowed while paused.
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
- `pending_expires_at: u64` (nanoseconds)
- `status: ProposalStatus` (Pending, Active, Succeeded, Failed, Cancelled)
- `failure_kind: Option<FailureKind>` — set when status becomes Failed. Enum: `QuorumNotMet`, `Rejected`, `PendingExpired`, `ZeroSnapshot`.
- `quorum_bps: u16`
- `snapshot_verified_count: u64`
- `bond_amount: U128` (actual attached bond, for refund calculations)
- `pending_vote_count: u64` (number of in-flight vote locks for this proposal; incremented when `cast_vote` sets a pending lock, decremented when the vote callback succeeds/fails or when `clear_stale_pending_vote` is called; used by `get_pending_votes_count` view method)
- `yes_votes: u64` (always effective tally, adjusted in real-time for blocklisted accounts)
- `no_votes: u64` (always effective tally, adjusted in real-time for blocklisted accounts)

**JSON serialization note**: All `u64` fields above must use `near_sdk::json_types::U64` in JSON-facing types (view responses, event payloads). See Section 11.6 for rationale and implementation guidance. `bond_amount` already uses `U128`.

### 11.2 Vote

- `proposal_id: u64`
- `voter: AccountId`
- `choice: Yes | No`
- `voted_at: u64` (nanoseconds, submission time — copied from `PendingVote.submitted_at` when the callback records the vote, NOT the callback execution time)
- `blocklisted: bool` (default `false`; set to `true` when the voter is blocklisted while the proposal is Active, set back to `false` on unblocklist; provides audit trail for individual vote exclusion)

**JSON serialization note**: `proposal_id` and `voted_at` must use `U64` in JSON-facing types. See Section 11.6.

### 11.3 Collections

All collections use `near_sdk::store` (not the deprecated `near_sdk::collections`).

- `next_proposal_id: u64` — derived from `self.proposals.len() as u64` (not stored separately). Alternatively, may be stored explicitly in contract state for convenience, but the Vector length is the source of truth.
- `proposals: Vector<Proposal>` — iteration needed for `list_proposals` and blocklist scanning; append-only (proposals are never removed from storage). The Vector index serves as the proposal ID (sequential from 0), eliminating redundant key storage. `Vector` uses `u32` indices internally (max ~4.29B proposals, sufficient for governance). `next_proposal_id` can be derived from `self.proposals.len() as u64`.
- `votes: LookupMap<(u64, AccountId), Vote>` — O(1) lookup; no on-chain iteration (use indexer)
- `pending_votes: LookupMap<(u64, AccountId), PendingVote>` — vote lock during async verification; stores submission context needed by the callback
- `admins: IterableSet<AccountId>` — iteration needed for `list_admins`
- `blocklist: IterableSet<AccountId>` — iteration needed for `list_blocklist`

#### PendingVote

- `submitted_at: u64` (nanoseconds, `env::block_timestamp()` at `cast_vote` invocation)
- `choice: Yes | No` (voter's choice, stored so the callback reads it from state)
- `voter_deposit: U128` (deposit attached by the voter, if any; stored for callback refunds and stuck-lock recovery)

```rust
/// Conservative estimate of vote storage size in bytes
/// Includes: key (u64 + AccountId) + value (Vote struct) + serialization overhead
const ESTIMATED_VOTE_BYTES: u64 = 150;

/// Conservative estimate of pending vote storage size in bytes
/// Includes: key (u64 + AccountId) + value (PendingVote: u64 + enum + U128) + serialization overhead
/// Pending storage is temporary (cleared when callback completes).
const ESTIMATED_PENDING_VOTE_BYTES: u64 = 180;
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

### 11.5 Collection Caching and Flush Discipline

`near_sdk::store` collections (`Vector`, `IterableMap`, `IterableSet`, `LookupMap`, `LookupSet`) cache mutations in memory and persist them to storage on `Drop` (via an implicit `flush()`). In `#[near]` contract methods, Rust's ownership guarantees ensure `Drop` runs even on early returns, so individual collection changes are not lost. However, when a method modifies **multiple collections**, an early return after writing to one collection but before writing to another can leave storage in a partially-updated (inconsistent) state.

**Guideline**: In methods that modify two or more collections within the same logical operation, call `.flush()` on each collection immediately after its mutations are complete rather than relying on end-of-method `Drop` ordering. This makes persistence boundaries explicit, improves code reviewability, and guards against future edits that could introduce early-return inconsistencies.

**Methods requiring flush discipline** (each modifies multiple collections in a single call):

| Method | Collections modified |
|---|---|
| `blocklist_account` | `blocklist`, `votes`, `proposals` |
| `unblocklist_account` | `blocklist`, `votes`, `proposals` |
| `cast_vote` callback | `pending_votes`, `votes`, `proposals` |
| `cancel_proposal` | `proposals`, `pending_votes` |
| Snapshot callback | `proposals` (+ bond refund on failure) |

### 11.6 JSON Serialization Safety (U64/U128 Wrappers)

JavaScript can only safely represent integers up to 2^53 - 1 (approximately 9.0 x 10^15). NEAR nanosecond timestamps are approximately 1.7 x 10^18, which **exceeds** the JavaScript safe integer limit by a factor of ~193x. Without proper wrapping, timestamp fields will be silently corrupted when parsed by JavaScript clients.

**Rule**: All `u64` fields in JSON-facing types (view method return types, event payloads, method parameters) must use `near_sdk::json_types::U64`. All `u128` fields must use `near_sdk::json_types::U128`. These wrapper types serialize to JSON strings (e.g., `"1700000000000000000"` instead of `1700000000000000000`), preserving full precision.

**Borsh storage is unaffected**: `U64` and `U128` implement both `BorshSerialize`/`BorshDeserialize` (as raw integers) and `Serialize`/`Deserialize` (as JSON strings). A single struct can use `U64`/`U128` for both storage and JSON responses. Alternatively, separate Borsh-storage types (using raw `u64`) and JSON-response types (using `U64`) may be used if the developer prefers to keep storage types lean, with conversion between them.

**Fields requiring U64 wrapping in JSON responses** (sorted by severity):

| Field | Risk without wrapping | Notes |
|---|---|---|
| `created_at` | **Critical** — nanosecond timestamps (~1.7e18) exceed JS safe int | Must use `U64` |
| `ends_at` | **Critical** — same as above | Must use `U64` |
| `pending_expires_at` | **Critical** — same as above | Must use `U64` |
| `voted_at` | **Critical** — same as above | Must use `U64` |
| `id` | Low — sequential IDs will not reach 2^53 in practice | Use `U64` for consistency |
| `snapshot_verified_count` | Low — sourced from `u32`, max ~4.29B | Use `U64` for consistency |
| `yes_votes` | Low — bounded by snapshot count | Use `U64` for consistency |
| `no_votes` | Low — bounded by snapshot count | Use `U64` for consistency |
| `pending_vote_count` | Low — bounded by snapshot count | Use `U64` for consistency |
| `bond_amount` | Already wrapped as `U128` | No change needed |

**`get_verified_count() -> u32` from the verified-accounts contract is safe**: `u32` max value is approximately 4.29 x 10^9, well within the JS safe integer range. The governance contract converts this to `u64` for internal storage (`snapshot_verified_count`), but the JSON response must emit it as `U64`.

**Implementation approach**: Define a `ProposalView` response struct (or use `U64`/`U128` directly in the `Proposal` struct if dual-derive is preferred) with all `u64` fields as `U64` and all `u128` fields as `U128`. View methods return `ProposalView`. Similarly, define `VoteView` with `U64` for `voted_at` and `proposal_id`, and `VotesSummaryView` with `U64` for all count fields.

---

## 12. Limits and Validation

- **Title length**: <= 140 chars
- **Author length**: <= 120 chars
- **Description length**: <= 10,000 chars
- **Pagination limit**: max 100

- **Proposal IDs**: Assigned sequentially starting from 0 via the `next_proposal_id` counter.
- **Pagination semantics**: `from_index` parameters are 0-based offsets. For `proposals` (`Vector`), pagination uses range-based indexing: `(from_index..min(len, from_index+limit)).filter_map(|i| self.proposals.get(i))`, giving O(limit) with no skip overhead and no hashing. For `admins` and `blocklist` (`IterableSet`), pagination uses `iter().skip(from_index).take(limit)`; the `IterableSet` iterator provides O(1) `nth()` via its internal `Vector`, making `skip(n)` O(1) regardless of offset. Total pagination cost is O(limit) for all collections.
- **Voting period bounds**: minimum 86,400 seconds (1 day), maximum 7,776,000 seconds (90 days).
- **Minimum proposal bond bounds**: minimum 1 NEAR, maximum 100 NEAR.
- **Quorum bps bounds**: minimum 1, maximum 10,000.
- **Pending expiry bounds**: minimum 300 seconds (5 minutes), maximum 86,400 seconds (1 day).

These limits prevent storage abuse, parameter misconfiguration, and keep gas costs predictable.

---

## 13. Events

Use NEP-297 event format (`EVENT_JSON`) with `standard = "citizens-house-vote"` and a dedicated `version`. Events must keep payloads minimal (IDs, status, counts) to avoid the 16kb log limit; do not emit full proposal descriptions.

Event names and payloads:

- `proposal_created`: `{ proposal_id, creator, created_at, ends_at, pending_expires_at, quorum_bps }` — emitted at initial creation (Pending state).
- `proposal_activated`: `{ proposal_id, snapshot_verified_count, quorum_required }` — emitted when snapshot callback succeeds and proposal transitions to Active. `quorum_required` is the absolute vote count: `ceil(snapshot_verified_count * quorum_bps / 10_000)`.
- `proposal_creation_failed`: `{ proposal_id, creator, reason }` — emitted when snapshot callback fails or returns zero count.
- `proposal_cancelled`: `{ proposal_id, cancelled_by, bond_refunded }`
- `proposal_finalized`: `{ proposal_id, status, yes_votes, no_votes, quorum, snapshot_verified_count }` where `quorum` is the required vote count (not bps).
- `vote_cast`: `{ proposal_id, voter, choice, voted_at }` — `voted_at` is the submission time (from `PendingVote.submitted_at`), not the callback execution time.
- `admin_added`: `{ account_id, added_by }`
- `admin_removed`: `{ account_id, removed_by }`
- `blocklist_added`: `{ account_id, added_by }`
- `blocklist_removed`: `{ account_id, removed_by }`
- `config_updated`: `{ quorum_bps, voting_period_secs, pending_expiry_secs, verified_accounts_contract, min_proposal_bond, updated_by }`
- `bond_refunded`: `{ proposal_id, recipient, amount, reason }` — emitted on bond refund (callback failure, pending expiry, Pending cancellation).
- `pending_vote_cleared`: `{ proposal_id, account_id, cleared_by, deposit_refunded }` — emitted when admin clears a stuck pending vote. `deposit_refunded` is the amount returned to the voter (0 if no deposit was attached).
- `pending_proposal_expired`: `{ proposal_id, expired_by }` — emitted when admin expires a pending proposal.
- `paused`: `{ paused_by }`
- `unpaused`: `{ unpaused_by }`

**Implementation guidance**

- Use the native `#[near(event_json(standard = "citizens-house-vote"))]` attribute macro from `near-sdk` (v5.24+) to define a single `GovernanceEvent` enum with one variant per event type, each annotated with `#[event_version("1.0.0")]`. This provides `.emit()` and formats `EVENT_JSON` automatically.
- The macro defaults to `snake_case` naming for struct names or enum variants, which matches the event names above (e.g., `ProposalCreated` -> `proposal_created`).
- Emit events after state is finalized (e.g., in snapshot/vote callbacks, and after finalize/cancel state transitions), not on request submission. Events must be emitted as the **last operation** in callbacks, after all state changes and checks succeed.
- **Event payload integer types**: All `u64` values in event payloads (e.g., `proposal_id`, `created_at`, `ends_at`, `pending_expires_at`, `voted_at`, `yes_votes`, `no_votes`, `snapshot_verified_count`, `quorum`, `quorum_bps`) must be serialized as JSON strings using `U64` to prevent silent precision loss in JavaScript indexer clients. `bond_refunded` amounts use `U128`. The `near_sdk` event macro serializes fields using their `Serialize` implementation, so using `U64`/`U128` types in the event enum variants automatically produces string-encoded integers in the `EVENT_JSON` output. See Section 11.6 for full rationale.
- **Important**: NEAR logs from failed callbacks are visible to indexers even though state changes are rolled back (nearcore processes logs before checking execution success). If a callback emits an event and then panics, indexers see a phantom event for state changes that never persisted. Indexers must verify receipt execution status before trusting events.

---

## 14. Security Requirements

- **Access control**: Use `predecessor_account_id()` for all admin checks, not `signer_account_id()`. The following table maps every mutating method to its caller identity mechanism:

  | Method | Caller identity | Notes |
  |---|---|---|
  | `add_admin` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `remove_admin` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `create_proposal` | `predecessor_account_id()` | Admin check; stored as `proposal.creator`. Bond >= 1 NEAR provides stronger protection than 1 yocto (see one-yocto table below). |
  | `cancel_proposal` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `expire_pending_proposal` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `clear_stale_pending_vote` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `cast_vote` | `predecessor_account_id()` | Used as voter identity and pending vote lock key |
  | `finalize_proposal` | (no caller identity needed) | Public; no access control |
  | `blocklist_account` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `unblocklist_account` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `update_quorum_bps` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `update_voting_period_secs` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `update_pending_expiry_secs` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `update_verified_accounts_contract` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `update_min_proposal_bond` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `pause` / `unpause` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` |
  | `migrate` | `predecessor_account_id()` | Admin check + 1 yoctoNEAR |
  | Snapshot callback (`#[private]`) | (not applicable) | `predecessor_account_id()` is the contract itself. Original caller identity read from stored `proposal.creator`. |
  | Vote callback (`#[private]`) | (not applicable) | `predecessor_account_id()` is the contract itself. Voter identity passed as callback parameter or read from pending vote lock key `(proposal_id, account_id)`. |

- **Callback identity rule**: In `#[private]` callback methods, `predecessor_account_id()` returns the contract's own account (since the contract called itself via `.then()`). Original caller identity must be passed as a callback parameter or read from stored state. Specifically:
  - **Snapshot callback**: The proposal creator is read from `proposal.creator` (stored at create time from `predecessor_account_id()` of the `create_proposal` call). Used for bond refund recipient on failure.
  - **Vote callback**: The voter account is passed as a callback parameter or derived from the pending vote lock key `(proposal_id, account_id)`. Used for deposit refund recipient on failure and for recording the vote.
- **Refund recipient rule**: All refunds return tokens to the `predecessor_account_id()` of the **initiating call** (not the `signer_account_id()`), as stored in contract state at the time of the initiating call:
  - Bond refunds: recipient is `proposal.creator` (set from `predecessor_account_id()` during `create_proposal`).
  - Vote deposit refunds: recipient is the voter account (set from `predecessor_account_id()` during `cast_vote`, passed to or reconstructed in the callback).
  - This ensures that when a contract acts as an intermediary (e.g., a multisig calling `create_proposal`), the refund returns to the intermediary contract (the predecessor), not to the human signer behind the transaction.
- **One-yocto**: Use `assert_one_yocto()` (from `near_sdk`) on all admin state changes to prevent function-call key abuse. This function asserts exactly 1 yoctoNEAR is attached and must be used with `#[payable]` methods. NEAR function-call access keys cannot attach deposits at the protocol level (`InvalidAccessKeyError::DepositWithFunctionCall`), so requiring any deposit forces Full Access Key usage and wallet confirmation. The following table is a comprehensive checklist of every admin-mutating method:

  | Admin-mutating method | `assert_one_yocto()` | Rationale |
  |---|---|---|
  | `add_admin` | Required | Admin state change |
  | `remove_admin` | Required | Admin state change |
  | `create_proposal` | **Exempt** | Requires bond >= 1 NEAR, which forces Full Access Key usage (same as 1 yocto) and additionally provides economic spam prevention. Adding `assert_one_yocto()` would be redundant and would complicate attached deposit semantics (the full attached amount is the bond). |
  | `cancel_proposal` | Required | Admin state change; without it, a function-call key could cancel proposals without wallet confirmation |
  | `expire_pending_proposal` | Required | Admin state change |
  | `clear_stale_pending_vote` | Required | Admin state change |
  | `blocklist_account` | Required | Admin state change; affects vote tallies |
  | `unblocklist_account` | Required | Admin state change; affects vote tallies |
  | `update_quorum_bps` | Required | Config change |
  | `update_voting_period_secs` | Required | Config change |
  | `update_pending_expiry_secs` | Required | Config change |
  | `update_verified_accounts_contract` | Required | Config change |
  | `update_min_proposal_bond` | Required | Config change |
  | `pause` | Required | Operational control change |
  | `unpause` | Required | Operational control change |
  | `migrate` | Required (1 yoctoNEAR) | Upgrade protection |
- **Private callbacks**: Mark callbacks `#[private]`, verify `promise_results_count`, and handle `promise_result` errors.
- **Async safety**: Treat cross-contract calls as asynchronous; only finalize proposal/vote state in callbacks.
- **Vote race protection**: Record a `PendingVote` (containing `submitted_at`, `choice`, and `voter_deposit`) before the async call to prevent concurrent submissions and preserve submission context; remove on callback completion (success or failure). Lock is enforced per proposal and per account.
- **Submission timestamp enforcement**: The vote callback must use `pending_vote.submitted_at` (not `env::block_timestamp()`) to enforce the voting deadline (`submitted_at <= proposal.ends_at`). This ensures votes submitted before `ends_at` are accepted even when the callback executes in a later block. The NEAR security checklist recommends recording pre-call state if you need to enforce timing constraints later.
- **Callback refunds**: If a cross-contract call fails or a vote/proposal is not recorded: (1) for proposals, refund bond only if proposal never became Active; (2) for votes, refund any attached deposit to the voter. Refunds use `Promise::new(recipient).transfer(amount)`, which is a batched action (not a cross-contract call) and does not produce a callback. The contract cannot detect whether the transfer succeeded. If the recipient account no longer exists, the amount is burned by the NEAR protocol. Therefore, all state changes must be finalized before creating the transfer promise, so that a burned refund does not leave the contract in an inconsistent "owed" state. The `bond_refunded` event serves as the audit trail for refund issuance regardless of transfer outcome.
- **Callback gas safety**: Reserve gas for refund + cleanup logic; callbacks must not call external contracts. `Promise::new(recipient).transfer(amount)` is a batched action (not a cross-contract call) and is permitted in callbacks. However, callbacks must never chain further cross-contract calls via `.then()` after a refund. Gas must be budgeted so that all state mutations and the refund transfer action complete without running out of gas; if a callback exhausts gas before reaching the refund transfer, all state changes in that callback receipt are rolled back.
- **Callback robustness**: Handle errors explicitly and avoid panicking in callbacks; ensure sufficient gas for refunds and cleanup. Minimum gas budgets: snapshot callback 20 Tgas, vote callback 30 Tgas. Structure callbacks so that all fallible operations (state reads, validation, state writes) complete before creating any `Promise::new().transfer()`. Never panic after creating a transfer promise — if the receipt fails, the promise is discarded and the refund is lost while state is rolled back.
- **Callback cleanup order (checks-effects-interactions)**: Callbacks must follow this strict sequence: (1) validate callback result and check current state is still expected (checks); (2) read and remove `PendingVote` records (clearing locks and extracting `submitted_at`, `choice`, `voter_deposit`) and apply all state mutations — including deducting tracked bond/deposit amounts, updating proposal/vote status, and updating counters (effects); (3) emit events reflecting the final state; (4) issue refund transfers via `Promise::new(recipient).transfer(amount)` as the final operation (interactions). State must reflect the refund as already issued before the transfer promise is created. This ordering ensures that if the transfer fails and tokens are burned, contract state is not left in an inconsistent "owed" state.
- **Storage balance guard**: Before issuing any refund transfer, the contract must verify that its remaining balance after the transfer will still cover storage staking costs: `env::account_balance() - refund_amount >= env::storage_usage() * env::storage_byte_cost()`. If this check fails, the refund operation should fail (panic in direct methods, or skip refund and log warning in callbacks) rather than silently short-changing the recipient. This prevents a large bond refund (up to 100 NEAR) from leaving the contract unable to pay for its existing storage, which would cause subsequent state-writing transactions to fail. The contract account must be adequately funded per Section 20 to avoid this scenario in practice.
- **Reentrancy safety**: Avoid any exploitable intermediate state between call and callback.
- **Fail fast**: Validate inputs early (lengths, roles, status) and return clear errors.
- **Overflow checks**: Enable `overflow-checks = true` in `Cargo.toml`.
- **Storage security**: Follow storage model in Section 5. Limit text sizes and enforce pagination to prevent DoS. Use `env::storage_byte_cost()` for accurate storage cost calculations. When vote deposit is required (bond exhausted), compute storage delta and refund excess.
- **Access key hygiene**: Avoid full-access keys on the contract account after deployment to prevent `#[private]` bypass.
- **Upgrade access**: Admin-only upgrades must be protected by `predecessor_account_id` and 1 yoctoⓃ.
- **Unique storage prefixes**: Ensure all collections have unique storage keys/prefixes.
- **Callback status checks**: All callbacks (snapshot, vote) must verify the proposal/vote is still in the expected status before applying state changes. A proposal may be cancelled between the initial call and callback execution (NEAR callbacks execute in a later block).
- **Pending lock recovery**: Stuck `PendingVote` records (from failed callbacks where the initial call's state persists per NEAR's receipt-level atomicity) must have an admin-accessible recovery mechanism (`clear_stale_pending_vote`) to prevent permanent finalization blockage. Recovery must also refund any `voter_deposit` stored in the pending record.
- **Event emission ordering**: Events must be emitted after all state changes succeed and before refund transfer promises are created. NEAR's runtime makes logs from panicking callbacks visible to indexers, which could create phantom events if events are emitted before a subsequent panic. Since both event emission and `Promise::new().transfer()` are non-panicking operations, they may safely follow all state mutations without risk of phantom events or rolled-back state.
- **Verified accounts dependency**: The governance contract's integrity depends on the verified-accounts contract returning truthful data. The verified-accounts contract has its own upgrade path (`migrate()`) and single `backend_wallet` admin. If compromised or upgraded, governance outcomes may be affected. This trust dependency must be documented in deployment procedures.
- **Zero-snapshot rejection**: The snapshot callback should reject a verified count of 0 at creation time (fail fast, refund bond) rather than allowing the proposal to become Active and auto-fail at finalization.

---

## 15. Governance Threat Model and Mitigations

- **Low participation / quorum manipulation**: Use snapshot-based quorum with a default 7% and make quorum configurable.
- **Sybil or identity farming**: Only allow verified accounts, and require verification prior to proposal creation.
- **Admin compromise**: Use multi-admin and recommend operational multisig; emit events for all admin changes. Note: a compromised admin can rapidly add colluding admin accounts via `add_admin` (each call only requires 1 yoctoNEAR). Mitigation: use a multisig wrapper as the admin account and monitor `admin_added` events.
- **Proposal spam**: Restrict proposal creation to admins; consider rate limits or bonds if scope expands.
- **Last-minute vote swings**: Snapshot verified count via callback after creation; consider late-quorum extension in future if needed.
- **Blocklist abuse**: Require admin-only actions with auditable events; do not retroactively change results of finalized proposals. For Active proposals, blocklisting adjusts vote tallies in real-time (see Section 8). A compromised admin could blocklist voters right before finalization to swing outcomes (blocklist-then-finalize race condition). Primary mitigation: use a multisig admin account. Secondary mitigations: all blocklist actions emit events for transparency, and the real-time adjustment model makes blocklist effects immediate and auditable.
- **Phantom events from failed callbacks**: NEAR's runtime makes event logs from panicking callbacks visible to indexers even though state changes are rolled back. Mitigation: indexers must check receipt execution status; events should only be emitted after all state changes succeed.
- **Snapshot quorum inflation**: The `snapshot_verified_count` (quorum denominator) may include accounts verified in the 1-2 block callback window that cannot vote (`verified_at > created_at`). Severity: Low — at any realistic verification rate, the inflation adds zero additional required quorum votes due to ceiling rounding. The inflated snapshot makes quorum marginally harder to reach, which is the conservative direction (higher legitimacy bar). Mitigation: the callback window is bounded to 1-2 blocks (~1-2 seconds); `quorum_bps` is configurable if the community wants to compensate. The verified-accounts contract currently provides only `get_verified_count()` (total count, no date filtering). If verification rates become extreme, a `get_verified_count_before(timestamp)` method using binary search over a timestamp index could be added to tighten the snapshot to exact `verified_at <= created_at` counts.
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
- **Error handling**: If cross-contract call fails, creation/vote must fail cleanly and any `PendingVote` record must be removed (with `voter_deposit` refunded).
- **Serialization**: Promise results are JSON; parse with `serde_json::from_slice` in callbacks and treat deserialization failures as callback failures.
- **Verification pause behavior**: Verified Accounts pause only blocks writes; reads remain available, so governance reads may proceed unless governance intentionally blocks them.
- **Zero-snapshot sanity check**: If `get_verified_count()` returns 0, the snapshot callback should fail the proposal creation (refund bond) rather than creating an Active proposal with `snapshot_verified_count = 0` that will auto-fail at finalization.
- **Callback status verification**: The snapshot callback must check that the proposal is still in `Pending` status before transitioning to Active. If the proposal was cancelled between the cross-contract call and callback, the callback refunds the bond and aborts.
- **Trust dependency**: The governance contract trusts that the verified-accounts contract returns accurate data. The verified-accounts contract has its own upgrade path (`migrate()`) and single `backend_wallet` admin. If compromised, it could affect governance outcomes. This dependency should be documented in deployment procedures and operational runbooks.

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
  - Pending vote lock not found (for `clear_stale_pending_vote`)
  - Pending vote record not found in callback (internal error; indicates storage corruption or concurrent removal)
  - Proposal not pending or not expired (for `expire_pending_proposal`)
  - Snapshot count is zero; proposal creation failed
  - Quorum bps must be at least 1
  - Voting period must be between 86,400 and 7,776,000 seconds
  - Pending expiry must be between 300 and 86,400 seconds
  - Min proposal bond must be between 1 and 100 NEAR

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
  - Bond refunded on creation failure: snapshot callback fail, pending expiry, or Pending cancellation.
  - Bond NOT refunded on cancel, fail, or success (Active proposals).
  - Bond refunded on Pending cancellation — verifies bond returned when cancelling Pending proposals.
  - `is_vote_free` view method returns correct state.
  - Config update granularity: verify `quorum_bps` and `pending_expiry_secs` can be updated during active proposals; verify `voting_period_secs`, `verified_accounts_contract`, and `min_proposal_bond` are blocked while proposals are Active.
  - Blocklist real-time adjustment: verify that when blocklisting a voter, their vote's `blocklisted` field is set to `true` and proposal `yes_votes`/`no_votes` decremented. Verify unblocklist reverses this. Verify `get_vote()` shows blocklisted status.
  - Blocklist behavior and list_blocklist pagination.
  - Pause/unpause behavior, including finalize blocked while paused.
  - Snapshot callback with cancelled proposal — verifies callback checks status, refunds bond, and aborts.
  - Stuck pending vote lock — verifies admin can clear it via `clear_stale_pending_vote` and finalization proceeds.
  - Pending vote stores submission context: verify `PendingVote` contains correct `submitted_at`, `choice`, and `voter_deposit` after `cast_vote`.
  - Late callback acceptance: verify a vote submitted before `ends_at` is accepted by the callback even when callback executes after `ends_at` (using stored `submitted_at`).
  - Late submission rejection: verify callback defensively rejects `submitted_at > ends_at` (edge case guard).
  - `voted_at` reflects submission time: verify the recorded Vote's `voted_at` equals `PendingVote.submitted_at`, not the callback's `env::block_timestamp()`.
  - Stale pending vote deposit refund: verify `clear_stale_pending_vote` refunds `voter_deposit` from the stuck `PendingVote`.
  - `expire_pending_proposal` — verifies admin can expire Pending proposals past `pending_expires_at`, sets `failure_kind: PendingExpired`, refunds bond.
  - Zero-snapshot rejection — verifies snapshot callback fails proposal creation when `get_verified_count()` returns 0.
  - `failure_kind` field — verifies correct failure reasons set for different failure modes (QuorumNotMet, Rejected, PendingExpired, ZeroSnapshot).
  - Voting period bounds — verifies minimum (86,400s) and maximum (7,776,000s) enforcement.
  - Proposal bond bounds — verifies minimum (1 NEAR) and maximum (100 NEAR) enforcement.
  - Quorum bps bounds — verifies minimum (1) enforcement.
  - Pending expiry bounds — verifies minimum (300s) and maximum (86,400s) enforcement.
  - Pending expiry distinct from voting period — verifies that `pending_expires_at` is computed from `pending_expiry_secs` (not `voting_period_secs`), and that `expire_pending_proposal` uses `pending_expires_at` for the expiry check.
  - New view methods: `get_proposal_count`, `get_pending_votes_count`, `get_votes_summary`.
  - Refund ordering (checks-effects-interactions): verify that proposal status is updated before bond refund transfer in snapshot callback failure, pending expiry, and Pending cancellation paths.
  - Storage balance guard: verify that refund fails when contract balance minus refund would fall below storage cost; verify operation is retryable after funding.
  - Vote deposit refund ordering: verify that vote is recorded and tallies updated before excess deposit refund on success path; verify pending lock cleared before full deposit refund on failure path.
  - `cancel_proposal` requires one yocto: verify that calling `cancel_proposal` without attaching exactly 1 yoctoNEAR panics.
  - JSON serialization safety: verify that all view methods return `U64`-wrapped integers (not raw `u64`) by checking that JSON output contains string-encoded numbers for timestamp and count fields. Verify that nanosecond timestamps (e.g., `1_700_000_000_000_000_000u64`) round-trip correctly through JSON serialization without precision loss.
  - Event payload types: verify that emitted `EVENT_JSON` payloads serialize `u64` fields as JSON strings (via `U64`), not as raw JSON numbers.
- Integration tests:
  - Mock Verified Accounts contract for snapshot and is_verified.
  - Async callbacks and failure paths, including deposit/bond refunds on failure.
  - Event emission for indexer consumption (vote_cast events).
  - Full lifecycle with blocklist exclusion — create proposal, cast votes, blocklist a voter, verify real-time tally adjustment, finalize, verify adjusted results.
  - Concurrent pending votes — multiple voters submit simultaneously, verify locks and finalization behavior.
  - Failed callback gas — simulate callback OOG, verify lock persists, verify admin can clear it.
  - Storage balance guard under low balance — fund contract minimally, create proposal with large bond, cancel while Pending, verify refund fails, fund contract, retry cancel, verify refund succeeds.
  - Late callback with deposit refund — submit vote before `ends_at`, callback executes after; verify vote recorded with correct `submitted_at` and excess deposit refunded.
  - Stuck pending vote with deposit — simulate callback failure for a vote requiring deposit; verify admin clears stuck `PendingVote` and deposit is refunded to voter.

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
