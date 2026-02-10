# Governance Contract Test Specification

Version: 1.0
Date: 2026-02-09
Scope: NEAR Citizens House Governance smart contract (Rust, near-sdk)

## References
- Product Requirements Document: `docs/prd/VOTING_PRD_UPDATED.md`
- Contract code: `contracts/governance/src/lib.rs`, `contracts/governance/src/interface.rs`
- ISTQB test case definition and test case specification definitions. citeturn0search0turn0search1
- ISTQB techniques for equivalence partitioning and boundary value analysis. citeturn1search0turn1search2
- NEAR testing guidance for unit tests and integration tests (workspaces, sandbox, time control, callback error simulation). citeturn0search2turn0search7

## Test Approach
- Test case structure follows ISTQB guidance: objective, inputs, execution preconditions, and expected results. citeturn0search0turn0search1
- Design techniques: equivalence partitioning and boundary value analysis across all constrained inputs and state transitions. citeturn1search0turn1search2
- Levels:
  - Unit tests for individual methods and state mutations (fast, deterministic, VMContext controlled). citeturn0search7
  - Integration tests for cross-contract calls, callbacks, gas, refunds, and time-based flows using NEAR Workspaces (sandbox, time travel, callback error simulation). citeturn0search2
- Coverage targets: happy path, non-happy path, boundary, negative, and edge cases for all contract states and admin operations.

## Test Environment
- Unit tests: Rust unit tests using `near-sdk` VMContextBuilder.
- Integration tests: NEAR Workspaces in local sandbox with mock verified-accounts contract.
- Deterministic time control: `block_timestamp` in unit tests; `worker.fast_forward` in integration tests. citeturn0search2turn0search7
- Compile tests with `--features testing` to enable reduced minimums for time-based configs.

### Integration Utility: Time-Based Fast Forward
NEAR Workspaces Rust exposes `worker.fast_forward(delta_height)` which advances the sandbox by **block height**, not by a direct timestamp. citeturn0search8
Sandbox fast-forward updates time-related state (block height and timestamp) as blocks advance. citeturn0search0

Because governance logic is timestamp-based (`start_at`, `ends_at`, `pending_expires_at`), tests should use a **time-based** fast-forward helper that repeatedly advances blocks and checks the latest block timestamp until a target timestamp is reached.

**Utility function (spec):**

```
async fn fast_forward_to_timestamp(worker: &Worker<Sandbox>, target_ns: u64) -> Result<()> {
    // Loop until the latest block timestamp >= target_ns
    // Use small block batches to avoid overshooting large time jumps
}
```

**Behavior:**
1. Query the latest block timestamp using the NEAR RPC `block` endpoint with `finality=final`. citeturn1search1
2. If `current_ts >= target_ns`, return.
3. Otherwise call `worker.fast_forward(batch_blocks)` with a small batch size (e.g., 10–100).
4. Repeat until `current_ts >= target_ns`.

**Notes:**
- `fast_forward` advances **blocks**; block timestamps will move forward but are not set directly. citeturn0search8turn0search0
- This utility is required for any integration test that targets precise deadlines (`ends_at`, `pending_expires_at`, grace period).

### Verified Accounts Integration Strategy
Use a **real deployment** of the verified-accounts contract in governance integration tests wherever feasible, matching the verified-accounts integration tests approach (real sandbox deployment, real transactions, real signatures). This ensures governance tests exercise genuine cross-contract behavior, JSON serialization, and NEAR receipt execution.

**Default path (real contract):**
1. Deploy verified-accounts WASM to a sandbox account.
2. Initialize with a real `backend_wallet` account.
3. Use real `store_verification` transactions to verify voter accounts.
4. Use real `get_verified_count` and `get_verification` cross-contract reads during governance flows.

**Fallback path (mock contract):**
Use a mocked verified-accounts contract only when you need to force behavior that the real contract cannot emit safely, such as deliberate callback panics, malformed JSON, or forced promise failure paths.

### Verified Accounts Utilities (for Governance Integration Tests)
Mirror the verified-accounts integration test helpers to avoid divergence:

**Deployment and init**
```
async fn init_verified_accounts(worker: &Worker<Sandbox>) -> Result<(Contract, Account)> {
    // Deploy verified-accounts WASM, create backend wallet,
    // call `new` with backend_wallet, return (contract, backend).
}
```

**Signature generation and encoding**
Reuse the same NEP-413 signing approach used in verified-accounts integration tests:
- `generate_nep413_signature(account, message, nonce, recipient) -> (signature_b64, public_key)`
- `nonce_to_base64(nonce) -> String`

These are required to produce valid `store_verification` transactions.

**Store verification helper**
```
async fn store_verification(
    backend: &Account,
    contract: &Contract,
    user: &Account,
    challenge: &str,
    nonce: [u8; 32],
    user_context_data: &str
) -> Result<()>
```
Behavior:
1. Build NEP-413 signature with `generate_nep413_signature`.
2. Call `store_verification` from `backend` with 1 yocto deposit.
3. Assert success and return.

**Verified count and lookup**
Use real view calls:
- `get_verified_count() -> u32`
- `get_verification(account_id) -> Option<VerificationSummary>`

These should be the values the governance contract sees in its snapshot and vote callbacks.

### Mock Verified Accounts Utility (only where required)
Use a minimal mock contract that implements:
- `get_verified_count() -> u32`
- `get_verification(account_id) -> Option<VerificationSummary>`

Provide helpers to:
1. Return `Err(PromiseError)` via callback simulation.
2. Return malformed JSON or panic to exercise governance callback error paths.

Document in each test case when the mock is required and why the real contract is insufficient.

## Test Data
- Accounts:
  - Admins: `admin1`, `admin2`
  - Non-admin: `user1`, `user2`, `user3`
  - Verified accounts: `v1`, `v2`, `v3`, `v4`
  - Unverified accounts: `u1`, `u2`
- Proposal fields:
  - Title lengths: 1, 140, 141
  - Author lengths: 1, 120, 121
  - Description lengths: 1, 10_000, 10_001
- Config bounds from contract constants and PRD limits.

## Preconditions (Global)
- Contract deployed and initialized with a verified-accounts contract address and at least one admin.
- Verified-accounts mock supports:
  - `get_verified_count()`
  - `get_verification(account_id)`
  - Ability to simulate errors and empty responses for callback tests.

## Unit Test Cases

### Initialization and Config Validation
UT-INIT-001: Successful initialization with valid config
Preconditions: None
Steps:
1. Call `new` with valid admin list and values within bounds.
Expected results:
1. Contract state initialized, config stored, admins set non-empty.

UT-INIT-002: Reject empty admin list
Preconditions: None
Steps:
1. Call `new` with `admins = []`.
Expected results:
1. Panics with `ERR_NO_ADMINS`.

UT-INIT-003: Quorum bps boundaries
Preconditions: None
Steps:
1. Call `new` with `quorum_bps = 1`.
2. Call `new` with `quorum_bps = 10_000`.
3. Call `new` with `quorum_bps = 0`.
4. Call `new` with `quorum_bps = 10_001`.
Expected results:
1. Steps 1-2 succeed.
2. Steps 3-4 panic with `ERR_QUORUM_BPS_OUT_OF_RANGE`.

UT-INIT-004: Voting period boundaries
Preconditions: None
Steps:
1. Call `new` with `voting_period_secs = MIN_VOTING_PERIOD_SECS`.
2. Call `new` with `voting_period_secs = MAX_VOTING_PERIOD_SECS`.
3. Call `new` with `voting_period_secs = MIN_VOTING_PERIOD_SECS - 1`.
4. Call `new` with `voting_period_secs = MAX_VOTING_PERIOD_SECS + 1`.
Expected results:
1. Steps 1-2 succeed.
2. Steps 3-4 panic with `ERR_VOTING_PERIOD_OUT_OF_RANGE`.

UT-INIT-005: Pending expiry boundaries
Preconditions: None
Steps:
1. Call `new` with `pending_expiry_secs = MIN_PENDING_EXPIRY_SECS`.
2. Call `new` with `pending_expiry_secs = MAX_PENDING_EXPIRY_SECS`.
3. Call `new` with `pending_expiry_secs` below min.
4. Call `new` with `pending_expiry_secs` above max.
Expected results:
1. Steps 1-2 succeed.
2. Steps 3-4 panic with `ERR_PENDING_EXPIRY_OUT_OF_RANGE`.

