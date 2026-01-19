# Product Requirements Document: Citizens House Voting

**Version:** 0.2  
**Date:** 2026-01-16  
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
- Contract account will be funded for baseline storage; all incremental storage is funded through NEP-145 storage balances. Callers top up their balance via `storage_deposit` (or inline deposits on actions) and actions charge the caller’s available storage balance based on storage-usage deltas.
- Storage refunds are credited to the original payer’s storage balance (proposal creator, voter, or admin), and withdrawals are made via `storage_withdraw`.
- Storage costs are computed as `storage_usage_delta * storage_byte_cost`, using `env::storage_usage()` before and after a state change.

**NEAR execution model considerations**

- Cross-contract calls are asynchronous; callbacks always execute and must check promise results.
- The contract must not be left in an exploitable state between call and callback.
- Storage staking requires sufficient balance as state grows; all incremental storage is funded by caller deposits for the actions that caused it.
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
- **Voting eligibility**: Verified accounts only (verified prior to proposal creation), and not blocklisted.
- **Verification timing**: Accounts must be verified before proposal creation to vote (`verified_at <= created_at`).
- **Voting period**: Global configurable; default 14 days.
- **Snapshot**: Verified account count fetched via callback after proposal creation; it may include accounts verified before the callback completes and is acceptable.
- **Quorum**: Default 7% of snapshot verified count; configurable (basis points).
  - Quorum count uses `ceil((snapshot_verified_count * quorum_bps) / 10_000)`.
- **Passing condition**: Quorum met and `yes_votes >= no_votes` (ties pass).
- **Finalize preconditions**: Finalize is only allowed for `Active` proposals; calls for `Pending`, `Cancelled`, `Succeeded`, or `Failed` must be rejected.
- **Pending expiry**: If a proposal remains `Pending` past `created_at + voting_period_secs`, it auto-expires to `Failed` and refunds storage to the payer’s storage balance.
- **Blocklisting**: Prevents future voting. For Active proposals, votes from accounts blocklisted before finalize are excluded from both quorum participation and yes/no tallies. Blocklisting does not alter results of finalized proposals.
- **Zero snapshot**: If `snapshot_verified_count == 0`, the proposal auto-fails at finalization (quorum cannot be met).
- **Config updates**: Blocked while any proposal is Pending or Active.
- **Storage funding**: Use NEP-145 storage balances. Callers attach deposits to cover storage increases for their actions; refund excess to the payer’s storage balance. For actions that increase storage, require either a sufficient attached deposit or sufficient available storage balance.

---

## 9. Proposal Lifecycle

1. **Create (admin-only)**
   - Pending is a transient state between the create call and snapshot callback; proposals should not remain Pending indefinitely.
   - Contract stores a pending proposal record with `created_at = now` and `ends_at = created_at + voting_period_secs`. Pending expiry uses `created_at + voting_period_secs`.
   - Contract calls Verified Accounts to fetch `verified_count` (snapshot).
   - Callback finalizes proposal to Active and stores snapshot count; it must not change `created_at` or `ends_at`.
   - Snapshot count may include accounts verified between proposal creation and callback completion; this slightly raises quorum and is acceptable.
   - If snapshot call fails, pending proposal is cleared, creation fails, and the attached deposit is refunded to the proposal creator’s storage balance.
   - If a proposal remains Pending past `created_at + voting_period_secs`, it auto-expires to `Failed` and refunds storage to the payer’s storage balance.

2. **Vote (verified-only)**
   - Contract checks if proposal is Active and within voting window.
   - Contract checks blocklist.
   - Contract records a pending vote lock per proposal (`pending_votes` keyed by `(proposal_id, account_id)`) to prevent duplicate submissions for the same proposal.
   - Contract calls Verified Accounts `get_verification` (summary).
   - On callback, re-checks proposal status/time and blocklist, then enforces `verified_at <= proposal.created_at` and records the vote if still valid and not already voted.
   - If the vote is not recorded, refund the attached deposit to the voter’s storage balance and clear the pending lock.
   - Finalization excludes votes from accounts blocklisted before finalize from quorum participation and yes/no tallies.

