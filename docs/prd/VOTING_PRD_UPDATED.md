# Product Requirements Document: Citizens House Voting

**Version:** 0.4.0
**Date:** 2026-02-07
**Status:** Draft
**Owner:** Dan Cunningham
**Authors:** Andrei Voinea

---

## 1. Executive Summary

This document outlines the requirements for a product that allows NEAR Community Members with NEAR Verified Accounts to vote on a proposal, on a one-person/one-vote basis, to grant NEAR Consent for the transfer of assets from the NEAR Community Purpose Trust to the House of Stake Foundation, and subsequently dissolve the Trust.

This PRD defines a custom NEAR governance smart contract that replaces SputnikDAO and its bridge. The contract supports text-only proposals, verified-account voting, configurable quorum, multi-admin governance, proposal cancellation, and voter blocklisting (only when no proposals are Pending or Active). It integrates directly with the existing Verified Accounts contract for eligibility checks and snapshotting.

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

- Voting should be available within the same app as Verification was. The UI may hide or show Verification and Voting modules, but there is no on-chain pause.
- The Verified Accounts contract remains the source of truth for verification.
- Contract account will be funded for baseline storage.
- **Storage model**:
  - **Proposals**: Require a bond (minimum 1 NEAR, proposer may attach more for higher expected participation). Bond covers storage for the proposal and votes. Bond is a non-refundable fee and is never refunded regardless of proposal outcome or lifecycle state.
  - **Votes**: Before recording a vote, the contract checks if available balance can cover storage for both the temporary `PendingVote` and permanent `Vote` (`ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES`). If sufficient, no deposit required. If insufficient, voter must attach a fixed deposit (~0.004 NEAR); excess is refunded after the callback measures actual storage delta. This creates a "free until bond exhausted" model.
  - **Admin operations**: Use `assert_one_yocto()`. Storage cost is minimal and absorbed by contract.
  - **Storage delta**: When a vote deposit is required, compute refund based on actual storage delta (`env::storage_usage()` after minus before, multiplied by `env::storage_byte_cost()`). The PendingVote removal and `pending_vote_count` decrement must be flushed to trie **before** measuring the baseline, so the delta captures only the permanent Vote insertion. The refund follows checks-effects-interactions: record the vote and finalize all state changes first, then compute the storage delta, then issue the excess refund via `Promise::new(voter).transfer(excess)`.

**NEAR execution model considerations**

- Cross-contract calls are asynchronous; callbacks always execute and must check promise results.
- The contract must not be left in an exploitable state between call and callback.
- Access keys on the contract account are security sensitive; avoid full-access keys post-deploy.

---

## 6. Actors and Roles

- **Admin**: Can create/cancel proposals, manage blocklists (only when no proposals are Pending or Active), update config, manage admins.
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
- We do not need to cancel and recreate a proposal to address operational issues.

---

## 8. Governance Rules

- **Proposal creation**: Admin-only; admin status is not tied to Verified Accounts.
- **Start time**: `created_at` is set at the initial create call time (not in the snapshot callback). `start_at` is set at creation time by the creator and defaults to `created_at` if not provided.
- **Time units**: `created_at`, `start_at`, `ends_at`, and `pending_expires_at` are in nanoseconds; `voting_period_secs` and `pending_expiry_secs` are in seconds and must be converted to nanoseconds when computing `ends_at`, `pending_expires_at`, and expiry checks.
- **Voting eligibility**: Verified accounts only (verified prior to proposal creation), and not blocklisted.
- **Verification timing**: Accounts must be verified before proposal creation to vote (`verified_at <= created_at`). This preserves snapshot/quorum correctness since the snapshot is anchored to creation time.
- **Voting period**: Global configurable; default 14 days.
- **Voting window**: Voting opens at `start_at` and ends at `ends_at = start_at + (voting_period_secs * 1_000_000_000)`.
- **Snapshot**: Verified account count fetched via `get_verified_count()` cross-contract call after proposal creation, then adjusted by subtracting the **blocklist size at snapshot callback time** to compute `snapshot_verified_count`. The snapshot count is an upper bound on the eligible voter population: it may include accounts verified in the 1-2 block window between `created_at` (set in the create call) and the cross-contract call (executed in the next block). These accounts cannot vote (`verified_at > created_at`) but are counted in the quorum denominator. At any realistic verification rate, this adds zero additional required quorum votes due to ceiling rounding (e.g., at 10,000 verified accounts and 7% quorum, even 5 extra accounts do not change `ceil(count * 700 / 10_000)`). This is accepted as policy: the snapshot is conservative (slightly harder to reach quorum) rather than permissive. If verification rates become extreme in the future, a `get_verified_count_before(timestamp)` method could be added to the verified-accounts contract to tighten the snapshot.
- **Quorum**: Default 7% of snapshot verified count; configurable (basis points, minimum 1 bps).
  - Quorum count uses `ceil((snapshot_verified_count * quorum_bps) / 10_000)`.
- **Passing condition**: Quorum met and `yes_votes >= no_votes` (ties pass).
- **Finalize preconditions**: Finalize is only allowed for `Active` proposals; calls for `Pending`, `Cancelled`, `Succeeded`, or `Failed` must be rejected. Finalize is only allowed when `now > ends_at` (strictly after the voting window); it is blocked while any `pending_votes` exist for the proposal, unless the finalize grace period has elapsed (see below).
- **Finalize grace period**: If `pending_vote_count > 0` but `env::block_timestamp() >= ends_at + (finalize_grace_period_secs * 1_000_000_000)`, finalize proceeds anyway, treating remaining pending votes as abandoned. This prevents malicious actors from permanently blocking finalization by spamming low-gas vote transactions that create stuck `PendingVote` records. `finalize_grace_period_secs` is a configurable parameter (default 3600 seconds = 1 hour). Pending votes that resolve (via callbacks) after finalization are rejected with `VoteRejectionReason::PostFinalize` and deposits are refunded.
- **Pending expiry**: If a proposal remains `Pending` past `pending_expires_at` (`created_at + (pending_expiry_secs * 1_000_000_000)`), it is handled by the admin-only `expire_pending_proposal` method (not `finalize`). This marks the proposal as Failed with `failure_kind: PendingExpired`. `pending_expiry_secs` is a distinct config parameter from `voting_period_secs`, with a default of 3600 seconds (1 hour), reflecting that Pending is a transient state (normally 1-2 blocks for the snapshot callback). There is no constraint tying `pending_expiry_secs` to `voting_period_secs`.
- **Blocklisting**: Prevents future voting. Blocklist changes are allowed only when there are **no Pending or Active proposals**. Blocklist entries are verified at blocklist time via a cross-contract call; unverified accounts cannot be added. At proposal creation time, quorum excludes blocklisted accounts by subtracting the blocklist size (at snapshot callback time) from the verified count. At vote time, eligibility checks only local blocklist membership (no additional blocklist-related cross-contract calls beyond the existing vote verification).
- **Blocklist lock**: `blocklist_account` and `unblocklist_account` must reject with `ERR_BLOCKLIST_LOCKED` if any proposal is Pending or Active. Proposal creation must also reject if a blocklist change is pending.
- **Zero snapshot**: If the snapshot callback returns `verified_count == 0`, or if `verified_count - blocklist_size` results in an effective `snapshot_verified_count == 0`, proposal creation fails (`proposal_creation_failed` event emitted). As a defensive fallback, `finalize` also checks for `snapshot_verified_count == 0` and fails the proposal with `failure_kind: ZeroSnapshot`, though this path should not be reachable in normal operation.
- **Cancellation window**: Admins may cancel any Pending or Active proposal at any time before finalization, including after `ends_at`.
- **Config updates**: Updates to `voting_period_secs` and `verified_accounts_contract` are blocked while any proposal is Pending or Active. `quorum_bps`, `pending_expiry_secs`, `min_proposal_bond`, and `finalize_grace_period_secs` may be updated at any time since they only affect future proposals or are checked dynamically at finalize time.
- **Storage funding**: See storage model in Section 5 Assumptions.

---

## 9. Proposal Lifecycle

1. **Create (admin-only)**
   - Pending is a transient state between the create call and snapshot callback; proposals should not remain Pending indefinitely.
   - Contract stores a pending proposal record with:
     - `created_at = now`
     - `start_at = provided_start_at_or_created_at`
     - `ends_at = start_at + (voting_period_secs * 1_000_000_000)`
     - `pending_expires_at = created_at + (pending_expiry_secs * 1_000_000_000)`
   - Rejects if a blocklist change is pending.
   - `start_at` must be `>= created_at` and `<= created_at + (max_start_delay_secs * 1_000_000_000)`.
   - Contract calls Verified Accounts to fetch `verified_count` (snapshot).
   - Callback finalizes proposal to Active and stores `snapshot_verified_count = verified_count - blocklist_size` (saturating at 0); it must not change `created_at`, `start_at`, `ends_at`, or `pending_expires_at`.
   - Snapshot count is an upper bound on the eligible voter population. It may include accounts verified in the 1-2 block window between `created_at` (set in the create call) and the `get_verified_count()` cross-contract call (executed in the next block). These accounts cannot vote (`verified_at > created_at`) but are counted in the quorum denominator. At any realistic verification rate, this adds zero additional required quorum votes due to ceiling rounding. This is accepted as policy: the snapshot is conservative (slightly harder to reach quorum) rather than permissive.
   - On callback failure (snapshot call fails), the snapshot callback must: (1) check that the proposal is still in `Pending` status (checks); (2) update proposal status to Failed and emit `proposal_creation_failed` event (effects). If the proposal was cancelled between the create call and callback, the callback checks status, finds it Cancelled, and aborts without further state changes.
   - On callback success, if `get_verified_count()` returned 0 **or** `verified_count - blocklist_size` results in an effective `snapshot_verified_count == 0`, the callback should fail the proposal creation rather than creating an Active proposal that will auto-fail at finalization.
   - On pending expiry (proposal remains Pending past `pending_expires_at`), an admin calls `expire_pending_proposal` which marks it Failed (with `failure_kind: PendingExpired`).