UT-INIT-006: Min proposal bond boundaries
Preconditions: None
Steps:
1. Call `new` with `min_proposal_bond = MIN_BOND` (0.01 NEAR in testing, 1 NEAR in production).
2. Call `new` with `min_proposal_bond = 100 NEAR`.
3. Call `new` with `min_proposal_bond < MIN_BOND`.
4. Call `new` with `min_proposal_bond > 100 NEAR`.
Expected results:
1. Steps 1-2 succeed.
2. Steps 3-4 panic with `ERR_MIN_BOND_OUT_OF_RANGE`.

UT-INIT-007: Finalize grace period boundaries
Preconditions: None
Steps:
1. Call `new` with `finalize_grace_period_secs = MIN_GRACE_PERIOD_SECS`.
2. Call `new` with `finalize_grace_period_secs = MAX_GRACE_PERIOD_SECS`.
3. Call `new` below min.
4. Call `new` above max.
Expected results:
1. Steps 1-2 succeed.
2. Steps 3-4 panic with `ERR_GRACE_PERIOD_OUT_OF_RANGE`.

UT-INIT-008: Max start delay boundaries
Preconditions: None
Steps:
1. Call `new` with `max_start_delay_secs = 0`.
2. Call `new` with `max_start_delay_secs = MAX_START_DELAY_SECS`.
3. Call `new` with `max_start_delay_secs > MAX_START_DELAY_SECS`.
Expected results:
1. Steps 1-2 succeed.
2. Step 3 panics with `ERR_MAX_START_DELAY_OUT_OF_RANGE`.

### Admin Management
UT-ADMIN-001: add_admin by admin with 1 yocto
Preconditions: Admin `admin1` exists
Steps:
1. Set predecessor to `admin1` with attached deposit 1 yocto.
2. Call `add_admin(admin2)`.
Expected results:
1. `admin2` added.
2. `admin_added` event emitted.

UT-ADMIN-002: add_admin by non-admin
Preconditions: `user1` is not admin
Steps:
1. Set predecessor to `user1` with attached deposit 1 yocto.
2. Call `add_admin(user2)`.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-ADMIN-003: add_admin without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call `add_admin(admin2)` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-ADMIN-004: remove_admin prevents removing last admin
Preconditions: Only `admin1` in set
Steps:
1. `admin1` calls `remove_admin(admin1)` with 1 yocto.
Expected results:
1. Panics with `ERR_CANNOT_REMOVE_LAST_ADMIN`.

UT-ADMIN-005: remove_admin non-existent
Preconditions: `admin1` admin, `admin2` not in set
Steps:
1. `admin1` calls `remove_admin(admin2)` with 1 yocto.
Expected results:
1. Panics with `ERR_ADMIN_NOT_FOUND`.

UT-ADMIN-006: is_admin and list_admins pagination
Preconditions: Admin set has `admin1`, `admin2`, `admin3`
Steps:
1. Call `is_admin(admin2)`.
2. Call `list_admins(from_index=0, limit=2)`.
3. Call `list_admins(from_index=2, limit=2)`.
4. Call `list_admins(limit=101)`.
Expected results:
1. Step 1 returns true.
2. Steps 2-3 return expected paginated results.
3. Step 4 panics with `ERR_LIMIT_TOO_LARGE`.

UT-ADMIN-007: list_admins from_index beyond length
Preconditions: Admin set has `admin1`, `admin2`
Steps:
1. Call `list_admins(from_index=10, limit=10)`.
Expected results:
1. Returns empty list.

UT-ADMIN-008: add_admin duplicate rejection
Preconditions: `admin1` exists in admin set
Steps:
1. `admin1` calls `add_admin(admin1)` with 1 yocto.
Expected results:
1. Panics with `ERR_ADMIN_ALREADY_EXISTS`.

### Proposal Creation Validation
UT-PROP-000: create_proposal non-admin
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `create_proposal` with valid fields and bond.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-PROP-001: create_proposal validates non-empty fields
Preconditions: `admin1` is admin
Steps:
1. Call `create_proposal` with empty title.
2. Call `create_proposal` with empty author.
3. Call `create_proposal` with empty description.
Expected results:
1. Panics with `ERR_TITLE_EMPTY`, `ERR_AUTHOR_EMPTY`, `ERR_DESCRIPTION_EMPTY` respectively.

UT-PROP-002: create_proposal field length boundaries
Preconditions: `admin1` is admin
Steps:
1. Call with title len 140.
2. Call with title len 141.
3. Call with author len 120.
4. Call with author len 121.
5. Call with description len 10_000.
6. Call with description len 10_001.
Expected results:
1. Steps 1,3,5 succeed.
2. Steps 2,4,6 panic with `ERR_TITLE_TOO_LONG`, `ERR_AUTHOR_TOO_LONG`, `ERR_DESCRIPTION_TOO_LONG`.

UT-PROP-003: create_proposal enforces min bond
Preconditions: `admin1` is admin, min bond set to MIN_BOND (0.01 NEAR in testing)
Steps:
1. Call `create_proposal` with attached deposit just below MIN_BOND.
2. Call `create_proposal` with attached deposit = MIN_BOND.
Expected results:
1. Step 1 panics with `ERR_INSUFFICIENT_BOND`.
2. Step 2 succeeds, proposal stored as Pending.

UT-PROP-003b: create_proposal with bond > min succeeds
Preconditions: `admin1` is admin, min bond set to MIN_BOND (0.01 NEAR in testing)
Steps:
1. Call `create_proposal` with attached deposit 2 NEAR.
Expected results:
1. Proposal stored as Pending.

UT-PROP-004: create_proposal with pending blocklist op
Preconditions: `pending_blocklist_op` set
Steps:
1. Call `create_proposal` by admin.
Expected results:
1. Panics with `ERR_BLOCKLIST_OP_PENDING`.

UT-PROP-005: start_at boundary validation
Preconditions: `admin1` is admin
Steps:
1. Set `block_timestamp = T` and call `create_proposal` with `start_at = T`.
2. Call with `start_at = T - 1`.
3. Call with `start_at = T + max_start_delay_secs * 1e9`.
4. Call with `start_at = T + max_start_delay_secs * 1e9 + 1`.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics with `ERR_START_AT_BEFORE_CREATED`.
3. Step 3 succeeds.
4. Step 4 panics with `ERR_START_AT_TOO_FAR`.

UT-PROP-006: created_at and ends_at calculation
Preconditions: `admin1` is admin, config `voting_period_secs = P`
Steps:
1. Set `block_timestamp = T`, call `create_proposal` with no start_at.
Expected results:
1. Proposal has `created_at = T`, `start_at = T`, `ends_at = T + P * 1e9`, `pending_expires_at = T + pending_expiry_secs * 1e9`.

UT-PROP-006b: deferred start ends_at computed from start_at
Preconditions: `admin1` is admin, config `voting_period_secs = P`
Steps:
1. Set `block_timestamp = T`, call `create_proposal` with `start_at = T + 1_000_000_000`.
Expected results:
1. Proposal has `start_at = T + 1e9` and `ends_at = (T + 1e9) + (P * 1e9)`.

UT-PROP-002b: UTF-8 byte length boundary
Preconditions: `admin1` is admin
Steps:
1. Call `create_proposal` with a title of exactly 140 bytes using multi-byte UTF-8 characters.
2. Call `create_proposal` with a title of 141 bytes using multi-byte UTF-8 characters.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics with `ERR_TITLE_TOO_LONG`.

### Proposal Management
UT-PROP-007: cancel_proposal only for Pending/Active
Preconditions: Create proposal and manually set status for test
Steps:
1. Set status to `Succeeded`, call `cancel_proposal`.
2. Set status to `Failed`, call `cancel_proposal`.
3. Set status to `Cancelled`, call `cancel_proposal`.
4. Set status to `Pending`, call `cancel_proposal`.
5. Set status to `Active`, call `cancel_proposal`.
Expected results:
1. Steps 1-2 panic `ERR_PROPOSAL_ALREADY_FINALIZED`.
2. Step 3 panics `ERR_PROPOSAL_ALREADY_CANCELLED`.
3. Steps 4-5 succeed, status becomes `Cancelled`, event emitted.

UT-PROP-008: expire_pending_proposal
Preconditions: Proposal Pending with `pending_expires_at = T`
Steps:
1. Set `block_timestamp = T - 1`, call `expire_pending_proposal`.
2. Set `block_timestamp = T`, call `expire_pending_proposal`.
Expected results:
1. Step 1 panics `ERR_PROPOSAL_NOT_EXPIRED`.
2. Step 2 succeeds, status `Failed`, failure_kind `PendingExpired`, event emitted.