3. **Finalize**
   - Anyone can call finalize after `ends_at` when not paused.
   - Finalize is only valid for `Active` proposals.
   - Votes from accounts blocklisted before finalize are excluded from quorum participation and yes/no tallies.
   - If `snapshot_verified_count == 0`, proposal fails.
   - Proposal becomes Succeeded or Failed based on quorum and yes/no results.
   - Finalize uses `ends_at` as originally set (pause does not freeze time).
   - If a proposal auto-expired while Pending, finalize returns an expired error.

4. **Cancel (admin-only)**
   - If Active and not finalized, proposal becomes Cancelled and freed storage is refunded to the original payer’s storage balance.
   - Refunds should be applied after clearing any pending locks for the proposal.

---

## 10. Functional Requirements

### 10.1 Initialization

- Must initialize with:
  - `verified_accounts_contract: AccountId`
  - `admins: Vec<AccountId>` (must include at least one)
  - `quorum_bps: u16` (default 700)
  - `voting_period_secs: u64` (default 14 days)
- Must set `paused = false`.

### 10.2 Admin Management

- **add_admin(account_id)**: Admin-only; adds admin.
  - Requires attached deposit to cover storage for the new admin; refund excess to the payer’s storage balance.
- **remove_admin(account_id)**: Admin-only; cannot remove last admin.
  - Refund freed storage to the original payer’s storage balance.
  - Remove admin should not allow reclaiming storage deposited by other accounts.
  - Admins must not be able to withdraw storage funded by other accounts.
- **is_admin(account_id)** view.
- All admin writes require `predecessor_account_id` checks and an attached deposit >= 1 yocto; use `assert_one_yocto()` only for methods that do not accept larger deposits.
- Admin-only methods must accept either 1 yocto (for no-storage-change actions) or a storage deposit; reject 0-deposit admin calls.
- Admin-only methods that do not change storage still require 1 yocto to prevent function-call key abuse.

### 10.3 Proposal Management

- **create_proposal(title, author, description)**: Admin-only.
  - Validates length limits (see limits below).
  - Requires attached deposit to cover proposal storage; refund excess to the payer’s storage balance.
  - Stores `creator = predecessor_account_id()` with the proposal for refunds and auditability.
  - Stores a pending proposal with `created_at = now` and `ends_at = created_at + voting_period_secs` and returns a `Promise` for the snapshot call.
  - Callback sets the snapshot count and activates the proposal; it must not change `created_at` or `ends_at`.
  - Creation fails if snapshot call fails or returns invalid data; refund the attached deposit to the creator’s storage balance.
  - Callback cleanup order: clear pending locks, then activate proposal, then adjust storage balances/refunds.
- **cancel_proposal(proposal_id)**: Admin-only; only if not finalized.
  - Refund freed storage to the original payer’s storage balance.
- **finalize_proposal(proposal_id)**: Public; only after end time and when not paused.
  - Only valid for `Active` proposals; `Pending`/`Cancelled`/finalized proposals must be rejected.
  - Exclude votes from accounts blocklisted before finalize from quorum participation and yes/no tallies.
  - If `snapshot_verified_count == 0`, the proposal fails.
  - Finalize uses `ends_at` as originally set (pause does not freeze time).
  - If a proposal remains Pending beyond the expiry window, finalize should return an error indicating the proposal expired.
  - Pending expiry uses `created_at + voting_period_secs` without pause adjustment.
  - Pending expiry should mark the proposal `Failed` and free storage to the payer’s storage balance.
- **get_proposal(proposal_id)** view.
- **list_proposals(from_index, limit)** view with pagination, ordered by `created_at` then `id` for stable pagination.

### 10.4 Voting

- **cast_vote(proposal_id, choice)**: Verified-only (verified before proposal creation), not blocklisted.
  - `choice` is `Yes` or `No`.
  - One vote per proposal per account.
  - Requires active proposal and within `[created_at, ends_at]`.
  - Requires attached deposit to cover storage for the vote; refund any excess to the payer’s storage balance.
  - Uses async `get_verification` callback to re-check status/time and blocklist, then enforce `verified_at <= proposal.created_at` before recording the vote.
  - Pending vote lock is enforced per proposal and per account; concurrent submissions are rejected until the callback clears the lock.
  - If the vote is not recorded, refund the attached deposit to the voter’s storage balance and clear the pending lock.
  - Callback cleanup order: clear pending locks, then record vote, then adjust storage balances/refunds.