2. **Vote (verified-only)**
   - Contract checks if proposal is Active and within voting window (`start_at <= now <= ends_at`).
   - Contract checks blocklist.
   - Blocklist is checked only at `cast_vote`; callbacks do not re-check because blocklist changes are locked during proposals.
   - Contract checks available storage balance:
     - If contract has sufficient balance → no deposit required
     - If contract lacks balance → voter must attach deposit (revert if insufficient)
   - Contract records a `PendingVote` per proposal (`pending_votes` keyed by `(proposal_id, account_id)` → `PendingVote { submitted_at, choice, voter_deposit }`) to prevent duplicate submissions and preserve submission context for the callback.
   - Contract calls Verified Accounts `get_verification` (summary).
   - Callback reads the `PendingVote` from storage, enforces `verified_at <= proposal.created_at` and `pending_vote.submitted_at <= proposal.ends_at`, and records vote if valid (using `choice` and `submitted_at` from the pending record).
   - Vote timing uses **submission time**: the callback enforces `proposal.start_at <= pending_vote.submitted_at <= proposal.ends_at` (where `submitted_at` was recorded during `cast_vote`), so a vote submitted before `ends_at` is eligible even if its callback executes after `ends_at`.
   - **NEAR async model rationale**: cross-contract calls and callbacks execute in separate blocks and are independent, so `submitted_at` must be captured before the callback to enforce the voting window reliably.
   - On failure, the `PendingVote` record is removed (clearing the lock) and `pending_vote.voter_deposit` is refunded to the voter.
   - If a vote callback fails (e.g., insufficient gas), all callback state changes are rolled back per NEAR's receipt-level atomicity, but the `PendingVote` record from the initial `cast_vote` call persists (including the trapped `voter_deposit`). Stuck records can be cleared via the admin-only `clear_stale_pending_vote` method, which also refunds the trapped deposit.

3. **Finalize**
   - Anyone can call finalize after `ends_at`.
   - Finalize is blocked while any `pending_votes` exist for the proposal, **unless** the finalize grace period has elapsed (`env::block_timestamp() >= ends_at + (finalize_grace_period_secs * 1_000_000_000)`). After the grace period, finalize proceeds regardless of `pending_vote_count`, treating remaining pending votes as abandoned (they do not count toward tallies or quorum). Vote callbacks that resolve after finalization are rejected with `VoteRejectionReason::PostFinalize` and deposits are refunded.
   - Finalize is only valid for `Active` proposals. Expired Pending proposals must use `expire_pending_proposal` instead.
   - `yes_votes` and `no_votes` are final tallies; finalize reads them directly.
   - Defensive check: if `snapshot_verified_count == 0`, proposal fails (with `failure_kind: ZeroSnapshot`). This should not be reachable in normal operation since zero-snapshot proposals are rejected at creation (see Section 9.1).
   - Proposal becomes Succeeded or Failed based on quorum and yes/no results. On failure, `failure_kind` is set (`QuorumNotMet` or `Rejected`).
   - Finalize uses `ends_at` as originally set.

4. **Cancel (admin-only)**
   - Requires `assert_one_yocto()` to prevent function-call key abuse.
   - If Active or Pending and not finalized, proposal becomes Cancelled. Cancellation is allowed even after `ends_at` (until finalize).
   - Bond is not refunded.
   - If a Pending proposal is cancelled, the snapshot callback (which will still execute per NEAR protocol guarantees) must check the proposal status. If already Cancelled, the callback aborts without further state changes.
   - **Pending vote handling on cancel**: Pending vote locks (`PendingVote` records) are **not** cleared by cancel. Since `pending_votes` is a non-iterable `LookupMap`, the contract cannot discover which accounts have pending votes for a given proposal. Instead, in-flight vote callbacks will discover the Cancelled status and clean up their own `PendingVote` records (refunding any `voter_deposit`). Stuck records (from failed callbacks) can be cleared by admin via `clear_stale_pending_vote`. The `pending_vote_count` field on the proposal decrements naturally as callbacks complete or admin clears stuck records.

5. **Post-finalize vote callback handling**
   - Vote callbacks that execute after a proposal has been finalized (Succeeded or Failed) must reject the vote, remove the `PendingVote` record, refund the full `voter_deposit`, and emit a `vote_rejected` event with `reason: PostFinalize`.

---

## 10. Functional Requirements

### 10.1 Initialization

- Must initialize with (all parameters are required; recommended deployment values shown in parentheses):
  - `verified_accounts_contract: AccountId`
  - `admins: Vec<AccountId>` (must include at least one)
  - `quorum_bps: u16` (recommended: 700)
  - `voting_period_secs: U64` (recommended: 1,209,600 = 14 days)
  - `pending_expiry_secs: U64` (recommended: 3600 = 1 hour)
  - `min_proposal_bond: U128` (recommended: 1 NEAR) — minimum bond; proposers may attach more
  - `finalize_grace_period_secs: U64` (recommended: 3600 = 1 hour) — after `ends_at + grace_period`, finalize proceeds even with pending votes
  - `max_start_delay_secs: U64` (recommended: 7,776,000 = 90 days) — max allowed delay from `created_at` to `start_at`

### 10.2 Admin Management

- **add_admin(account_id)**: Admin-only; uses `assert_one_yocto()`.
- **remove_admin(account_id)**: Admin-only; uses `assert_one_yocto()`; cannot remove last admin.
- **is_admin(account_id)** view.
- **list_admins(from_index, limit)** view with pagination.
- All admin writes require `predecessor_account_id` checks and `assert_one_yocto()`.

### 10.3 Proposal Management

- **create_proposal(title, author, description, start_at?)**: Admin-only.
  - Validates length limits (see Section 12).
  - Rejects if a blocklist change is pending.
  - Requires attached bond (minimum configurable, default 1 NEAR; proposer may attach more).
  - Stores `creator = predecessor_account_id()` for auditability.
  - Stores pending proposal with:
    - `created_at = now`
    - `start_at = start_at.unwrap_or(created_at)`
    - `ends_at = start_at + (voting_period_secs * 1_000_000_000)`
    - `pending_expires_at = created_at + (pending_expiry_secs * 1_000_000_000)`
  - Validates `created_at <= start_at <= created_at + (max_start_delay_secs * 1_000_000_000)`.
  - Initiates async call to fetch snapshot; callback activates proposal.
  - If `get_verified_count()` returns 0, or if `verified_count - blocklist_size` results in an effective `snapshot_verified_count == 0`, the snapshot callback fails proposal creation (`proposal_creation_failed`).
  - Bond is never refunded regardless of proposal outcome.