UT-PROP-008b: expire_pending_proposal on non-Pending status
Preconditions: Proposal exists and is not Pending
Steps:
1. Set status to Active, call `expire_pending_proposal`.
2. Set status to Cancelled, call `expire_pending_proposal`.
3. Set status to Succeeded, call `expire_pending_proposal`.
4. Set status to Failed, call `expire_pending_proposal`.
Expected results:
1. Steps 1-4 panic with `ERR_PROPOSAL_NOT_PENDING`.

UT-PROP-016: cancel_proposal by non-admin
Preconditions: Proposal exists
Steps:
1. `user1` calls `cancel_proposal` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-PROP-017: expire_pending_proposal by non-admin
Preconditions: Pending proposal exists
Steps:
1. `user1` calls `expire_pending_proposal` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-PROP-018: cancel_proposal without 1 yocto
Preconditions: `admin1` is admin, proposal exists
Steps:
1. Call `cancel_proposal` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-PROP-019: expire_pending_proposal without 1 yocto
Preconditions: `admin1` is admin, pending proposal exists
Steps:
1. Call `expire_pending_proposal` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-PROP-009: finalize_proposal status preconditions
Preconditions: Proposal exists with different statuses
Steps:
1. Call finalize on Pending.
2. Call finalize on Cancelled.
3. Call finalize on Succeeded or Failed.
Expected results:
1. All steps panic with `ERR_PROPOSAL_NOT_ACTIVE`.

UT-PROP-010: finalize_proposal timing
Preconditions: Proposal Active with `ends_at = T`
Steps:
1. Set `block_timestamp = T`, call finalize.
2. Set `block_timestamp = T + 1`, call finalize.
Expected results:
1. Step 1 panics `ERR_FINALIZE_NOT_ENDED`.
2. Step 2 proceeds to quorum checks and status update.

UT-PROP-011: finalize blocked by pending votes before grace period
Preconditions: Active proposal with `pending_vote_count > 0`, `ends_at = T`, `grace = G`
Steps:
1. Set `block_timestamp = T + G - 1`, call finalize.
2. Set `block_timestamp = T + G`, call finalize.
Expected results:
1. Step 1 panics `ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES`.
2. Step 2 proceeds (pending votes treated as abandoned).

UT-PROP-012: finalize zero snapshot defensive fail
Preconditions: Active proposal with `snapshot_verified_count = 0`
Steps:
1. Call finalize after ends_at.
Expected results:
1. Status becomes `Failed` with `failure_kind = ZeroSnapshot`, event emitted.

UT-PROP-013: quorum calculation boundaries
Preconditions: Active proposal with `snapshot_verified_count = S`, `quorum_bps = Q`
Steps:
1. Compute `quorum_required = ceil(S * Q / 10_000)`.
2. Set yes/no votes totals to below, equal, and above quorum.
Expected results:
1. Below quorum -> Failed with `QuorumNotMet`.
2. At or above quorum and yes >= no -> Succeeded.
3. At or above quorum and yes < no -> Failed with `Rejected`.

UT-PROP-013b: tied votes pass when quorum met
Preconditions: Active proposal with quorum met
Steps:
1. Set `yes_votes = no_votes` and total votes >= quorum.
2. Finalize proposal.
Expected results:
1. Proposal Succeeded (ties pass).

UT-PROP-014: cancel does not clear pending votes
Preconditions: Pending votes exist for a proposal
Steps:
1. Cancel proposal.
2. Check pending_votes entries for the voters.
Expected results:
1. Pending vote entries remain unchanged.
2. pending_vote_count is unchanged by cancel.

UT-PROP-015: pending expiry distinct from voting period
Preconditions: voting_period_secs = 86_400, pending_expiry_secs = 300
Steps:
1. Create proposal with start_at = created_at.
Expected results:
1. pending_expires_at = created_at + 300 * 1e9.
2. ends_at = start_at + 86_400 * 1e9.

UT-PROP-015b: expire_pending_proposal uses pending_expires_at
Preconditions: Pending proposal with pending_expires_at = T, ends_at = T + 1 day
Steps:
1. Set block_timestamp = T - 1 and call expire_pending_proposal.
2. Set block_timestamp = T and call expire_pending_proposal.
Expected results:
1. Step 1 panics ERR_PROPOSAL_NOT_EXPIRED.
2. Step 2 succeeds (does not require ends_at).

UT-PROP-020: proposal IDs sequential
Preconditions: None
Steps:
1. Create three proposals.
Expected results:
1. IDs are 0, 1, 2.
2. get_proposal_count returns 3.

UT-PROP-021: finalize with pending_vote_count = 0
Preconditions: Active proposal ended, pending_vote_count = 0
Steps:
1. Call finalize after ends_at + 1.
Expected results:
1. Finalize succeeds without grace-period blocking.

UT-PROP-022: create_proposal start_at default None
Preconditions: `admin1` is admin
Steps:
1. Call `create_proposal` with `start_at = None`.
Expected results:
1. start_at == created_at.
2. ends_at == created_at + voting_period_secs * 1e9.

UT-ADMIN-009: clear_stale_pending_vote for non-existent proposal
Preconditions: No proposal with ID 999
Steps:
1. Admin calls `clear_stale_pending_vote(999, account_id)` with 1 yocto.
Expected results:
1. Panics with `ERR_PROPOSAL_NOT_FOUND`.

UT-ADMIN-010: clear_stale_pending_vote for non-existent pending vote
Preconditions: Proposal exists, no pending vote at (proposal_id, account_id)
Steps:
1. Admin calls `clear_stale_pending_vote(proposal_id, account_id)` with 1 yocto.
Expected results:
1. Panics with `ERR_PENDING_VOTE_NOT_FOUND`.

UT-ADMIN-010b: clear_stale_pending_vote refunds deposit
Preconditions: PendingVote exists with non-zero voter_deposit
Steps:
1. Admin calls `clear_stale_pending_vote`.
Expected results:
1. Refund transfer equals voter_deposit.
2. pending_vote_cleared event deposit_refunded matches.

UT-ADMIN-010c: clear_stale_pending_vote with zero deposit
Preconditions: PendingVote exists with voter_deposit = 0
Steps:
1. Admin calls `clear_stale_pending_vote`.
Expected results:
1. No refund transfer created.
2. pending_vote_cleared event deposit_refunded is 0.

UT-ADMIN-011: remove_admin by non-admin
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `remove_admin` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-ADMIN-012: clear_stale_pending_vote by non-admin
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `clear_stale_pending_vote` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-ADMIN-013: clear_stale_blocklist_op by non-admin
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `clear_stale_blocklist_op` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-ADMIN-014: remove_admin without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call `remove_admin` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-ADMIN-015: clear_stale_pending_vote without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call `clear_stale_pending_vote` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-ADMIN-016: clear_stale_blocklist_op without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call `clear_stale_blocklist_op` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-ADMIN-017: admin self-removal
Preconditions: Admin set has at least 2 admins
Steps:
1. `admin1` calls `remove_admin(admin1)` with 1 yocto.
Expected results:
1. `admin1` removed from set.

UT-ADMIN-018: removed admin cannot act
Preconditions: `admin1` removed
Steps:
1. `admin1` calls any admin method.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-MIG-001: migrate without 1 yocto
Preconditions: Contract initialized
Steps:
1. Admin calls `migrate` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-INIT-009: init with duplicate admins
Preconditions: None
Steps:
1. Call `new` with admins = [admin1, admin1, admin2].
Expected results:
1. list_admins returns 2 unique admins.

### Read/View Methods
UT-VIEW-001: get_proposal_count increments
Preconditions: No proposals exist
Steps:
1. Call `get_proposal_count`.
2. Create a proposal.
3. Call `get_proposal_count`.
Expected results:
1. Step 1 returns 0.
2. Step 3 returns 1.

UT-VIEW-002: get_proposal not found
Preconditions: No proposal with ID 999
Steps:
1. Call `get_proposal(999)`.
Expected results:
1. Returns None.

UT-VIEW-003: get_pending_votes_count not found
Preconditions: No proposal with ID 999
Steps:
1. Call `get_pending_votes_count(999)`.
Expected results:
1. Panics with `ERR_PROPOSAL_NOT_FOUND`.

UT-VIEW-004: get_vote and has_voted not found
Preconditions: Proposal exists, voter has not voted
Steps:
1. Call `has_voted(proposal_id, voter)`.
2. Call `get_vote(proposal_id, voter)`.
Expected results:
1. Step 1 returns false.
2. Step 2 returns None.

UT-VIEW-004b: get_vote and has_voted after successful vote
Preconditions: Proposal exists, vote recorded for voter
Steps:
1. Call `has_voted(proposal_id, voter)`.
2. Call `get_vote(proposal_id, voter)`.
Expected results:
1. Step 1 returns true.
2. Step 2 returns VoteView with correct proposal_id, voter, choice, and voted_at.