- **has_voted(proposal_id, account_id)** view.
- **get_vote(proposal_id, account_id)** view.
- **list_votes(proposal_id, from_index, limit)** view with pagination (limit <= 100) and stable ordering by `voted_at`.

### 10.5 Reject List

- **blocklist_account(account_id)**: Admin-only; prevents future votes and excludes the account's votes from Active proposals when finalizing if they are added to the Reject List before finalize.
  - Requires attached deposit to cover storage growth; refund excess to the payer’s storage balance.
- **unblocklist_account(account_id)**: Admin-only.
  - Refund freed storage to the original payer’s storage balance.
- **is_blocklisted(account_id)** view.
- Reject List actions must emit events and be reversible only by admin; policy should be documented off-chain.

### 10.6 Configuration

- **update_quorum_bps(new_bps)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be within `[0, 10_000]`.
  - Requires attached deposit to cover any storage increase; refund excess to the payer’s storage balance.
- **update_voting_period_secs(new_period)**: Admin-only; blocked while any proposal is Pending or Active.
  - Must be > 0 and within safe bounds.
  - Requires attached deposit to cover any storage increase; refund excess to the payer’s storage balance.
- **update_verified_accounts_contract(new_contract)**: Admin-only; blocked while any proposal is Pending or Active.
  - Requires attached deposit to cover any storage increase; refund excess to the payer’s storage balance.
- **storage_deposit(account_id?, registration_only?) / storage_withdraw(amount?) / storage_unregister(force?) / storage_balance_bounds() / storage_balance_of(account_id)**: Implement NEP-145 in full to manage per-user storage balances.
  - `storage_balance_bounds.min` should reflect the minimum bytes needed for a registered voter/admin record.
  - `storage_withdraw` must not allow withdrawing below the storage used by the account.

### 10.7 Pause Controls

- **pause() / unpause()**: Admin-only.
  - Paused state blocks proposal creation, voting, and finalization.
  - Pause does not freeze proposal time: `ends_at` and pending expiry timers continue to advance while paused.
  - Admin config updates and admin/blocklist management remain allowed while paused.
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

- `proposals: UnorderedMap<u64, Proposal>`
- `votes: UnorderedMap<(u64, AccountId), VoteChoice>`
- `pending_votes: LookupSet<(u64, AccountId)>` (vote lock during async verification)
- `admins: LookupSet<AccountId>`
- `blocklist: LookupSet<AccountId>`

---

## 12. Limits and Validation

- **Title length**: <= 140 chars
- **Author length**: <= 120 chars
- **Description length**: <= 10,000 chars
- **Pagination limit**: max 100

These limits prevent storage abuse and keep gas costs predictable.

---

## 13. Events

Use NEP-297 event format (`EVENT_JSON`) with a dedicated `standard` and `version`. Events must keep payloads minimal (IDs, status, counts) to avoid the 16kb log limit; do not emit full proposal descriptions.

Event names and payloads:

- `proposal_created`: `{ proposal_id, creator, created_at, ends_at, quorum_bps }`
- `proposal_cancelled`: `{ proposal_id, cancelled_by }`
- `proposal_finalized`: `{ proposal_id, status, yes_votes, no_votes, quorum, snapshot_verified_count }`
- `vote_cast`: `{ proposal_id, voter, choice, voted_at }`
- `admin_added`: `{ account_id, added_by }`
- `admin_removed`: `{ account_id, removed_by }`
- `blocklist_added`: `{ account_id, added_by }`
- `blocklist_removed`: `{ account_id, removed_by }`
- `config_updated`: `{ quorum_bps, voting_period_secs, verified_accounts_contract, updated_by }`
- `paused`: `{ paused_by }`
- `unpaused`: `{ unpaused_by }`

---

## 14. Security Requirements