- **cancel_proposal(proposal_id)**: Admin-only (`predecessor_account_id()` must be admin); uses `assert_one_yocto()`. Works on both Active and Pending proposals, only if not finalized. Bond is not refunded. Does **not** clear pending vote locks (see Section 9.4).
- **expire_pending_proposal(proposal_id)**: Admin-only; only valid for Pending proposals past `pending_expires_at`. Marks proposal as Failed with `failure_kind: PendingExpired`. Uses `assert_one_yocto()`.
- **clear_stale_pending_vote(proposal_id, account_id)**: Admin-only; removes a stuck `PendingVote` record. Uses `assert_one_yocto()`. This is a safety mechanism for vote callbacks that failed due to insufficient gas, which leaves the `PendingVote` from the initial call permanently set (per NEAR's receipt-level atomicity). If the removed `PendingVote` has a non-zero `voter_deposit`, the deposit is refunded to the voter (`account_id`).
- **finalize_proposal(proposal_id)**: Public; only after `ends_at`.
  - Only valid for `Active` proposals. Expired Pending proposals must use `expire_pending_proposal` instead.
  - Blocked while any `pending_votes` exist for the proposal, **unless** the finalize grace period has elapsed (`env::block_timestamp() >= ends_at + (finalize_grace_period_secs * 1_000_000_000)`). After the grace period, finalize proceeds regardless of `pending_vote_count`.
  - `yes_votes` and `no_votes` are read directly.
  - Defensive check: if `snapshot_verified_count == 0`, proposal fails with `failure_kind: ZeroSnapshot`. Under normal operation, zero-snapshot proposals are rejected at creation and never reach Active status.
- **get_proposal(proposal_id)** view.
- **list_proposals(from_index, limit)** view with pagination, ordered by `id`. IDs are sequential starting from 0, and `Vector` append-only ordering matches ID order (index = proposal ID).

### 10.4 Voting

- **cast_vote(proposal_id, choice)**: Verified-only (verified before proposal creation), not blocklisted. Voter identity is `predecessor_account_id()`.
  - `choice` is `Yes` or `No`. One vote per proposal per account.
  - Requires active proposal within `[start_at, ends_at]`.
  - Rejects if a final vote already exists for this `(proposal_id, voter)` (explicit `has_voted` check).
  - **Storage check**: Contract checks available balance vs estimated storage cost (`ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES`). The deposit covers both the temporary PendingVote and permanent Vote storage; the PendingVote portion is refunded after the callback measures actual storage delta.
    - If sufficient balance: no deposit required.
    - If insufficient: requires attached deposit (~0.004 NEAR); excess refunded after storage delta is computed.
  - Records a `PendingVote` with `submitted_at = env::block_timestamp()`, `choice`, and `voter_deposit = env::attached_deposit()` (or 0 if no deposit required).
  - Initiates async `get_verification` call. Callback enforces `verified_at <= proposal.created_at` and `proposal.start_at <= pending_vote.submitted_at <= proposal.ends_at`.
  - Blocklist is checked at `cast_vote` only; callbacks do not re-check because blocklist changes are locked during proposals.
  - Because the callback executes later and independently, `submitted_at` must be recorded in `cast_vote` (not the callback) so votes started before `ends_at` still count.
  - `PendingVote` record prevents concurrent submissions; removed on callback completion (success or failure).
  - **Vote callback refund ordering (success path)**: On successful vote recording, the callback must: (1) read and remove the `PendingVote` record (clearing the lock, extracting `submitted_at`, `choice`, `voter_deposit`) and decrement `pending_vote_count`; (1b) flush `pending_votes` and `proposals` to trie so the PendingVote removal and count decrement are reflected in `env::storage_usage()` — this ensures the storage baseline excludes the temporary PendingVote; (2) measure `storage_before`, then record the vote (using stored `choice`, setting `voted_at = submitted_at`) and update tallies; (3) flush and measure `storage_after` — the delta captures only the permanent Vote insertion; (4) calculate excess deposit (`voter_deposit` minus actual storage cost); (5) issue refund of excess via `Promise::new(voter).transfer(excess)`. All state mutations complete before the refund transfer promise is created.
  - **Vote callback refund ordering (failure path)**: On callback failure (verification failed, proposal cancelled, proposal finalized, etc.), the callback must: (1) read and remove the `PendingVote` record (clearing the lock, extracting `voter_deposit`) and decrement `pending_vote_count`; (2) emit `vote_rejected` event with the appropriate `VoteRejectionReason`; (3) issue full deposit refund via `Promise::new(voter).transfer(voter_deposit)`. The record removal must complete before the refund transfer is created.
  - **Post-finalize rejection**: If the vote callback discovers the proposal is already finalized (Succeeded or Failed), it rejects the vote with `VoteRejectionReason::PostFinalize`, removes the `PendingVote`, refunds the deposit, and emits a `vote_rejected` event.
- **has_voted(proposal_id, account_id)** view — O(1) lookup via the proposal's per-proposal `IterableMap`.
- **get_vote(proposal_id, account_id)** view — O(1) lookup via the proposal's per-proposal `IterableMap`.
- **list_votes(proposal_id, from_index, limit)** view with pagination — iterates the proposal's per-proposal `IterableMap<AccountId, Vote>`. Returns `Vec<VoteView>`. Pagination semantics: `iter().skip(from_index).take(limit)`. `IterableMap`'s internal `Vector` provides O(1) `nth()`, making `skip(n)` efficient. Max `limit` is 100 (see Section 12).
- **is_vote_free(proposal_id)** view — Returns `true` if contract has enough balance to cover vote storage, `false` if deposit is required. Useful for frontend UX; treat as a balance-only hint (may change before the vote is recorded).
- **get_proposal_count()** view — returns `proposals.len()` as `U64` (total proposals created, including cancelled/failed).
- **get_pending_votes_count(proposal_id)** view — returns the proposal's `pending_vote_count` field as `U64`. Needed for frontends to show "finalization blocked" state.

### 10.5 Reject List

- **blocklist_account(account_id)**: Admin-only; uses `assert_one_yocto()`. Only allowed when there are no Pending or Active proposals and no pending blocklist operation. Records a `PendingBlocklistOp` and performs a cross-contract `get_verification(account_id)` lookup; if verified, adds the account to the blocklist and emits `blocklist_added`. If not verified or the callback fails, the pending op is cleared and the change is rejected.
- **unblocklist_account(account_id)**: Admin-only; uses `assert_one_yocto()`. Only allowed when there are no Pending or Active proposals and no pending blocklist operation. Removes the account from the blocklist and emits `blocklist_removed`.
- Only one blocklist operation may be pending at a time; while pending, all blocklist changes and `create_proposal` are rejected.
- **is_blocklisted(account_id)** view.
- **list_blocklist(from_index, limit)** view with pagination.
- **is_blocklist_locked()** view — returns `true` if any proposal is Pending or Active, or if a blocklist change is currently pending.
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
- **update_min_proposal_bond(new_min)**: Admin-only. May be updated at any time; only affects future proposals.
  - Must be >= 1 NEAR and <= 100 NEAR.
  - This sets the minimum; proposers may attach more.
  - Uses `assert_one_yocto()`.
- **update_finalize_grace_period_secs(new_period)**: Admin-only. May be updated at any time; checked dynamically at finalize time.
  - Must be >= 300 (5 minutes) and <= 86,400 (1 day).
  - Uses `assert_one_yocto()`.
- **update_max_start_delay_secs(new_period)**: Admin-only. May be updated at any time; affects only future proposals.
  - Must be >= 0 and <= 7,776,000 (90 days).
  - Uses `assert_one_yocto()`.
- **get_config()** view: Returns current configuration including `quorum_bps`, `voting_period_secs`, `pending_expiry_secs`, `verified_accounts_contract`, `min_proposal_bond`, `finalize_grace_period_secs`, and `max_start_delay_secs`.

---

## 11. Data Model (On-Chain)

### 11.1 Proposal

- `id: u64`
- `creator: AccountId`
- `title: String`
- `author: String` (display-only)
- `description: String`
- `created_at: u64` (nanoseconds)
- `start_at: u64` (nanoseconds)
- `ends_at: u64` (nanoseconds)
- `pending_expires_at: u64` (nanoseconds)
- `status: ProposalStatus` (Pending, Active, Succeeded, Failed, Cancelled)
- `failure_kind: Option<FailureKind>` — set when status becomes Failed. Enum: `QuorumNotMet`, `Rejected`, `PendingExpired`, `ZeroSnapshot`, `SnapshotCallbackFailed`.
- `quorum_bps: u16`
- `snapshot_verified_count: u64`
- `pending_vote_count: u64` (number of in-flight vote locks for this proposal; incremented when `cast_vote` sets a pending lock, decremented when the vote callback succeeds/fails or when `clear_stale_pending_vote` is called; used by `get_pending_votes_count` view method)
- `yes_votes: u64` (final tally)
- `no_votes: u64` (final tally)

**JSON serialization note**: All `u64` fields above must use `near_sdk::json_types::U64` in JSON-facing types (view responses, event payloads). See Section 11.6 for rationale and implementation guidance.

### 11.2 Vote

- `choice: Yes | No`
- `voted_at: u64` (nanoseconds, submission time — copied from `PendingVote.submitted_at` when the callback records the vote, NOT the callback execution time)

The `voter` (AccountId) is the key of the per-proposal `IterableMap<AccountId, Vote>`, so it is not stored in the `Vote` struct itself. The `proposal_id` is implicit from which proposal's `IterableMap` the vote belongs to. View methods (`get_vote`, `list_votes`) return a `VoteView` struct that includes `voter` and `proposal_id` for convenience.

**JSON serialization note**: `voted_at` must use `U64` in JSON-facing types. `VoteView` includes `proposal_id` (as `U64`) and `voter` for frontend consumption. See Section 11.6.

### 11.3 Collections

All collections use `near_sdk::store` (not the deprecated `near_sdk::collections`).

- `next_proposal_id: u64` — derived from `self.proposals.len() as u64` (not stored separately). The Vector length is the source of truth.
- `proposals: Vector<Proposal>` — iteration needed for `list_proposals`; append-only (proposals are never removed from storage). The Vector index serves as the proposal ID (sequential from 0), eliminating redundant key storage. `Vector` uses `u32` indices internally (max ~4.29B proposals, sufficient for governance). `next_proposal_id` can be derived from `self.proposals.len() as u64`.
- **Per-proposal votes**: Each proposal owns an `IterableMap<AccountId, Vote>` stored with a dynamic storage key prefix (e.g., `StorageKey::ProposalVotes { proposal_id }`). This provides O(1) lookup by account and efficient per-proposal iteration for `list_votes`. No global votes collection is needed. The `IterableMap` maintains an internal `Vector` for iteration order, adding ~40-60 bytes per vote compared to `LookupMap`, but enabling on-chain vote enumeration without indexer dependency.
- `pending_votes: LookupMap<(u64, AccountId), PendingVote>` — vote lock during async verification; stores submission context needed by the callback. Flat global map (not nested per-proposal) since pending votes are temporary, never iterated, and only accessed by exact key.
- `admins: IterableSet<AccountId>` — iteration needed for `list_admins`
- `blocklist: IterableSet<AccountId>` — iteration needed for `list_blocklist`
- `pending_blocklist_op: Option<PendingBlocklistOp>` — at most one pending blocklist change; used to gate concurrent blocklist ops and proposal creation.

#### PendingVote

- `submitted_at: u64` (nanoseconds, `env::block_timestamp()` at `cast_vote` invocation)
- `choice: Yes | No` (voter's choice, stored so the callback reads it from state)
- `voter_deposit: U128` (deposit attached by the voter, if any; stored for callback refunds and stuck-lock recovery)

#### PendingBlocklistOp

- `account_id: AccountId`
- `submitted_at: u64` (nanoseconds, `env::block_timestamp()` at submission)
- `initiated_by: AccountId` (admin who initiated the operation; needed because the `#[private]` callback's `predecessor_account_id()` is the contract itself, so the original caller must be stored for the `BlocklistAdded { added_by }` event)
Used only for blocklist add verification; unblocklist is synchronous.

```rust
/// Conservative estimate of vote storage size in bytes
/// Includes: IterableMap key (AccountId) + value (Vote struct) + IterableMap internal
/// Vector entry for iteration index + serialization overhead.
/// IterableMap adds ~40-60 bytes per entry vs LookupMap for the iteration index.
const ESTIMATED_VOTE_BYTES: u64 = 200;

/// Conservative estimate of pending vote storage size in bytes
/// Includes: key (u64 + AccountId) + value (PendingVote: u64 + enum + U128) + serialization overhead
/// Pending storage is temporary (cleared when callback completes).
const ESTIMATED_PENDING_VOTE_BYTES: u64 = 180;
```

The deposit check uses `ESTIMATED_PENDING_VOTE_BYTES + ESTIMATED_VOTE_BYTES` (= 380 bytes) to cover both the temporary PendingVote written during `cast_vote` and the permanent Vote written during the callback. The PendingVote portion is refunded after the callback measures actual storage delta (with the PendingVote already flushed/removed from trie before the baseline measurement).

### 11.4 Storage Keys

Use an enum with `BorshStorageKey` to ensure unique prefixes:

```rust
#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Proposals,
    ProposalVotes { proposal_id: u64 },
    PendingVotes,
    Admins,
    Blocklist,
}
```

Note: `ProposalVotes` uses a dynamic prefix that includes the `proposal_id`, ensuring each proposal's `IterableMap` has a unique storage namespace. The `Votes` key is no longer needed (there is no global votes collection). `pending_blocklist_op` is stored as an `Option<PendingBlocklistOp>` field on the contract struct (not a collection), so it does not need a separate storage key.

### 11.5 Collection Caching and Flush Discipline

`near_sdk::store` collections (`Vector`, `IterableMap`, `IterableSet`, `LookupMap`, `LookupSet`) cache mutations in memory and persist them to storage on `Drop` (via an implicit `flush()`). In `#[near]` contract methods, Rust's ownership guarantees ensure `Drop` runs even on early returns, so individual collection changes are not lost. However, when a method modifies **multiple collections**, an early return after writing to one collection but before writing to another can leave storage in a partially-updated (inconsistent) state.

**Guideline**: In methods that modify two or more collections within the same logical operation, call `.flush()` on each collection immediately after its mutations are complete rather than relying on end-of-method `Drop` ordering. This makes persistence boundaries explicit, improves code reviewability, and guards against future edits that could introduce early-return inconsistencies.

**Methods requiring flush discipline** (each modifies multiple collections in a single call):

| Method | Collections modified |
|---|---|
| `blocklist_account` | `pending_blocklist_op` |
| Blocklist callback | `pending_blocklist_op`, `blocklist` |
| `unblocklist_account` | `blocklist` |
| `cast_vote` callback | `pending_votes`, per-proposal `IterableMap` (votes), `proposals` |
| `cancel_proposal` | `proposals` |
| Snapshot callback | `proposals` |

### 11.6 JSON Serialization Safety (U64/U128 Wrappers)

JavaScript can only safely represent integers up to 2^53 - 1 (approximately 9.0 x 10^15). NEAR nanosecond timestamps are approximately 1.7 x 10^18, which **exceeds** the JavaScript safe integer limit by a factor of ~193x. Without proper wrapping, timestamp fields will be silently corrupted when parsed by JavaScript clients.

**Rule**: All `u64` fields in JSON-facing types (view method return types, event payloads, method parameters) must use `near_sdk::json_types::U64`. All `u128` fields must use `near_sdk::json_types::U128`. These wrapper types serialize to JSON strings (e.g., `"1700000000000000000"` instead of `1700000000000000000`), preserving full precision.

**Borsh storage is unaffected**: `U64` and `U128` implement both `BorshSerialize`/`BorshDeserialize` (as raw integers) and `Serialize`/`Deserialize` (as JSON strings). A single struct can use `U64`/`U128` for both storage and JSON responses. Alternatively, separate Borsh-storage types (using raw `u64`) and JSON-response types (using `U64`) may be used if the developer prefers to keep storage types lean, with conversion between them.

**Fields requiring U64 wrapping in JSON responses** (sorted by severity):

| Field | Risk without wrapping | Notes |
|---|---|---|
| `created_at` | **Critical** — nanosecond timestamps (~1.7e18) exceed JS safe int | Must use `U64` |
| `start_at` | **Critical** — same as above | Must use `U64` |
| `ends_at` | **Critical** — same as above | Must use `U64` |
| `pending_expires_at` | **Critical** — same as above | Must use `U64` |
| `voted_at` | **Critical** — same as above | Must use `U64` |
| `id` | Low — sequential IDs will not reach 2^53 in practice | Use `U64` for consistency |
| `snapshot_verified_count` | Low — sourced from `u32`, max ~4.29B | Use `U64` for consistency |
| `yes_votes` | Low — bounded by snapshot count | Use `U64` for consistency |
| `no_votes` | Low — bounded by snapshot count | Use `U64` for consistency |
| `pending_vote_count` | Low — bounded by snapshot count | Use `U64` for consistency |
| `voting_period_secs` | Low — max 7,776,000 (~7.8M) | Use `U64` for consistency |
| `pending_expiry_secs` | Low — max 86,400 | Use `U64` for consistency |
| `finalize_grace_period_secs` | Low — max 86,400 | Use `U64` for consistency |
| `max_start_delay_secs` | Low — max 7,776,000 | Use `U64` for consistency |

**`get_verified_count() -> u32` from the verified-accounts contract is safe**: `u32` max value is approximately 4.29 x 10^9, well within the JS safe integer range. The governance contract converts this to `u64` for internal storage (`snapshot_verified_count`), but the JSON response must emit it as `U64`.

**Implementation approach**: Define a `ProposalView` response struct (or use `U64`/`U128` directly in the `Proposal` struct if dual-derive is preferred) with all `u64` fields as `U64` and all `u128` fields as `U128`. View methods return `ProposalView`. Similarly, define `VoteView` with `U64` for `voted_at` and `proposal_id`, `voter: AccountId`, and `choice`.

### 11.7 VoteRejectionReason Enum

When a vote callback fails for any reason, the contract emits a `vote_rejected` event with a `VoteRejectionReason` enum value. This enum is serialized as a string in JSON event payloads.

```rust
/// Reason a vote was rejected during the callback phase.
/// Serialized as snake_case strings in EVENT_JSON payloads.
enum VoteRejectionReason {
    /// Proposal was cancelled between cast_vote and the callback.
    ProposalCancelled,
    /// Voter is not verified (no verification record found).
    NotVerified,
    /// Voter was verified after proposal creation (verified_at > created_at).
    VerifiedAfterCreation,
    /// Proposal voting period expired (submitted_at > ends_at edge case guard).
    ProposalExpired,
    /// Cross-contract call failed (e.g., JSON deserialization error, promise failure).
    CallbackFailed,
    /// Proposal was already finalized before the callback executed.
    PostFinalize,
}
```

### 11.8 ProposalCreationFailedReason Enum

When proposal creation fails during the snapshot callback, the contract emits a `proposal_creation_failed` event with a `ProposalCreationFailedReason` enum value. This enum is serialized as a string in JSON event payloads.

```rust
/// Reason proposal creation failed during the snapshot callback.
/// Serialized as snake_case strings in EVENT_JSON payloads.
enum ProposalCreationFailedReason {
    /// Snapshot callback failed (promise failed or JSON parse error).
    SnapshotCallbackFailed,
    /// Effective snapshot count was zero (verified_count == 0 or minus blocklist size).
    ZeroSnapshot,
}
```

---

## 12. Limits and Validation

- **Title length**: <= 140 chars
- **Author length**: <= 120 chars
- **Description length**: <= 10,000 chars
- **Pagination limit**: max 100

- **Proposal IDs**: Assigned sequentially starting from 0 via `proposals` Vector index (`proposals.len()` is total count).
- **Pagination semantics**: `from_index` parameters are 0-based offsets. For `proposals` (`Vector`), pagination uses range-based indexing: `(from_index..min(len, from_index+limit)).filter_map(|i| self.proposals.get(i))`, giving O(limit) with no skip overhead and no hashing. For `admins` and `blocklist` (`IterableSet`), pagination uses `iter().skip(from_index).take(limit)`; the `IterableSet` iterator provides O(1) `nth()` via its internal `Vector`, making `skip(n)` O(1) regardless of offset. For `votes` (per-proposal `IterableMap`), pagination uses `iter().skip(from_index).take(limit)`; the `IterableMap` iterator provides O(1) `nth()` via its internal `Vector`. Total pagination cost is O(limit) for all collections.
- **Voting period bounds**: minimum 86,400 seconds (1 day), maximum 7,776,000 seconds (90 days).
- **Minimum proposal bond bounds**: minimum 1 NEAR, maximum 100 NEAR.
- **Quorum bps bounds**: minimum 1, maximum 10,000.
- **Pending expiry bounds**: minimum 300 seconds (5 minutes), maximum 86,400 seconds (1 day).
- **Finalize grace period bounds**: minimum 300 seconds (5 minutes), maximum 86,400 seconds (1 day).
- **Start delay bounds**: `start_at` must be between `created_at` and `created_at + (max_start_delay_secs * 1_000_000_000)`. `max_start_delay_secs` must be between 0 and 7,776,000 seconds (90 days).

These limits prevent storage abuse, parameter misconfiguration, and keep gas costs predictable.

---

## 13. Events

Use NEP-297 event format (`EVENT_JSON`) with `standard = "citizens-house-vote"` and a dedicated `version`. Events must keep payloads minimal (IDs, status, counts) to avoid the 16kb log limit; do not emit full proposal descriptions.

Event names and payloads:

- `proposal_created`: `{ proposal_id, creator, created_at, start_at, ends_at, pending_expires_at, quorum_bps }` — emitted at initial creation (Pending state).
- `proposal_activated`: `{ proposal_id, snapshot_verified_count, quorum_required }` — emitted when snapshot callback succeeds and proposal transitions to Active. `quorum_required` is the absolute vote count: `ceil(snapshot_verified_count * quorum_bps / 10_000)`.
- `proposal_creation_failed`: `{ proposal_id, reason }` — emitted when snapshot callback fails or the effective snapshot is zero. `reason` is a `ProposalCreationFailedReason` enum value serialized as a snake_case string (e.g., `"snapshot_callback_failed"`, `"zero_snapshot"`). See Section 11.8.
- `proposal_cancelled`: `{ proposal_id, cancelled_by }`
- `proposal_finalized`: `{ proposal_id, status, yes_votes, no_votes, quorum, snapshot_verified_count }` where `quorum` is the required vote count (not bps).
- `vote_cast`: `{ proposal_id, voter, choice, voted_at }` — `voted_at` is the submission time (from `PendingVote.submitted_at`), not the callback execution time.
- `vote_rejected`: `{ proposal_id, voter, reason }` — emitted when a vote callback fails. `reason` is a `VoteRejectionReason` enum value serialized as a snake_case string (e.g., `"proposal_cancelled"`, `"not_verified"`, `"verified_after_creation"`, `"proposal_expired"`, `"callback_failed"`, `"post_finalize"`). See Section 11.7 for the full enum definition.
- `admin_added`: `{ account_id, added_by }`
- `admin_removed`: `{ account_id, removed_by }`
- `blocklist_added`: `{ account_id, added_by }`
- `blocklist_removed`: `{ account_id, removed_by }`
- `config_updated`: `{ quorum_bps, voting_period_secs, pending_expiry_secs, verified_accounts_contract, min_proposal_bond, finalize_grace_period_secs, max_start_delay_secs, updated_by }`
- `pending_vote_cleared`: `{ proposal_id, account_id, cleared_by, deposit_refunded }` — emitted when admin clears a stuck pending vote. `deposit_refunded` is the amount returned to the voter (0 if no deposit was attached).
- `pending_proposal_expired`: `{ proposal_id, expired_by }` — emitted when admin expires a pending proposal.

**Implementation guidance**

- Use the native `#[near(event_json(standard = "citizens-house-vote"))]` attribute macro from `near-sdk` (v5.24+) to define a single `GovernanceEvent` enum with one variant per event type, each annotated with `#[event_version("1.0.0")]`. This provides `.emit()` and formats `EVENT_JSON` automatically.
- The macro defaults to `snake_case` naming for struct names or enum variants, which matches the event names above (e.g., `ProposalCreated` -> `proposal_created`).
- Emit events after state is finalized (e.g., in snapshot/vote callbacks, and after finalize/cancel state transitions), not on request submission. Events must be emitted as the **last operation** in callbacks, after all state changes and checks succeed.
- **Event payload integer types**: All `u64` values in event payloads (e.g., `proposal_id`, `created_at`, `start_at`, `ends_at`, `pending_expires_at`, `voted_at`, `yes_votes`, `no_votes`, `snapshot_verified_count`, `quorum`) must be serialized as JSON strings using `U64` to prevent silent precision loss in JavaScript indexer clients. The `near_sdk` event macro serializes fields using their `Serialize` implementation, so using `U64`/`U128` types in the event enum variants automatically produces string-encoded integers in the `EVENT_JSON` output. See Section 11.6 for full rationale. Note: `quorum_bps` is `u16` (max 65,535) and is JS-safe, so it uses native `u16` in both events and view responses (serialized as a JSON number, not a string).
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
  | `update_min_proposal_bond` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` (updatable anytime) |
  | `update_finalize_grace_period_secs` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` (updatable anytime) |
  | `update_max_start_delay_secs` | `predecessor_account_id()` | Admin check + `assert_one_yocto()` (updatable anytime) |
  | `migrate` | `predecessor_account_id()` | Admin check + 1 yoctoNEAR |
  | Snapshot callback (`#[private]`) | (not applicable) | `predecessor_account_id()` is the contract itself. Original caller identity read from stored `proposal.creator`. |
  | Vote callback (`#[private]`) | (not applicable) | `predecessor_account_id()` is the contract itself. Voter identity passed as callback parameter or read from pending vote lock key `(proposal_id, account_id)`. |

- **Callback identity rule**: In `#[private]` callback methods, `predecessor_account_id()` returns the contract's own account (since the contract called itself via `.then()`). Original caller identity must be passed as a callback parameter or read from stored state. Specifically:
  - **Snapshot callback**: The proposal creator is read from `proposal.creator` (stored at create time from `predecessor_account_id()` of the `create_proposal` call).
  - **Vote callback**: The voter account is passed as a callback parameter or derived from the pending vote lock key `(proposal_id, account_id)`. Used for deposit refund recipient on failure and for recording the vote.
- **Refund recipient rule**: All vote deposit refunds return tokens to the `predecessor_account_id()` of the **initiating call** (not the `signer_account_id()`), as stored in contract state at the time of the initiating call:
  - Vote deposit refunds: recipient is the voter account (set from `predecessor_account_id()` during `cast_vote`, passed to or reconstructed in the callback).
  - This ensures that when a contract acts as an intermediary, the refund returns to the intermediary contract (the predecessor), not to the human signer behind the transaction.
- **One-yocto**: Use `assert_one_yocto()` (from `near_sdk`) on all admin state changes to prevent function-call key abuse. This function asserts exactly 1 yoctoNEAR is attached and must be used with `#[payable]` methods. NEAR function-call access keys cannot attach deposits at the protocol level (`InvalidAccessKeyError::DepositWithFunctionCall`), so requiring any deposit forces Full Access Key usage and wallet confirmation. The following table is a comprehensive checklist of every admin-mutating method:

  | Admin-mutating method | `assert_one_yocto()` | Rationale |
  |---|---|---|
  | `add_admin` | Required | Admin state change |
  | `remove_admin` | Required | Admin state change |
  | `create_proposal` | **Exempt** | Requires bond >= 1 NEAR, which forces Full Access Key usage (same as 1 yocto) and additionally provides economic spam prevention. Adding `assert_one_yocto()` would be redundant and would complicate attached deposit semantics (the full attached amount is the bond). |
  | `cancel_proposal` | Required | Admin state change; without it, a function-call key could cancel proposals without wallet confirmation |
  | `expire_pending_proposal` | Required | Admin state change |
  | `clear_stale_pending_vote` | Required | Admin state change |
  | `blocklist_account` | Required | Admin state change |
  | `unblocklist_account` | Required | Admin state change |
  | `update_quorum_bps` | Required | Config change |
  | `update_voting_period_secs` | Required | Config change |
  | `update_pending_expiry_secs` | Required | Config change |
  | `update_verified_accounts_contract` | Required | Config change |
  | `update_min_proposal_bond` | Required | Config change |
  | `update_finalize_grace_period_secs` | Required | Config change |
  | `update_max_start_delay_secs` | Required | Config change |
  | `migrate` | Required (1 yoctoNEAR) | Upgrade protection |
- **Private callbacks**: Mark callbacks `#[private]`, verify `promise_results_count`, and handle `promise_result` errors.
- **Async safety**: Treat cross-contract calls as asynchronous; only finalize proposal/vote state in callbacks.
- **Vote race protection**: Record a `PendingVote` (containing `submitted_at`, `choice`, and `voter_deposit`) before the async call to prevent concurrent submissions and preserve submission context; remove on callback completion (success or failure). Lock is enforced per proposal and per account.
- **Submission timestamp enforcement**: The vote callback must use `pending_vote.submitted_at` (not `env::block_timestamp()`) to enforce the voting deadline (`submitted_at <= proposal.ends_at`). This ensures votes submitted before `ends_at` are accepted even when the callback executes in a later block. The NEAR security checklist recommends recording pre-call state if you need to enforce timing constraints later.
- **Callback refunds**: If a vote cross-contract call fails, refund any attached deposit to the voter. Refunds use `Promise::new(recipient).transfer(amount)`, which is a batched action (not a cross-contract call) and does not produce a callback. The contract cannot detect whether the transfer succeeded. If the recipient account no longer exists, the amount is burned by the NEAR protocol. Therefore, all state changes must be finalized before creating the transfer promise, so that a burned refund does not leave the contract in an inconsistent "owed" state.
- **Callback gas safety**: Reserve gas for refund + cleanup logic; callbacks must not call external contracts. `Promise::new(recipient).transfer(amount)` is a batched action (not a cross-contract call) and is permitted in callbacks. However, callbacks must never chain further cross-contract calls via `.then()` after a refund. Gas must be budgeted so that all state mutations and the refund transfer action complete without running out of gas; if a callback exhausts gas before reaching the refund transfer, all state changes in that callback receipt are rolled back.
- **Callback robustness**: Handle errors explicitly and avoid panicking in callbacks; ensure sufficient gas for refunds and cleanup. Minimum gas budgets: snapshot callback 20 Tgas, vote callback 30 Tgas. Structure callbacks so that all fallible operations (state reads, validation, state writes) complete before creating any `Promise::new().transfer()`. Never panic after creating a transfer promise — if the receipt fails, the promise is discarded and the refund is lost while state is rolled back.
- **Callback cleanup order (checks-effects-interactions)**: Callbacks must follow this strict sequence: (1) validate callback result and check current state is still expected (checks); (2) read and remove `PendingVote` records (clearing locks and extracting `submitted_at`, `choice`, `voter_deposit`) and apply all state mutations — including deducting tracked deposit amounts, updating proposal/vote status, and updating counters (effects); (3) emit events reflecting the final state; (4) issue refund transfers via `Promise::new(recipient).transfer(amount)` as the final operation (interactions). State must reflect the refund as already issued before the transfer promise is created. This ordering ensures that if the transfer fails and tokens are burned, contract state is not left in an inconsistent "owed" state.
- **Reentrancy safety**: Avoid any exploitable intermediate state between call and callback.
- **Fail fast**: Validate inputs early (lengths, roles, status) and return clear errors.
- **Overflow checks**: Enable `overflow-checks = true` in `Cargo.toml`.
- **Storage security**: Follow storage model in Section 5. Limit text sizes and enforce pagination to prevent DoS. Use `env::storage_byte_cost()` for accurate storage cost calculations. When vote deposit is required (contract balance insufficient), compute storage delta and refund excess.
- **Access key hygiene**: Avoid full-access keys on the contract account after deployment to prevent `#[private]` bypass.
- **Upgrade access**: Admin-only upgrades must be protected by `predecessor_account_id` and 1 yoctoⓃ.
- **Unique storage prefixes**: Ensure all collections have unique storage keys/prefixes.
- **Callback status checks**: All callbacks (snapshot, vote) must verify the proposal/vote is still in the expected status before applying state changes. A proposal may be cancelled or finalized between the initial call and callback execution (NEAR callbacks execute in a later block). Vote callbacks that discover a finalized proposal must reject the vote with `VoteRejectionReason::PostFinalize`, clean up the `PendingVote` record, and refund the deposit.
- **Blocklist callback safety**: Blocklist add uses an async verification callback; the callback must verify promise results, clear the pending blocklist op in all paths (success or failure), and apply the blocklist change only on verified success.
- **Pending lock recovery**: Stuck `PendingVote` records (from failed callbacks where the initial call's state persists per NEAR's receipt-level atomicity) must have an admin-accessible recovery mechanism (`clear_stale_pending_vote`) to prevent permanent finalization blockage. Recovery must also refund any `voter_deposit` stored in the pending record.
- **Event emission ordering**: Events must be emitted after all state changes succeed and before refund transfer promises are created. NEAR's runtime makes logs from panicking callbacks visible to indexers, which could create phantom events if events are emitted before a subsequent panic. Since both event emission and `Promise::new().transfer()` are non-panicking operations, they may safely follow all state mutations without risk of phantom events or rolled-back state.
- **Verified accounts dependency**: The governance contract's integrity depends on the verified-accounts contract returning truthful data. The verified-accounts contract has its own upgrade path (`migrate()`) and single `backend_wallet` admin. If compromised or upgraded, governance outcomes may be affected. This trust dependency must be documented in deployment procedures.
- **Zero-snapshot rejection**: The snapshot callback should reject a verified count of 0 at creation time (fail fast) rather than allowing the proposal to become Active and auto-fail at finalization.

---

## 15. Governance Threat Model and Mitigations

- **Low participation / quorum manipulation**: Use snapshot-based quorum with a default 7% and make quorum configurable.
- **Sybil or identity farming**: Only allow verified accounts, and require verification prior to proposal creation.
- **Admin compromise**: Use multi-admin and recommend operational multisig; emit events for all admin changes. Note: a compromised admin can rapidly add colluding admin accounts via `add_admin` (each call only requires 1 yoctoNEAR). Mitigation: use a multisig wrapper as the admin account and monitor `admin_added` events.
- **Proposal spam**: Restrict proposal creation to admins; consider rate limits or bonds if scope expands.
- **Last-minute vote swings**: Snapshot verified count via callback after creation; consider late-quorum extension in future if needed.
- **Blocklist abuse**: Require admin-only actions with auditable events; do not retroactively change results of finalized proposals. Blocklist changes are only allowed when there are no Pending or Active proposals, preventing mid-vote manipulation. Primary mitigation: use a multisig admin account. Secondary mitigation: all blocklist actions emit events for transparency.
- **Phantom events from failed callbacks**: NEAR's runtime makes event logs from panicking callbacks visible to indexers even though state changes are rolled back. Mitigation: indexers must check receipt execution status; events should only be emitted after all state changes succeed.
- **Snapshot quorum inflation**: The `snapshot_verified_count` (quorum denominator) may include accounts verified in the 1-2 block callback window that cannot vote (`verified_at > created_at`). Severity: Low — at any realistic verification rate, the inflation adds zero additional required quorum votes due to ceiling rounding. The inflated snapshot makes quorum marginally harder to reach, which is the conservative direction (higher legitimacy bar). Mitigation: the callback window is bounded to 1-2 blocks (~1-2 seconds); `quorum_bps` is configurable if the community wants to compensate. The verified-accounts contract currently provides only `get_verified_count()` (total count, no date filtering). If verification rates become extreme, a `get_verified_count_before(timestamp)` method using binary search over a timestamp index could be added to tighten the snapshot to exact `verified_at <= created_at` counts.
- **Finalization blocking via stuck pending votes**: A malicious actor could spam low-gas vote transactions to create stuck `PendingVote` records that block finalization. Primary mitigation: the configurable `finalize_grace_period_secs` allows finalize to proceed after the grace period even with pending votes. Secondary mitigation: admin can clear stuck pending votes via `clear_stale_pending_vote`. The attack is also economically costly — each `cast_vote` call requires gas fees and potentially a storage deposit.
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
- **Blocklist changes**: Use `get_verification(account_id)` via async callback when adding to the blocklist; reject unverified accounts. No additional blocklist-related cross-contract calls occur at proposal creation or vote time beyond the existing snapshot and vote verification calls.
- **Contract address**: Stored in config and updateable by admin only when no proposal is Pending or Active.
- **Callback gas**: Snapshot callback uses at least 20 Tgas; vote callback uses at least 30 Tgas.
- **Error handling**: If cross-contract call fails, creation/vote must fail cleanly and any `PendingVote` record must be removed (with `voter_deposit` refunded).
- **Serialization**: Promise results are JSON; parse with `serde_json::from_slice` in callbacks and treat deserialization failures as callback failures.
- **Verification pause behavior**: Verified Accounts pause only blocks writes; reads remain available, so governance reads may proceed.
- **Zero-snapshot sanity check**: If `get_verified_count()` returns 0, the snapshot callback should fail the proposal creation rather than creating an Active proposal with `snapshot_verified_count = 0` that will auto-fail at finalization.
- **Callback status verification**: The snapshot callback must check that the proposal is still in `Pending` status before transitioning to Active. If the proposal was cancelled between the cross-contract call and callback, the callback aborts without further state changes.
- **Trust dependency**: The governance contract trusts that the verified-accounts contract returns accurate data. The verified-accounts contract has its own upgrade path (`migrate()`) and single `backend_wallet` admin. If compromised, it could affect governance outcomes. This dependency should be documented in deployment procedures and operational runbooks.

---

## 17. Error Handling

Every synchronous panic uses a stable `ERR_*` string constant defined in the contract. Callback-phase errors are logged via `env::log_str()` (not panics) and communicated through events (`VoteRejectionReason` in Section 11.7, `ProposalCreationFailedReason` in Section 11.8).

Methods requiring `assert_one_yocto()` use the SDK's built-in function, which panics with `"Requires attached deposit of exactly 1 yoctoNEAR"`. No custom constant — the per-method table below marks which methods use it.

### 17.1 Error Constants

**Access control:**

| Constant | Condition |
|---|---|
| `ERR_NOT_ADMIN` | `predecessor_account_id()` is not in admins set |
| `ERR_CANNOT_REMOVE_LAST_ADMIN` | `remove_admin` would leave zero admins |

**Proposal lifecycle:**

| Constant | Condition |
|---|---|
| `ERR_PROPOSAL_NOT_FOUND` | Proposal ID does not exist in `proposals` Vector |
| `ERR_PROPOSAL_NOT_ACTIVE` | Proposal status is not `Active` |
| `ERR_PROPOSAL_NOT_PENDING` | Proposal status is not `Pending` |
| `ERR_PROPOSAL_ALREADY_FINALIZED` | Proposal status is `Succeeded` or `Failed` |
| `ERR_PROPOSAL_ALREADY_CANCELLED` | Proposal status is `Cancelled` |
| `ERR_PROPOSAL_NOT_STARTED` | `env::block_timestamp() < proposal.start_at` |
| `ERR_PROPOSAL_ENDED` | `env::block_timestamp() > proposal.ends_at` |
| `ERR_PROPOSAL_NOT_EXPIRED` | Pending proposal has not reached `pending_expires_at` |
| `ERR_FINALIZE_NOT_ENDED` | `env::block_timestamp() < proposal.ends_at` |
| `ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES` | `pending_vote_count > 0` and grace period not elapsed |

**Proposal creation:**

| Constant | Condition |
|---|---|
| `ERR_TITLE_TOO_LONG` | `title.len() > 140` |
| `ERR_AUTHOR_TOO_LONG` | `author.len() > 120` |
| `ERR_DESCRIPTION_TOO_LONG` | `description.len() > 10_000` |
| `ERR_INSUFFICIENT_BOND` | Attached deposit < `config.min_proposal_bond` |
| `ERR_START_AT_BEFORE_CREATED` | `start_at < created_at` |
| `ERR_START_AT_TOO_FAR` | `start_at > created_at + (max_start_delay_secs * 1_000_000_000)` |

**Voting:**

| Constant | Condition |
|---|---|
| `ERR_BLOCKLISTED` | Voter is in the blocklist (pre-check in `cast_vote`, not re-checked in callback because blocklist changes are locked during proposals) |
| `ERR_ALREADY_VOTED` | A final vote already exists for `(proposal_id, voter)` |
| `ERR_VOTE_ALREADY_PENDING` | A `PendingVote` already exists for `(proposal_id, voter)` |
| `ERR_INSUFFICIENT_DEPOSIT` | Contract balance insufficient for vote storage and attached deposit too low |

**Blocklist:**

| Constant | Condition |
|---|---|
| `ERR_BLOCKLIST_LOCKED` | Any proposal is Pending or Active |
| `ERR_BLOCKLIST_OP_PENDING` | A `PendingBlocklistOp` is already in flight |
| `ERR_BLOCKLIST_ACCOUNT_NOT_VERIFIED` | Blocklist callback: account has no verification record |
| `ERR_ACCOUNT_NOT_BLOCKLISTED` | `unblocklist_account`: account is not in the blocklist |

**Config validation (init + update methods):**

| Constant | Condition |
|---|---|
| `ERR_NO_ADMINS` | `admins` vec is empty at init |
| `ERR_CONFIG_LOCKED` | `voting_period_secs` or `verified_accounts_contract` update while any proposal is Pending or Active |
| `ERR_QUORUM_BPS_OUT_OF_RANGE` | `quorum_bps < 1` or `> 10_000` |
| `ERR_VOTING_PERIOD_OUT_OF_RANGE` | `voting_period_secs < 86_400` or `> 7_776_000` |
| `ERR_PENDING_EXPIRY_OUT_OF_RANGE` | `pending_expiry_secs < 300` or `> 86_400` |
| `ERR_MIN_BOND_OUT_OF_RANGE` | `min_proposal_bond < 1 NEAR` or `> 100 NEAR` |
| `ERR_GRACE_PERIOD_OUT_OF_RANGE` | `finalize_grace_period_secs < 300` or `> 86_400` |
| `ERR_MAX_START_DELAY_OUT_OF_RANGE` | `max_start_delay_secs > 7_776_000` |

**Admin recovery:**

| Constant | Condition |
|---|---|
| `ERR_PENDING_VOTE_NOT_FOUND` | `clear_stale_pending_vote`: no `PendingVote` at `(proposal_id, account_id)` |

**Pagination:**

| Constant | Condition |
|---|---|
| `ERR_LIMIT_TOO_LARGE` | `limit > 100` in any paginated view method |

**Callback-phase (logged via `env::log_str()`, not panics — callbacks return false):**

| Constant | Used in |
|---|---|
| `ERR_PENDING_VOTE_NOT_FOUND_IN_CALLBACK` | Vote callback: `PendingVote` record missing (internal error; indicates storage corruption or concurrent removal) |
| `ERR_SNAPSHOT_CALLBACK_FAILED` | Snapshot callback: promise failed or returned invalid JSON |
| `ERR_ZERO_SNAPSHOT` | Snapshot callback: effective verified count is 0 after blocklist subtraction |

### 17.2 Per-Method Error Reference

| Method | `assert_one_yocto()` | Synchronous errors |
|---|---|---|
| `new` | No | `ERR_NO_ADMINS`, `ERR_QUORUM_BPS_OUT_OF_RANGE`, `ERR_VOTING_PERIOD_OUT_OF_RANGE`, `ERR_PENDING_EXPIRY_OUT_OF_RANGE`, `ERR_MIN_BOND_OUT_OF_RANGE`, `ERR_GRACE_PERIOD_OUT_OF_RANGE`, `ERR_MAX_START_DELAY_OUT_OF_RANGE` |
| `add_admin` | Yes | `ERR_NOT_ADMIN` |
| `remove_admin` | Yes | `ERR_NOT_ADMIN`, `ERR_CANNOT_REMOVE_LAST_ADMIN` |
| `create_proposal` | No (bond >= 1 NEAR) | `ERR_NOT_ADMIN`, `ERR_TITLE_TOO_LONG`, `ERR_AUTHOR_TOO_LONG`, `ERR_DESCRIPTION_TOO_LONG`, `ERR_INSUFFICIENT_BOND`, `ERR_START_AT_BEFORE_CREATED`, `ERR_START_AT_TOO_FAR`, `ERR_BLOCKLIST_OP_PENDING` |
| `cancel_proposal` | Yes | `ERR_NOT_ADMIN`, `ERR_PROPOSAL_NOT_FOUND`, `ERR_PROPOSAL_ALREADY_FINALIZED`, `ERR_PROPOSAL_ALREADY_CANCELLED` |
| `expire_pending_proposal` | Yes | `ERR_NOT_ADMIN`, `ERR_PROPOSAL_NOT_FOUND`, `ERR_PROPOSAL_NOT_PENDING`, `ERR_PROPOSAL_NOT_EXPIRED` |
| `clear_stale_pending_vote` | Yes | `ERR_NOT_ADMIN`, `ERR_PROPOSAL_NOT_FOUND`, `ERR_PENDING_VOTE_NOT_FOUND` |
| `finalize_proposal` | No (public) | `ERR_PROPOSAL_NOT_FOUND`, `ERR_PROPOSAL_NOT_ACTIVE`, `ERR_FINALIZE_NOT_ENDED`, `ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES` |
| `cast_vote` | No | `ERR_PROPOSAL_NOT_FOUND`, `ERR_PROPOSAL_NOT_ACTIVE`, `ERR_PROPOSAL_NOT_STARTED`, `ERR_PROPOSAL_ENDED`, `ERR_BLOCKLISTED`, `ERR_ALREADY_VOTED`, `ERR_VOTE_ALREADY_PENDING`, `ERR_INSUFFICIENT_DEPOSIT` |
| `blocklist_account` | Yes | `ERR_NOT_ADMIN`, `ERR_BLOCKLIST_LOCKED`, `ERR_BLOCKLIST_OP_PENDING` |
| `unblocklist_account` | Yes | `ERR_NOT_ADMIN`, `ERR_BLOCKLIST_LOCKED`, `ERR_BLOCKLIST_OP_PENDING`, `ERR_ACCOUNT_NOT_BLOCKLISTED` |
| `update_quorum_bps` | Yes | `ERR_NOT_ADMIN`, `ERR_QUORUM_BPS_OUT_OF_RANGE` |
| `update_voting_period_secs` | Yes | `ERR_NOT_ADMIN`, `ERR_CONFIG_LOCKED`, `ERR_VOTING_PERIOD_OUT_OF_RANGE` |
| `update_pending_expiry_secs` | Yes | `ERR_NOT_ADMIN`, `ERR_PENDING_EXPIRY_OUT_OF_RANGE` |
| `update_verified_accounts_contract` | Yes | `ERR_NOT_ADMIN`, `ERR_CONFIG_LOCKED` |
| `update_min_proposal_bond` | Yes | `ERR_NOT_ADMIN`, `ERR_MIN_BOND_OUT_OF_RANGE` |
| `update_finalize_grace_period_secs` | Yes | `ERR_NOT_ADMIN`, `ERR_GRACE_PERIOD_OUT_OF_RANGE` |
| `update_max_start_delay_secs` | Yes | `ERR_NOT_ADMIN`, `ERR_MAX_START_DELAY_OUT_OF_RANGE` |
| `migrate` | Yes (1 yoctoNEAR) | `ERR_NOT_ADMIN` |

Paginated view methods (`list_admins`, `list_blocklist`, `list_proposals`, `list_votes`): `ERR_LIMIT_TOO_LARGE`.

---

## 18. Upgradeability

- Use the `VersionedContract` enum pattern matching the verified-accounts contract: define a `VersionedContract` enum with `#[near(contract_state)]`, wrapping a `ContractV1` struct (the current version). Implement `From<VersionedContract>` for lazy migration. Future upgrades add new variants (e.g., `V2(ContractV2)`) with conversion logic.
- Provide `migrate()` method with `#[init(ignore_state)]`.
- Keep storage keys stable across versions.
- Upgrade model: admin-controlled upgrades; restrict `migrate()` and code updates to admin-only paths and require 1 yoctoⓃ.
- **Build toolchain**: Use the same reproducible build configuration as the verified-accounts contract: Docker image `sourcescan/cargo-near:0.19.0-rust-1.86.0`, `near-sdk = "5.24"`, LTO enabled, opt-level "z", debug stripped. Use identical Cargo.toml lint configuration: deny `unwrap_used`, `expect_used`, `panic`, `indexing_slicing`.

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
  - Bond never refunded: verify bond is not refunded on any lifecycle outcome (success, failure, cancellation, pending expiry, callback failure).
  - `is_vote_free` view method returns correct state.
  - Config update granularity: verify `quorum_bps`, `pending_expiry_secs`, and `min_proposal_bond` can be updated during active proposals; verify `voting_period_secs` and `verified_accounts_contract` are blocked while proposals are Active.
  - Blocklist locking: verify blocklist changes are rejected when any proposal is Pending/Active and accepted otherwise.
  - Blocklist pending op: verify only one pending blocklist op is allowed and `create_proposal` is rejected while a blocklist op is pending.
  - Blocklist verification: verify blocklist rejects unverified accounts via callback and succeeds for verified accounts.
  - Blocklist quorum exclusion: verify blocklist size is subtracted from `snapshot_verified_count` at proposal creation time.
  - Blocklist behavior and list_blocklist pagination.
  - Snapshot callback with cancelled proposal — verifies callback checks status and aborts.
  - Stuck pending vote lock — verifies admin can clear it via `clear_stale_pending_vote` and finalization proceeds.
  - Pending vote stores submission context: verify `PendingVote` contains correct `submitted_at`, `choice`, and `voter_deposit` after `cast_vote`.
  - Late callback acceptance: verify a vote submitted before `ends_at` is accepted by the callback even when callback executes after `ends_at` (using stored `submitted_at`).
  - Start time validation: verify `start_at` defaults to `created_at` when omitted and rejects `start_at < created_at` or beyond `max_start_delay_secs`.
  - Start time voting window: verify `cast_vote` rejects before `start_at`, accepts within `[start_at, ends_at]`.
  - Start time callback enforcement: verify callback rejects if `submitted_at < start_at`.
  - Eligibility remains `created_at`: verify `verified_at > created_at` is rejected even if `verified_at <= start_at`.
  - Event payloads include `start_at` in `proposal_created` and are U64-wrapped.
  - `max_start_delay_secs` config: verify update bounds, event payload includes it, and `get_config` returns it.
  - Late submission rejection: verify callback defensively rejects `submitted_at > ends_at` (edge case guard).
  - `voted_at` reflects submission time: verify the recorded Vote's `voted_at` equals `PendingVote.submitted_at`, not the callback's `env::block_timestamp()`.
  - Stale pending vote deposit refund: verify `clear_stale_pending_vote` refunds `voter_deposit` from the stuck `PendingVote`.
  - `expire_pending_proposal` — verifies admin can expire Pending proposals past `pending_expires_at`, sets `failure_kind: PendingExpired`.
  - Zero-snapshot rejection — verifies snapshot callback fails proposal creation when `get_verified_count()` returns 0.
  - `failure_kind` field — verifies correct failure reasons set for different failure modes (QuorumNotMet, Rejected, PendingExpired, ZeroSnapshot).
  - Voting period bounds — verifies minimum (86,400s) and maximum (7,776,000s) enforcement.
  - Proposal bond bounds — verifies minimum (1 NEAR) and maximum (100 NEAR) enforcement.
  - Quorum bps bounds — verifies minimum (1) enforcement.
  - Pending expiry bounds — verifies minimum (300s) and maximum (86,400s) enforcement.
  - Pending expiry distinct from voting period — verifies that `pending_expires_at` is computed from `pending_expiry_secs` (not `voting_period_secs`), and that `expire_pending_proposal` uses `pending_expires_at` for the expiry check.
  - New view methods: `get_proposal_count`, `get_pending_votes_count`.
  - Vote deposit refund ordering: verify that vote is recorded and tallies updated before excess deposit refund on success path; verify pending lock cleared before full deposit refund on failure path.
  - `cancel_proposal` requires one yocto: verify that calling `cancel_proposal` without attaching exactly 1 yoctoNEAR panics.
  - JSON serialization safety: verify that all view methods return `U64`-wrapped integers (not raw `u64`) by checking that JSON output contains string-encoded numbers for timestamp and count fields. Verify that nanosecond timestamps (e.g., `1_700_000_000_000_000_000u64`) round-trip correctly through JSON serialization without precision loss.
  - Event payload types: verify that emitted `EVENT_JSON` payloads serialize `u64` fields as JSON strings (via `U64`), not as raw JSON numbers.
  - `list_votes` pagination: verify per-proposal vote enumeration with pagination returns correct `VoteView` structs including `voter`, `proposal_id`, `choice`, and `voted_at`.
  - `vote_rejected` event: verify event is emitted with correct `VoteRejectionReason` for each rejection scenario (proposal cancelled, not verified, verified after creation, proposal expired, callback failed, post finalize).
  - Post-finalize vote rejection: verify that a vote callback executing after finalization rejects the vote, refunds the deposit, and emits `vote_rejected` with `reason: PostFinalize`.
  - Finalize grace period: verify that finalize is blocked by pending votes before the grace period, but succeeds after `ends_at + finalize_grace_period_secs`.
  - Finalize grace period bounds: verify minimum (300s) and maximum (86,400s) enforcement for `update_finalize_grace_period_secs`.
  - Cancel does not clear pending votes: verify that `cancel_proposal` does not modify `pending_votes` LookupMap entries; verify that vote callbacks correctly handle cancelled proposals by cleaning up their own `PendingVote` records and refunding deposits.
  - Cancel after `ends_at`: verify an admin can cancel an Active proposal after voting ends but before finalize.
  - Effective zero snapshot: verify snapshot callback fails proposal creation when `verified_count > 0` but `blocklist_size >= verified_count` (effective snapshot is zero).
  - Already voted: verify `cast_vote` rejects when a final vote already exists for the `(proposal_id, voter)`.
- Integration tests (using real verified-accounts contract):
  - Snapshot and vote eligibility — deploy real verified-accounts WASM, store verifications via real transactions, verify `get_verified_count()` and `get_verification()` return correct data through governance cross-contract calls.
  - Async callbacks and success paths, including deposit refunds on success.
  - Event emission for indexer consumption (vote_cast events).
  - Full lifecycle with blocklist exclusion — create proposal, cast votes, verify blocklisted accounts cannot vote, finalize, verify results.
  - Concurrent pending votes — multiple voters submit simultaneously, verify locks and finalization behavior.
  - Late callback with deposit refund — submit vote before `ends_at`, callback executes after; verify vote recorded with correct `submitted_at` and excess deposit refunded.
  - Post-finalize vote callback — submit vote, finalize proposal (via grace period override or after all other pending votes clear), then verify the late vote callback rejects with `PostFinalize`, refunds deposit, and emits `vote_rejected`.
  - `list_votes` pagination at scale — create proposal, cast multiple votes, verify `list_votes` returns correct paginated results and handles edge cases (empty, beyond range).
  - Finalize grace period override — create proposal, submit votes that get stuck (low gas), verify finalize blocked before grace period, verify finalize succeeds after grace period with correct tallies (only counting resolved votes).
- Integration tests (using mock contracts for failure modes):
  - Snapshot callback failure — deploy `mock-panic-on-count` contract, create proposal, verify snapshot callback handles the panic and fails proposal creation with `proposal_creation_failed` event.
  - Vote callback failure — deploy `mock-panic-on-verification` contract, cast vote, verify vote callback handles the panic, cleans up `PendingVote`, refunds deposit, and emits `vote_rejected` with `reason: CallbackFailed`.
  - Deserialization failure — deploy `mock-malformed-response` contract, verify both snapshot and vote callbacks handle invalid JSON gracefully (fail proposal creation or reject vote with `CallbackFailed`).
  - Zero snapshot rejection — deploy `mock-zero-count` contract (or use real contract with no stored verifications), create proposal, verify snapshot callback fails proposal with zero count.
  - Stuck pending vote with deposit — use `mock-panic-on-verification` to cause callback failure for a vote requiring deposit; verify admin clears stuck `PendingVote` and deposit is refunded to voter.

**Test infrastructure**: Integration tests use a **hybrid approach** — the real verified-accounts contract for happy-path and realistic scenarios, and minimal purpose-built mock contracts only for failure modes that cannot be reliably triggered with the real contract.

**Real verified-accounts contract (primary)**: Deploy the real verified-accounts contract WASM to a `near-workspaces` sandbox. Set up state using real transactions: initialize with a backend wallet, call `store_verification` with valid NEP-413 signatures to create verified accounts. This matches the pattern in `contracts/verified-accounts/tests/integration/helpers.rs`. Governance test helpers should reuse or mirror these utilities. Used for: happy-path lifecycle, vote eligibility, snapshot counts, blocklist interactions, pagination, and all realistic integration scenarios.

**Mock contracts (failure modes only)**: Separate, purpose-built mock contracts for each failure scenario — not a single generic configurable mock. Each mock is a minimal contract implementing only the interface methods needed for its specific test case:
- **`mock-panic-on-count`**: `get_verified_count()` panics — tests snapshot callback failure path.
- **`mock-panic-on-verification`**: `get_verification()` panics — tests vote callback failure path when the cross-contract call itself fails.
- **`mock-malformed-response`**: Returns invalid JSON from `get_verified_count()` or `get_verification()` — tests deserialization failure handling in callbacks.
- **`mock-zero-count`**: `get_verified_count()` returns 0 — tests zero-snapshot rejection. Can also be tested with the real contract by not storing any verifications, but a dedicated mock makes intent explicit.

Each mock is compiled to its own WASM and stored in `fixtures/`.

**Test directory structure**: Mirror the verified-accounts test layout:
```
contracts/governance/tests/
├── unit/          — unit test modules
├── integration/   — integration test modules using near-workspaces
└── fixtures/      — compiled WASM files (mock-panic-on-count.wasm,
                     mock-panic-on-verification.wasm,
                     mock-malformed-response.wasm,
                     mock-zero-count.wasm) and test data
```

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