UT-VIEW-006: get_config returns all fields
Preconditions: Contract initialized with known config values
Steps:
1. Call `get_config()`.
Expected results:
1. Returned config matches initialization params.

UT-VIEW-007: is_blocklisted true/false
Preconditions: `account_a` blocklisted, `account_b` not blocklisted
Steps:
1. Call `is_blocklisted(account_a)`.
2. Call `is_blocklisted(account_b)`.
Expected results:
1. Step 1 returns true.
2. Step 2 returns false.

UT-VIEW-008: list_proposals limit > 100
Preconditions: None
Steps:
1. Call `list_proposals(0, 101)`.
Expected results:
1. Panics with `ERR_LIMIT_TOO_LARGE`.

UT-VIEW-009: list_votes limit > 100
Preconditions: Proposal exists
Steps:
1. Call `list_votes(proposal_id, 0, 101)`.
Expected results:
1. Panics with `ERR_LIMIT_TOO_LARGE`.

UT-VIEW-010: has_voted on non-existent proposal
Preconditions: No proposal with ID 999
Steps:
1. Call `has_voted(999, voter)`.
Expected results:
1. Panics with `ERR_PROPOSAL_NOT_FOUND`.

UT-VIEW-011: get_vote on non-existent proposal
Preconditions: No proposal with ID 999
Steps:
1. Call `get_vote(999, voter)`.
Expected results:
1. Panics with `ERR_PROPOSAL_NOT_FOUND`.

UT-VIEW-012: list_votes on non-existent proposal
Preconditions: No proposal with ID 999
Steps:
1. Call `list_votes(999, 0, 10)`.
Expected results:
1. Panics with `ERR_PROPOSAL_NOT_FOUND`.

UT-VIEW-013: list_proposals beyond range
Preconditions: 3 proposals exist
Steps:
1. Call `list_proposals(from_index=999, limit=10)`.
Expected results:
1. Returns empty list.

UT-VIEW-005: list_blocklist pagination and bounds
Preconditions: Blocklist has 2 accounts
Steps:
1. Call `list_blocklist(from_index=0, limit=1)`.
2. Call `list_blocklist(from_index=10, limit=10)`.
3. Call `list_blocklist(from_index=0, limit=101)`.
Expected results:
1. Step 1 returns 1 item.
2. Step 2 returns empty list.
3. Step 3 panics with `ERR_LIMIT_TOO_LARGE`.

### Voting (Synchronous Checks)
UT-VOTE-001: cast_vote rejects non-active proposal
Preconditions: Proposal Pending/Cancelled/Failed/Succeeded
Steps:
1. Call `cast_vote`.
Expected results:
1. Panics with `ERR_PROPOSAL_NOT_ACTIVE`.

UT-VOTE-002: cast_vote timing boundaries
Preconditions: Active proposal, `start_at = T1`, `ends_at = T2`
Steps:
1. `block_timestamp = T1 - 1`, cast.
2. `block_timestamp = T1`, cast.
3. `block_timestamp = T2`, cast.
4. `block_timestamp = T2 + 1`, cast.
Expected results:
1. Step 1 panics `ERR_PROPOSAL_NOT_STARTED`.
2. Steps 2-3 proceed to pending vote creation.
3. Step 4 panics `ERR_PROPOSAL_ENDED`.

UT-VOTE-003: blocklisted voter rejected
Preconditions: Active proposal, voter in blocklist
Steps:
1. Call `cast_vote` as blocklisted account.
Expected results:
1. Panics with `ERR_BLOCKLISTED`.

UT-VOTE-004: duplicate vote prevention
Preconditions: Active proposal, voter has final vote
Steps:
1. Call `cast_vote` again.
Expected results:
1. Panics with `ERR_ALREADY_VOTED`.

UT-VOTE-005: duplicate pending vote prevention
Preconditions: Active proposal, pending vote exists for voter
Steps:
1. Call `cast_vote` again.
Expected results:
1. Panics with `ERR_VOTE_ALREADY_PENDING`.

UT-VOTE-006: deposit required when available storage insufficient
Preconditions: Force `account_balance - staked_storage < storage_cost`
Steps:
1. Call `cast_vote` with deposit < `storage_cost`.
2. Call `cast_vote` with deposit >= `storage_cost`.
Expected results:
1. Step 1 panics with `ERR_INSUFFICIENT_DEPOSIT`.
2. Step 2 succeeds and records PendingVote.

UT-VOTE-007: is_vote_free boundaries
Preconditions: Control `account_balance` and `storage_usage`
Steps:
1. Set available == storage_cost, call `is_vote_free`.
2. Set available < storage_cost, call `is_vote_free`.
Expected results:
1. Step 1 returns true.
2. Step 2 returns false.

UT-VOTE-007b: is_vote_free changes after storage increases
Preconditions: Control `storage_usage` and balance
Steps:
1. Set available >= storage_cost, call `is_vote_free`.
2. Increase storage_usage so available < storage_cost, call `is_vote_free`.
Expected results:
1. Step 1 returns true.
2. Step 2 returns false.

UT-VOTE-008: same voter on two proposals
Preconditions: Two Active proposals exist
Steps:
1. Voter casts vote on proposal A.
2. Voter casts vote on proposal B.
Expected results:
1. Both pending votes are recorded independently.

### Blocklist (Synchronous)
UT-BLOCK-001: blocklist_account locked by Pending/Active proposals
Preconditions: Any proposal Pending or Active
Steps:
1. Admin calls `blocklist_account`.
Expected results:
1. Panics with `ERR_BLOCKLIST_LOCKED`.

UT-BLOCK-002: blocklist_account pending op prevention
Preconditions: `pending_blocklist_op` already set
Steps:
1. Admin calls `blocklist_account`.
Expected results:
1. Panics with `ERR_BLOCKLIST_OP_PENDING`.

UT-BLOCK-003: unblocklist_account locked by Pending/Active proposals
Preconditions: Any proposal Pending or Active
Steps:
1. Admin calls `unblocklist_account`.
Expected results:
1. Panics with `ERR_BLOCKLIST_LOCKED`.

UT-BLOCK-004: unblocklist_account non-existent
Preconditions: No blocklist entry
Steps:
1. Admin calls `unblocklist_account`.
Expected results:
1. Panics with `ERR_ACCOUNT_NOT_BLOCKLISTED`.

UT-BLOCK-006: unblocklist blocked by pending_blocklist_op
Preconditions: `pending_blocklist_op` set, no pending/active proposals
Steps:
1. Admin calls `unblocklist_account(blocklisted_account)`.
Expected results:
1. Panics with `ERR_BLOCKLIST_OP_PENDING`.

UT-BLOCK-007: clear_stale_blocklist_op success
Preconditions: `pending_blocklist_op` set
Steps:
1. Admin calls `clear_stale_blocklist_op()` with 1 yocto.
Expected results:
1. Pending op cleared.
2. `pending_blocklist_op_cleared` event emitted.

UT-BLOCK-008: clear_stale_blocklist_op with no pending op
Preconditions: `pending_blocklist_op` is None
Steps:
1. Admin calls `clear_stale_blocklist_op()` with 1 yocto.
Expected results:
1. Panics with `ERR_BLOCKLIST_OP_NOT_PENDING`.

UT-BLOCK-009: blocklist_account by non-admin
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `blocklist_account(v1)` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-BLOCK-010: unblocklist_account by non-admin
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `unblocklist_account(v1)` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

UT-BLOCK-011: blocklist_account without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call `blocklist_account(v1)` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-BLOCK-012: unblocklist_account without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call `unblocklist_account(v1)` without 1 yocto.
Expected results:
1. Panics with SDK assert-one-yocto error.

UT-BLOCK-005: is_blocklist_locked
Preconditions: None
Steps:
1. No pending/active and no pending_blocklist_op -> call `is_blocklist_locked`.
2. Pending or active proposal -> call `is_blocklist_locked`.
3. pending_blocklist_op set -> call `is_blocklist_locked`.
Expected results:
1. Returns false.
2. Returns true.
3. Returns true.

### Config Updates
UT-CONFIG-001: update_quorum_bps boundaries
Preconditions: Admin caller with 1 yocto
Steps:
1. Call with min, max.
2. Call below min, above max.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics `ERR_QUORUM_BPS_OUT_OF_RANGE`.

UT-CONFIG-002: update_voting_period_secs locked by pending/active
Preconditions: Pending or Active proposal exists
Steps:
1. Admin calls `update_voting_period_secs`.
Expected results:
1. Panics `ERR_CONFIG_LOCKED`.