- **Access control**: Use `predecessor_account_id()` for all admin checks, not `signer_account_id()`.
- **One-yocto**: Require attached deposit >= 1 yocto on admin state changes to prevent function-call key abuse; use `assert_one_yocto()` only when no larger deposit is needed.
- **Private callbacks**: Mark callbacks `#[private]`, verify `promise_results_count`, and handle `promise_result` errors.
- **Async safety**: Treat cross-contract calls as asynchronous; only finalize proposal/vote state in callbacks.
- **Vote race protection**: Record a pending vote lock before the async call to prevent concurrent submissions; clear on failure. Lock is enforced per proposal and per account.
- **Callback refunds**: If a cross-contract call fails or a vote/proposal is not recorded, refund attached deposits to the original caller’s storage balance in the callback.
- **Callback gas safety**: Reserve gas for refund + cleanup logic; callbacks must not call external contracts.
- **Callback robustness**: Handle errors explicitly and avoid panicking in callbacks; ensure sufficient gas for refunds and cleanup. Minimum gas budgets: snapshot callback 20 Tgas, vote callback 30 Tgas.
- **Callback cleanup order**: Clear pending locks, then apply state changes, then refund storage balance if needed.
- **Reentrancy safety**: Avoid any exploitable intermediate state between call and callback.
- **Fail fast**: Validate inputs early (lengths, roles, status) and return clear errors.
- **Overflow checks**: Enable `overflow-checks = true` in `Cargo.toml`.
- **Storage staking**: Require caller-funded storage for all state changes; use NEP-145 storage management for standardized deposits/withdrawals.
- **Storage accounting**: Compute storage deltas using `env::storage_usage()` before/after state changes and charge `storage_byte_cost` per byte; refund unused balance via NEP-145.
- **NEP-145 compliance**: Implement `storage_deposit`, `storage_withdraw`, `storage_unregister`, `storage_balance_bounds`, `storage_balance_of` and use them for all storage funding.
- **Vote storage funding**: Require voters to cover incremental vote storage with attached deposit and refund any excess to the payer’s storage balance.
- **Storage DoS resilience**: Limit text sizes, enforce pagination limits, and consider storage refunds if data is removed.
- **Storage balance invariants**: Prevent storage withdrawals that would drop a user below required minimum for their stored data.
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

- `get_verified_count() -> u64`
- `get_verification(account_id: AccountId) -> Option<VerificationSummary>`
- `get_full_verification(account_id: AccountId) -> Option<Verification>`
- `is_verified(account_id: AccountId) -> bool`
- `are_verified(account_ids: Vec<AccountId>) -> Vec<bool>`
- `get_verifications(account_ids: Vec<AccountId>) -> Vec<Option<VerificationSummary>>`
- `is_paused() -> bool`

### 16.2 Types

- `VerificationSummary`
  - `nullifier: String`
  - `near_account_id: AccountId`
  - `attestation_id: String`
  - `verified_at: u64` (Unix timestamp in nanoseconds)
- `Verification` (full record with proof data; not required for governance reads)

### 16.3 Usage in Governance

- **Snapshot at creation**: Use `get_verified_count()` via async callback; snapshot can include verifications completed before the callback returns.
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
  - Contract paused
  - Config locked due to active proposals
  - Already voted / vote already pending
  - Insufficient storage deposit
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
  - Admin access control and role changes.
  - Proposal creation, cancellation, finalization.
  - Vote counting, quorum, and tie handling.
  - Vote pending lock and double-submit prevention.
  - Vote storage deposit and refund behavior.
  - Proposal/admin/blocklist storage deposit and refund behavior.
  - Config updates blocked while proposals are Active.
  - Blocklist behavior.
  - Pause/unpause behavior, including finalize blocked while paused.
- Integration tests:
- Mock Verified Accounts contract for snapshot and is_verified.
- Async callbacks and failure paths, including deposit refunds on failure.

---

## 20. Deployment and Ops

- Contract account must be funded for baseline storage; incremental storage is funded by caller deposits on state-changing actions.
- Configure Verified Accounts contract address at init.
- Admin list should include operational multisig or trusted account(s).
- Remove full-access keys from the contract account after deployment.
- Obtain an external security review/audit before production deployment.
- Maintain monitoring for gas usage, storage growth, and errors.

---

## 21. References

- NEAR security checklist: https://docs.near.org/smart-contracts/security/checklist
- NEAR best practices: https://docs.near.org/smart-contracts/anatomy/best-practices
- NEAR cross-contract callbacks: https://docs.near.org/smart-contracts/security/callbacks
- NEAR reentrancy: https://docs.near.org/smart-contracts/security/reentrancy
- NEAR frontrunning: https://docs.near.org/smart-contracts/security/frontrunning
- NEAR sybil: https://docs.near.org/smart-contracts/security/sybil
- NEAR storage staking: https://docs.near.org/protocol/storage/storage-staking
- NEP-145 storage management: https://raw.githubusercontent.com/near/NEPs/master/neps/nep-0145.md
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