UT-CONFIG-002b: update_voting_period_secs boundaries
Preconditions: No pending/active proposals
Steps:
1. Call with min and max.
2. Call below min and above max.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics `ERR_VOTING_PERIOD_OUT_OF_RANGE`.

UT-CONFIG-003: update_verified_accounts_contract locked by pending/active
Preconditions: Pending or Active proposal exists
Steps:
1. Admin calls `update_verified_accounts_contract`.
Expected results:
1. Panics `ERR_CONFIG_LOCKED`.

UT-CONFIG-003b: update_verified_accounts_contract allowed when idle
Preconditions: No pending/active proposals
Steps:
1. Admin calls `update_verified_accounts_contract(new_contract)`.
Expected results:
1. Config updated, `config_updated` event emitted.

UT-CONFIG-004: update_pending_expiry_secs boundaries
Preconditions: Admin caller
Steps:
1. Call with min, max.
2. Call below min, above max.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics `ERR_PENDING_EXPIRY_OUT_OF_RANGE`.

UT-CONFIG-005: update_min_proposal_bond boundaries
Preconditions: Admin caller
Steps:
1. Call with MIN_BOND (0.01 NEAR in testing) and 100 NEAR.
2. Call below MIN_BOND and above max.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics `ERR_MIN_BOND_OUT_OF_RANGE`.

UT-CONFIG-006: update_finalize_grace_period_secs boundaries
Preconditions: Admin caller
Steps:
1. Call with min and max.
2. Call below min and above max.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics `ERR_GRACE_PERIOD_OUT_OF_RANGE`.

UT-CONFIG-007: update_max_start_delay_secs boundaries
Preconditions: Admin caller
Steps:
1. Call with 0 and max.
2. Call above max.
Expected results:
1. Step 1 succeeds.
2. Step 2 panics `ERR_MAX_START_DELAY_OUT_OF_RANGE`.

UT-CONFIG-008: update_quorum_bps while Active
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_quorum_bps`.
Expected results:
1. Succeeds.

UT-CONFIG-009: update_pending_expiry_secs while Active
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_pending_expiry_secs`.
Expected results:
1. Succeeds.

UT-CONFIG-010: update_min_proposal_bond while Active
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_min_proposal_bond`.
Expected results:
1. Succeeds.

UT-CONFIG-011: update_finalize_grace_period_secs while Active
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_finalize_grace_period_secs`.
Expected results:
1. Succeeds.

UT-CONFIG-012: update_max_start_delay_secs while Active
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_max_start_delay_secs`.
Expected results:
1. Succeeds.

UT-CONFIG-013: config updates by non-admin
Preconditions: `user1` is not admin
Steps:
1. Call each update method as `user1` with 1 yocto.
Expected results:
1. Each panics with `ERR_NOT_ADMIN`.

UT-CONFIG-014: config updates without 1 yocto
Preconditions: `admin1` is admin
Steps:
1. Call each update method without 1 yocto.
Expected results:
1. Each panics with SDK assert-one-yocto error.

### JSON Serialization (Views)
UT-JSON-001: get_proposal timestamps are U64 strings
Preconditions: Proposal exists with nanosecond timestamps > 2^53
Steps:
1. Call `get_proposal` and inspect JSON.
Expected results:
1. created_at, start_at, ends_at, pending_expires_at are JSON strings.

UT-JSON-002: get_vote/list_votes voted_at is U64 string
Preconditions: Vote recorded
Steps:
1. Call `get_vote` and `list_votes`.
Expected results:
1. voted_at is JSON string in both outputs.

UT-JSON-003: get_config NearToken and numeric fields
Preconditions: Contract initialized
Steps:
1. Call `get_config` and inspect JSON.
Expected results:
1. min_proposal_bond is JSON string (NearToken).
2. quorum_bps and duration fields are JSON numbers.

UT-JSON-004: list_proposals U64 fields
Preconditions: Multiple proposals exist
Steps:
1. Call `list_proposals`.
Expected results:
1. All U64 timestamp fields are JSON strings.

### Event Payload Types
UT-EVENT-001: proposal_created payload types
Preconditions: Create proposal
Steps:
1. Parse emitted EVENT_JSON.
Expected results:
1. Timestamp fields are JSON strings; quorum_bps is number.

UT-EVENT-002: proposal_activated payload types
Preconditions: Snapshot success
Steps:
1. Parse proposal_activated event.
Expected results:
1. snapshot_verified_count and quorum_required are numbers.

UT-EVENT-003: proposal_finalized payload types
Preconditions: Finalize proposal
Steps:
1. Parse proposal_finalized event.
Expected results:
1. yes_votes, no_votes, quorum, snapshot_verified_count are numbers.

UT-EVENT-004: vote_cast payload types
Preconditions: Vote cast
Steps:
1. Parse vote_cast event.
Expected results:
1. voted_at is JSON string; choice is snake_case.

UT-EVENT-005: vote_rejected payload types
Preconditions: Rejected vote
Steps:
1. Parse vote_rejected event.
Expected results:
1. reason is snake_case string.

UT-EVENT-006: config_updated payload types
Preconditions: Update config
Steps:
1. Parse config_updated event.
Expected results:
1. min_proposal_bond is JSON string; durations are numbers; updated_by present.

UT-EVENT-007: pending_vote_cleared payload types
Preconditions: Clear pending vote
Steps:
1. Parse pending_vote_cleared event.
Expected results:
1. deposit_refunded is JSON string.

UT-EVENT-008: proposal_cancelled payload types
Preconditions: Cancel proposal
Steps:
1. Parse proposal_cancelled event.
Expected results:
1. cancelled_by present.

UT-EVENT-009: admin_added/admin_removed payload types
Preconditions: Add/remove admin
Steps:
1. Parse events.
Expected results:
1. added_by / removed_by present.

UT-EVENT-010: blocklist_added/blocklist_removed payload types
Preconditions: Add/remove blocklist
Steps:
1. Parse events.
Expected results:
1. added_by / removed_by present.

UT-EVENT-011: pending_proposal_expired payload types
Preconditions: Expire pending proposal
Steps:
1. Parse pending_proposal_expired event.
Expected results:
1. expired_by present.

UT-EVENT-012: pending_blocklist_op_cleared payload types
Preconditions: Clear stale blocklist op
Steps:
1. Parse pending_blocklist_op_cleared event.
Expected results:
1. account_id and cleared_by present.

UT-EVENT-013: proposal_creation_failed payload types
Preconditions: Snapshot callback failure
Steps:
1. Parse proposal_creation_failed event.
Expected results:
1. reason is snake_case string.

### Snapshot Callback (Unit)
UT-SNAP-001: on_snapshot ignores non-pending proposals
Preconditions: Proposal status not Pending
Steps:
1. Call `on_snapshot`.
Expected results:
1. Returns false, no state changes.

UT-SNAP-001b: on_snapshot after proposal cancelled
Preconditions: Proposal status Cancelled
Steps:
1. Call `on_snapshot`.
Expected results:
1. Returns false, no state changes.

UT-SNAP-001c: on_snapshot with missing proposal
Preconditions: Proposal was removed or never existed
Steps:
1. Call `on_snapshot`.
Expected results:
1. Returns false.

UT-SNAP-002: on_snapshot invalid promise results count
Preconditions: Pending proposal
Steps:
1. Set `promise_results_count != 1`, call `on_snapshot`.
Expected results:
1. Proposal status becomes Failed, failure_kind `SnapshotCallbackFailed`.
2. `proposal_creation_failed` event emitted.

UT-SNAP-003: on_snapshot callback error
Preconditions: Pending proposal
Steps:
1. Call `on_snapshot` with `Err(PromiseError)`.
Expected results:
1. Proposal status Failed, failure_kind `SnapshotCallbackFailed`.
2. `proposal_creation_failed` event emitted.

UT-SNAP-004: on_snapshot zero effective count
Preconditions: Pending proposal, blocklist size >= verified_count
Steps:
1. Call `on_snapshot` with verified_count = 0.
2. Call with verified_count = N, blocklist size = N.
Expected results:
1. Proposal status Failed, failure_kind `ZeroSnapshot`.
2. `proposal_creation_failed` event emitted.

UT-SNAP-005: on_snapshot success activates proposal
Preconditions: Pending proposal
Steps:
1. Call `on_snapshot` with verified_count > blocklist size.
Expected results:
1. Proposal status Active, snapshot_verified_count set to effective count.
2. `proposal_activated` event emitted.

### Vote Callback (Unit)
UT-VOTE-CB-001: missing PendingVote lock
Preconditions: No pending vote record
Steps:
1. Call `on_vote_verification`.
Expected results:
1. Returns false, logs `ERR_PENDING_VOTE_NOT_FOUND_IN_CALLBACK`.

UT-VOTE-CB-001b: proposal missing after pending vote removal
Preconditions: PendingVote exists, proposal removed
Steps:
1. Call `on_vote_verification` with any result.
Expected results:
1. PendingVote removed.
2. Full deposit refunded.
3. Returns false.

UT-VOTE-CB-002: invalid promise results count
Preconditions: PendingVote exists
Steps:
1. Set `promise_results_count != 1`, call callback.
Expected results:
1. PendingVote removed, pending_vote_count decremented.
2. `vote_rejected` emitted with `CallbackFailed`.
3. Deposit refunded if present.

UT-VOTE-CB-003: proposal cancelled or finalized
Preconditions: PendingVote exists
Steps:
1. Set proposal status Cancelled.
2. Set proposal status Succeeded.
3. Set proposal status Failed.
Expected results:
1. `vote_rejected` with `ProposalCancelled`.
2. `vote_rejected` with `PostFinalize`.
3. `vote_rejected` with `PostFinalize`.
4. PendingVote removed, deposit refunded.

UT-VOTE-CB-003b: proposal status Pending in callback
Preconditions: PendingVote exists, proposal status Pending
Steps:
1. Call `on_vote_verification`.
Expected results:
1. PendingVote removed, deposit refunded.
2. Returns false, no event emitted.

UT-VOTE-CB-004: callback error / not verified
Preconditions: PendingVote exists, Active proposal
Steps:
1. Return `Err(PromiseError)`.
2. Return `Ok(None)`.
Expected results:
1. `vote_rejected` with `CallbackFailed` and refund.
2. `vote_rejected` with `NotVerified` and refund.

UT-VOTE-CB-005: verified after creation
Preconditions: PendingVote exists, Active proposal
Steps:
1. Return VerificationSummary with `verified_at > proposal.created_at`.
Expected results:
1. `vote_rejected` with `VerifiedAfterCreation` and refund.

UT-VOTE-CB-006: submitted_at outside voting window
Preconditions: PendingVote exists, Active proposal
Steps:
1. Set submitted_at < start_at.
2. Set submitted_at > ends_at.
Expected results:
1. `vote_rejected` with `ProposalExpired` and refund.

UT-VOTE-CB-007: success path records vote and refunds excess
Preconditions: PendingVote exists, Active proposal, verified_at <= created_at
Steps:
1. Call callback with valid verification.
Expected results:
1. PendingVote removed, pending_vote_count decremented.
2. Vote recorded with `voted_at = submitted_at`.
3. yes/no tallies updated.
4. Refund of excess deposit computed from storage delta.
5. `vote_cast` event emitted.

UT-VOTE-CB-007b: voted_at equals submitted_at
Preconditions: PendingVote exists, Active proposal
Steps:
1. Set callback block_timestamp != submitted_at.
2. Call callback with valid verification.
Expected results:
1. get_vote returns voted_at == submitted_at.

UT-VOTE-CB-007c: VoteChoice::No success path
Preconditions: PendingVote exists with choice No
Steps:
1. Call callback with valid verification.
Expected results:
1. no_votes increments, yes_votes unchanged.
2. vote_cast choice is "no".

UT-VOTE-CB-008: vote count overflow handling
Preconditions: PendingVote exists, Active proposal with `yes_votes` or `no_votes` at u64::MAX
Steps:
1. Call callback with valid verification.
Expected results:
1. Logs `ERR_VOTE_COUNT_OVERFLOW`.
2. PendingVote removed, deposit refunded.
3. Returns false, no vote recorded.

### Blocklist Callback (Unit)
UT-BLOCK-CB-001: pending op missing
Preconditions: `pending_blocklist_op` is None
Steps:
1. Call `on_blocklist_verification`.
Expected results:
1. Returns false, no state changes.

UT-BLOCK-CB-002: invalid promise results count
Preconditions: `pending_blocklist_op` set
Steps:
1. Set `promise_results_count != 1`, call callback.
Expected results:
1. pending op cleared, blocklist unchanged.

UT-BLOCK-CB-003: verification error or None
Preconditions: `pending_blocklist_op` set
Steps:
1. Return `Err(PromiseError)`.
2. Return `Ok(None)`.
Expected results:
1. pending op cleared, blocklist unchanged.

UT-BLOCK-CB-004: success adds to blocklist
Preconditions: `pending_blocklist_op` set
Steps:
1. Return `Ok(Some(VerificationSummary))`.
Expected results:
1. pending op cleared.
2. account added to blocklist, `blocklist_added` event emitted.

UT-BLOCK-CB-005: success when already blocklisted
Preconditions: `pending_blocklist_op` set, account already in blocklist
Steps:
1. Return `Ok(Some(VerificationSummary))`.
Expected results:
1. pending op cleared.
2. blocklist unchanged, no `blocklist_added` event.

## Integration Test Cases (NEAR Workspaces)

### End-to-End Happy Paths
IT-E2E-001: Full happy path, yes wins
Preconditions: Verified accounts `v1..v4` with verified_at <= created_at
Steps:
1. Deploy verified-accounts mock with 4 verified accounts.
2. Deploy governance, init with `admin1`.
3. `admin1` creates proposal with bond >= min.
4. Snapshot callback succeeds, proposal Active.
5. `v1`, `v2`, `v3` cast Yes; `v4` casts No.
6. Fast-forward time to `ends_at + 1`.
7. Call finalize.
Expected results:
1. Proposal transitions Pending -> Active -> Succeeded.
2. Yes/No tallies match votes, quorum satisfied.
3. Events emitted: proposal_created, proposal_activated, vote_cast x4, proposal_finalized.

IT-E2E-002: Full happy path, no wins
Preconditions: Verified accounts `v1..v4`
Steps:
1. Create proposal and activate.
2. Cast 1 Yes and 3 No.
3. Fast-forward to after ends_at and finalize.
Expected results:
1. Proposal finalizes Failed with `Rejected`.

IT-E2E-003: Quorum not met
Preconditions: Snapshot verified count large enough, quorum > votes
Steps:
1. Create and activate proposal.
2. Cast fewer total votes than quorum.
3. Finalize after ends_at.
Expected results:
1. Proposal finalizes Failed with `QuorumNotMet`.

IT-E2E-004: Start delay happy path
Preconditions: Start_at > created_at within max delay
Steps:
1. Create proposal with start_at in future.
2. Attempt vote before start_at.
3. Fast-forward to start_at and vote.
Expected results:
1. Vote before start_at rejected with `ERR_PROPOSAL_NOT_STARTED`.
2. Vote at/after start_at accepted.

IT-E2E-005: Non-admin cannot create proposal
Preconditions: `user1` is not admin
Steps:
1. `user1` calls `create_proposal` with valid fields and bond.
Expected results:
1. Reverts with `ERR_NOT_ADMIN`.

IT-E2E-006: Non-admin can finalize
Preconditions: Active proposal exists, voting ended
Steps:
1. Non-admin calls `finalize_proposal`.
Expected results:
1. Finalize succeeds (subject to quorum rules).

IT-E2E-007: Cancel after ends_at but before finalize
Preconditions: Active proposal exists, voting ended, not finalized
Steps:
1. Admin calls `cancel_proposal` after `ends_at`.
Expected results:
1. Proposal status becomes `Cancelled`.

IT-E2E-008: Concurrent proposals independent
Preconditions: Two proposals Active at same time
Steps:
1. Cast votes on proposal A and B from different voters.
2. Finalize each proposal after its ends_at.
Expected results:
1. Tallies and status are independent per proposal.

IT-E2E-009: verified_at == created_at boundary
Preconditions: Account verified at exact created_at timestamp
Steps:
1. Create proposal, verify account at created_at, cast vote.
Expected results:
1. Vote accepted (verified_at <= created_at).

IT-E2E-010: Lifecycle continuity after cancel
Preconditions: None
Steps:
1. Create proposal, cancel it.
2. Create another proposal.
Expected results:
1. Second proposal has next ID and functions normally.

IT-E2E-011: Deferred start end-to-end
Preconditions: start_at = created_at + 1 hour
Steps:
1. Vote before start_at (rejected).
2. Fast-forward to start_at and vote (accepted).
3. Fast-forward to ends_at + 1 and finalize.
Expected results:
1. Behavior matches start_at/ends_at window.

IT-E2E-012: Concurrent votes on same proposal
Preconditions: Active proposal exists
Steps:
1. Multiple voters cast votes before callbacks resolve.
2. Allow callbacks to resolve.
Expected results:
1. All pending votes coexist and final tallies are correct.

### Snapshot and Pending Proposal Flows
IT-SNAP-001: Snapshot callback failure
Preconditions: Verified-accounts mock configured to fail `get_verified_count`
Steps:
1. Create proposal.
2. Let callback return error.
Expected results:
1. Proposal status Failed with `SnapshotCallbackFailed`.
2. `proposal_creation_failed` event emitted.

IT-SNAP-002: Zero snapshot rejection
Preconditions: Verified-accounts mock returns 0 or blocklist equals verified count
Steps:
1. Create proposal.
2. Snapshot returns 0 or effective count 0.
Expected results:
1. Proposal status Failed with `ZeroSnapshot`.
2. `proposal_creation_failed` emitted.

IT-PENDING-001: Pending expiry
Preconditions: Pending proposal with `pending_expires_at`
Steps:
1. Create proposal.
2. Fast-forward to `pending_expires_at`.
3. Admin calls `expire_pending_proposal`.
Expected results:
1. Proposal status Failed with `PendingExpired`.
2. `pending_proposal_expired` event emitted.

### Voting Callback Timing and Async Behavior
IT-VOTE-ASYNC-001: Submitted before end, callback after end
Preconditions: Active proposal
Steps:
1. Cast vote just before `ends_at`.
2. Delay callback execution until after `ends_at`.
Expected results:
1. Vote accepted since submitted_at within window.
2. Tallies reflect vote.

IT-VOTE-ASYNC-002: Callback executes after finalize
Preconditions: Active proposal with pending votes
Steps:
1. Cast vote, leave pending.
2. Fast-forward beyond grace period and finalize.
3. Allow callback to execute after finalization.
Expected results:
1. Vote rejected with `PostFinalize`.
2. PendingVote removed and deposit refunded.

IT-VOTE-ASYNC-003: Callback error leaves no pending lock
Preconditions: Active proposal
Steps:
1. Cast vote with mock configured to fail `get_verification`.
2. Observe callback failure.
Expected results:
1. `vote_rejected` with `CallbackFailed`.
2. PendingVote removed, deposit refunded.

IT-VOTE-ASYNC-004: Stuck pending vote cleared by admin
Preconditions: PendingVote exists but callback never completes
Steps:
1. Cast vote; simulate callback failure due to insufficient gas so callback receipt fails.
2. Admin calls `clear_stale_pending_vote`.
Expected results:
1. PendingVote removed, pending_vote_count decremented.
2. Deposit refunded to voter.
3. `pending_vote_cleared` event emitted.

IT-VOTE-ASYNC-005: clear_stale_pending_vote unblocks finalize
Preconditions: PendingVote exists and finalize is blocked
Steps:
1. Attempt finalize before grace period (blocked).
2. Admin clears stale pending vote.
3. Finalize proposal.
Expected results:
1. Finalize succeeds after pending vote cleared.

### Finalize Grace Period and Blocking
IT-FINAL-001: Finalize blocked by pending votes before grace
Preconditions: Active proposal with pending_vote_count > 0
Steps:
1. Fast-forward to just after `ends_at` but before grace deadline.
2. Call finalize.
Expected results:
1. Reverts with `ERR_FINALIZE_BLOCKED_BY_PENDING_VOTES`.

IT-FINAL-002: Finalize after grace proceeds despite pending votes
Preconditions: Active proposal with pending_vote_count > 0
Steps:
1. Fast-forward to `ends_at + grace`.
2. Call finalize.
Expected results:
1. Finalize succeeds, pending votes treated as abandoned.

### Blocklist End-to-End
IT-BLOCK-001: Add blocklist verified account
Preconditions: No pending/active proposals
Steps:
1. Admin calls `blocklist_account(v1)`.
2. Mock returns verification for v1.
Expected results:
1. v1 added to blocklist, event emitted.

IT-BLOCK-002: Add blocklist unverified account
Preconditions: No pending/active proposals
Steps:
1. Admin calls `blocklist_account(u1)`.
2. Mock returns None.
Expected results:
1. Blocklist not changed, pending op cleared.

IT-BLOCK-003: Blocklist lock during active proposal
Preconditions: Active proposal exists
Steps:
1. Admin calls `blocklist_account(v1)`.
Expected results:
1. Reverts with `ERR_BLOCKLIST_LOCKED`.

IT-BLOCK-004: Unblocklist happy path
Preconditions: v1 blocklisted, no pending/active proposals
Steps:
1. Admin calls `unblocklist_account(v1)`.
Expected results:
1. v1 removed, `blocklist_removed` event emitted.

IT-BLOCK-005: Pending blocklist op prevents another blocklist op
Preconditions: No pending/active proposals
Steps:
1. Admin calls `blocklist_account(v1)`, do not resolve callback yet.
2. Admin calls `blocklist_account(v2)`.
Expected results:
1. Step 2 reverts with `ERR_BLOCKLIST_OP_PENDING`.

IT-BLOCK-006: Pending blocklist op prevents unblocklist
Preconditions: No pending/active proposals, v1 blocklisted
Steps:
1. Admin calls `blocklist_account(v2)`, do not resolve callback yet.
2. Admin calls `unblocklist_account(v1)`.
Expected results:
1. Step 2 reverts with `ERR_BLOCKLIST_OP_PENDING`.

IT-BLOCK-007: Clear stale blocklist op
Preconditions: Pending blocklist op exists
Steps:
1. Admin calls `clear_stale_blocklist_op()` with 1 yocto.
Expected results:
1. Pending op cleared.
2. `pending_blocklist_op_cleared` event emitted.

IT-BLOCK-008: Blocklist subtraction in snapshot
Preconditions: 10 verified accounts, 2 blocklisted
Steps:
1. Create proposal and let snapshot callback succeed.
Expected results:
1. snapshot_verified_count = 8.

IT-BLOCK-009: is_blocklist_locked lifecycle
Preconditions: None
Steps:
1. Check is_blocklist_locked() when idle.
2. Create proposal (Pending/Active).
3. Finalize proposal.
4. Start blocklist_account and leave op pending.
5. Resolve blocklist callback.
Expected results:
1. Returns false when idle.
2. Returns true during Pending/Active.
3. Returns false after finalize.
4. Returns true while pending op.
5. Returns false after callback.

### Config Update Flows
IT-CONFIG-001: Update quorum while active proposals exist
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_quorum_bps`.
Expected results:
1. Succeeds and emits `config_updated`.

IT-CONFIG-002: Update voting period locked during active
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_voting_period_secs`.
Expected results:
1. Reverts with `ERR_CONFIG_LOCKED`.

IT-CONFIG-003: Update verified_accounts_contract when idle
Preconditions: No pending/active proposals
Steps:
1. Admin calls `update_verified_accounts_contract(new_contract)`.
2. Create proposal and verify snapshot uses new contract (by mocking different verified count).
Expected results:
1. `config_updated` event emitted.
2. Snapshot reflects new contract result.

IT-CONFIG-004: Quorum snapshots per-proposal
Preconditions: No pending/active proposals
Steps:
1. Set quorum_bps to 700, create proposal A.
2. Update quorum_bps to 5000, create proposal B.
Expected results:
1. Proposal A has quorum_bps = 700.
2. Proposal B has quorum_bps = 5000.

IT-CONFIG-005: Grace period config affects existing proposals
Preconditions: Active proposal ended with pending votes
Steps:
1. Update finalize_grace_period_secs to a shorter value after ends_at.
2. Attempt finalize at new grace deadline.
Expected results:
1. Finalize respects the updated grace period value.

IT-CONFIG-006: update_pending_expiry_secs during active proposal
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_pending_expiry_secs`.
Expected results:
1. Succeeds.

IT-CONFIG-007: update_min_proposal_bond during active proposal
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_min_proposal_bond`.
Expected results:
1. Succeeds.

IT-CONFIG-008: update_finalize_grace_period_secs during active proposal
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_finalize_grace_period_secs`.
Expected results:
1. Succeeds.

IT-CONFIG-009: update_max_start_delay_secs during active proposal
Preconditions: Active proposal exists
Steps:
1. Admin calls `update_max_start_delay_secs`.
Expected results:
1. Succeeds.

### Pagination and Views
IT-VIEW-001: list_proposals pagination over multiple
Preconditions: Create 3 proposals
Steps:
1. Call `list_proposals(0, 2)` then `list_proposals(2, 2)`.
Expected results:
1. Returns proposals 0-1 then proposal 2.

IT-VIEW-002: list_votes pagination
Preconditions: Active proposal with 3 votes
Steps:
1. Call `list_votes(0,2)` then `list_votes(2,2)`.
Expected results:
1. Returns 2 then 1 vote with correct data.

IT-VIEW-003: list_admins and list_blocklist out-of-range
Preconditions: Admins and blocklist have 2 entries each
Steps:
1. Call `list_admins(from_index=10, limit=10)`.
2. Call `list_blocklist(from_index=10, limit=10)`.
Expected results:
1. Both return empty lists.

### Storage Deposit and Refunds
IT-STORE-001: Free vote when contract has balance
Preconditions: Contract funded, available >= storage_cost
Steps:
1. Cast vote with 0 deposit.
Expected results:
1. Vote accepted and no refund transfer.

IT-STORE-001b: Deposit attached when free results in partial refund
Preconditions: Contract funded, available >= storage_cost
Steps:
1. Cast vote with deposit > 0.
2. Let callback succeed.
Expected results:
1. Vote recorded.
2. Refund equals `deposit - actual_storage_cost`.

IT-STORE-002: Deposit required and excess refunded
Preconditions: Contract underfunded, available < storage_cost
Steps:
1. Cast vote with deposit >= storage_cost.
2. Let callback succeed.
Expected results:
1. Vote recorded.
2. Refund equals `deposit - actual_storage_cost`.

IT-STORE-003: Deposit refunded on rejection
Preconditions: Underfunded, deposit provided, verification fails
Steps:
1. Cast vote from unverified account.
2. Let callback reject.
Expected results:
1. Deposit fully refunded.

IT-STORE-004: Refund calculation accuracy
Preconditions: Underfunded, deposit provided
Steps:
1. Capture storage usage before vote callback.
2. Cast vote and let callback succeed.
3. Capture storage usage after callback.
Expected results:
1. Refund equals `deposit - (storage_after - storage_before) * storage_byte_cost`.
Notes:
1. This test is optional if storage deltas are unstable across SDK versions.

IT-BOND-001: Bond retained after Succeeded proposal
Preconditions: Proposal created with bond
Steps:
1. Create and finalize proposal as Succeeded.
Expected results:
1. Contract balance retains bond (no refund transfer).

IT-BOND-002: Bond retained after QuorumNotMet failure
Preconditions: Proposal created with bond
Steps:
1. Finalize with quorum not met.
Expected results:
1. Contract balance retains bond.

IT-BOND-003: Bond retained after Cancelled proposal
Preconditions: Proposal created with bond
Steps:
1. Cancel proposal.
Expected results:
1. Contract balance retains bond.

IT-BOND-004: Bond retained after PendingExpired proposal
Preconditions: Pending proposal created with bond
Steps:
1. Expire pending proposal.
Expected results:
1. Contract balance retains bond.

IT-BOND-005: Bond retained after SnapshotCallbackFailed
Preconditions: Snapshot callback fails
Steps:
1. Create proposal and force snapshot callback failure.
Expected results:
1. Contract balance retains bond.

IT-BOND-006: Bond exceeds minimum
Preconditions: min bond = MIN_BOND (0.01 NEAR in testing)
Steps:
1. Create proposal with bond = 5 NEAR.
Expected results:
1. Proposal created successfully.
2. Full 5 NEAR retained by contract.

IT-PROP-ID-001: Proposal IDs are sequential
Preconditions: None
Steps:
1. Create first proposal.
2. Create second proposal.
Expected results:
1. First call returns 0, second returns 1.

### Events and Log Integrity
IT-EVENT-001: All mutating actions emit correct events
Preconditions: Standard flow
Steps:
1. Add/remove admin, create/cancel proposal, cast vote, finalize, blocklist, clear pending vote, clear stale blocklist op.
Expected results:
1. Each action emits corresponding event with correct fields.

### Security and Access Control
IT-SEC-001: All admin functions require 1 yocto
Preconditions: Admin caller
Steps:
1. Call each admin-mutating method without 1 yocto.
Expected results:
1. Each panics with SDK assert-one-yocto error.

IT-SEC-002: Non-admin cannot call admin methods
Preconditions: Non-admin caller
Steps:
1. Attempt all admin-only methods.
Expected results:
1. Each panics with `ERR_NOT_ADMIN`.

IT-SEC-003: External call to on_snapshot rejected
Preconditions: Contract deployed
Steps:
1. Non-contract account calls `on_snapshot`.
Expected results:
1. Call fails due to private method restriction.

IT-SEC-004: External call to on_vote_verification rejected
Preconditions: Contract deployed
Steps:
1. Non-contract account calls `on_vote_verification`.
Expected results:
1. Call fails due to private method restriction.

IT-SEC-005: External call to on_blocklist_verification rejected
Preconditions: Contract deployed
Steps:
1. Non-contract account calls `on_blocklist_verification`.
Expected results:
1. Call fails due to private method restriction.

IT-INIT-001: Double initialization rejected
Preconditions: Contract initialized
Steps:
1. Call `new()` again.
Expected results:
1. Fails due to init guard.

IT-REFUND-001: Full refund on CallbackFailed
Preconditions: Underfunded, deposit provided, callback failure
Steps:
1. Cast vote and force verification callback failure.
Expected results:
1. Full deposit refunded.

IT-REFUND-002: Full refund on NotVerified
Preconditions: Underfunded, deposit provided
Steps:
1. Cast vote from unverified account.
Expected results:
1. Full deposit refunded.

IT-REFUND-003: Full refund on VerifiedAfterCreation
Preconditions: Account verified after proposal creation
Steps:
1. Create proposal, verify account after creation, cast vote.
Expected results:
1. Full deposit refunded, vote rejected.

IT-REFUND-004: Full refund on ProposalCancelled
Preconditions: Pending vote exists, proposal cancelled before callback
Steps:
1. Cast vote, cancel proposal, allow callback.
Expected results:
1. Full deposit refunded.

IT-REFUND-005: Full refund on PostFinalize
Preconditions: Pending vote exists, proposal finalized before callback
Steps:
1. Cast vote, finalize, allow callback.
Expected results:
1. Full deposit refunded, vote rejected PostFinalize.

IT-REFUND-006: Full refund on ProposalExpired
Preconditions: Vote submitted outside window (submitted_at < start_at or > ends_at)
Steps:
1. Force callback with submitted_at outside window.
Expected results:
1. Full deposit refunded.

IT-REFUND-007: Partial refund on success
Preconditions: Underfunded, deposit provided
Steps:
1. Cast vote and allow success.
Expected results:
1. Refund equals deposit minus actual storage cost.

IT-REFUND-008: Zero refund when deposit equals storage cost
Preconditions: Underfunded, deposit equals estimated cost
Steps:
1. Cast vote and allow success.
Expected results:
1. Refund is zero, no transfer created.

IT-REFUND-009: No transfer when voting is free
Preconditions: Sufficient contract balance, deposit 0
Steps:
1. Cast vote and allow success.
Expected results:
1. No refund transfer created.

### Migrate
IT-MIG-001: migrate requires admin and 1 yocto
Preconditions: Contract state exists
Steps:
1. Non-admin calls `migrate` with 1 yocto.
2. Admin calls `migrate` without 1 yocto.
3. Admin calls `migrate` with 1 yocto.
Expected results:
1. Step 1 panics `ERR_NOT_ADMIN`.
2. Step 2 panics assert-one-yocto.
3. Step 3 succeeds and preserves state.

IT-MIG-002: migrate preserves all state
Preconditions: Contract with admins, proposals, votes, blocklist, pending votes
Steps:
1. Call `migrate` as admin with 1 yocto.
Expected results:
1. All state remains unchanged.

IT-MIG-003: migrate non-admin with 1 yocto
Preconditions: Contract initialized
Steps:
1. Non-admin calls `migrate` with 1 yocto.
Expected results:
1. Panics with `ERR_NOT_ADMIN`.

## Traceability Matrix (High-Level)
- Requirements on proposal lifecycle, voting, callbacks, blocklist, and config are covered by UT-PROP-*, UT-VOTE-*, UT-SNAP-*, UT-BLOCK-*, UT-CONFIG-*, and IT-E2E-* cases.
- Storage model and refunds are covered by UT-VOTE-006, UT-VOTE-CB-007, IT-STORE-* cases.
- Edge cases and boundaries are covered by UT-INIT-*, UT-PROP-*, UT-VOTE-002, and UT-CONFIG-* cases.

## Known Limitations / Design Notes
- `has_pending_or_active_proposals` linearly scans all proposals; gas cost grows with proposal count. Monitor if large numbers of proposals are expected.
