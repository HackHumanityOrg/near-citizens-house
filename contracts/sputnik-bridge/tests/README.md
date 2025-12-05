# Sputnik Bridge Integration Tests

This directory contains comprehensive integration tests for the sputnik-bridge contract using real sputnik-dao and verified-accounts contracts deployed in a NEAR sandbox environment.

## Test Environment

The tests use `near-workspaces` to deploy three contracts:

- **sputnik-bridge** - The bridge contract being tested
- **sputnik-dao** (v2) - Real SputnikDAO contract for governance
- **verified-accounts** - Identity verification oracle

### Configuration

| Parameter       | Value      | Description                    |
| --------------- | ---------- | ------------------------------ |
| Proposal Period | 10 seconds | Short period for fast testing  |
| Proposal Bond   | 1 NEAR     | Required deposit for proposals |
| Vote Threshold  | 1/2 (50%)  | Majority required to pass      |
| Quorum          | 0          | No minimum participation       |

### DAO Policy Roles

| Role      | Members                  | Permissions                                                                            |
| --------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `bridge`  | Bridge contract          | `add_member_to_role:AddProposal`, `add_member_to_role:VoteApprove`, `vote:AddProposal` |
| `citizen` | Verified users (dynamic) | `*:VoteApprove`, `*:VoteReject`                                                        |
| `all`     | Everyone                 | `*:Finalize`                                                                           |

## Test Summary

**Total: 60 tests**

### A. Setup Tests (3 tests)

| Test                                   | Description                                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `test_full_setup`                      | Verifies all three contracts deploy correctly and bridge is initialized with correct configuration |
| `test_bridge_connected_to_dao`         | Confirms bridge account is registered in the DAO's "bridge" role                                   |
| `test_dao_policy_configured_correctly` | Validates proposal period and citizen role exist in DAO policy                                     |

### B. Member Addition Flow Tests (7 tests)

| Test                                  | Description                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `test_add_verified_member_success`    | Full flow: verify user via backend, then add to DAO via bridge                   |
| `test_add_member_creates_proposal`    | Confirms adding a member creates an AddMemberToRole proposal in the DAO          |
| `test_add_member_auto_approves`       | Verifies bridge auto-approves its own member addition proposals                  |
| `test_member_appears_in_citizen_role` | Confirms added user appears in the citizen role after proposal passes            |
| `test_add_member_unauthorized`        | Non-backend account cannot call add_member (returns "Only backend wallet" error) |
| `test_add_unverified_member_fails`    | Attempting to add an unverified user fails with "not verified" error             |
| `test_add_multiple_members`           | Successfully adds 3 verified users as citizens                                   |

### C. Proposal Creation Tests (5 tests)

| Test                                     | Description                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `test_create_vote_proposal_success`      | Backend can create Vote proposals via the bridge                            |
| `test_create_proposal_returns_id`        | Proposal ID increments and created proposal is Vote type                    |
| `test_create_proposal_unauthorized`      | Non-backend account cannot create proposals                                 |
| `test_create_proposal_empty_description` | Empty description is rejected with "cannot be empty" error                  |
| `test_create_proposal_too_long`          | Description over 10,000 characters is rejected with "exceeds maximum" error |

### D. Voting Flow Tests (6 tests)

| Test                                   | Description                                                      |
| -------------------------------------- | ---------------------------------------------------------------- |
| `test_citizen_can_vote_on_proposal`    | Verified citizen can vote on proposals created via bridge        |
| `test_citizen_vote_approve`            | Single citizen's approval vote passes proposal (100% = majority) |
| `test_citizen_vote_reject`             | Single citizen's reject vote fails proposal                      |
| `test_non_citizen_cannot_vote`         | Unverified user (not a citizen) cannot vote on proposals         |
| `test_proposal_passes_with_majority`   | With 3 citizens, 2 approval votes (67%) passes the proposal      |
| `test_proposal_fails_with_majority_no` | With 3 citizens, 2 reject votes (67%) rejects the proposal       |

### E. Time-Based Tests (2 tests)

| Test                                 | Description                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `test_proposal_expires_after_period` | Proposal status becomes Expired after 10-second period (uses fast_forward) |
| `test_vote_before_expiry_succeeds`   | Voting within the proposal period succeeds                                 |

### F. Event Tests (2 tests)

| Test                                  | Description                                                         |
| ------------------------------------- | ------------------------------------------------------------------- |
| `test_member_added_event_emitted`     | `member_added` event is emitted when a user is successfully added   |
| `test_proposal_created_event_emitted` | `proposal_created` event is emitted when a Vote proposal is created |

### G. Admin Tests (5 tests)

| Test                                             | Description                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `test_update_backend_wallet`                     | Backend can update the backend_wallet address                                         |
| `test_backend_wallet_rotation_enforced`          | Rotating backend blocks the old wallet and authorizes the new one for bridge actions  |
| `test_update_citizen_role`                       | Backend can update the citizen_role name                                              |
| `test_update_citizen_role_applies_to_members_and_events` | Updated role is used when adding members and reflected in emitted events      |
| `test_get_info`                                  | get_info returns correct contract configuration                                       |

### H. Access Control Security Tests (6 tests)

| Test                                               | Description                                                                                    |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `test_update_backend_wallet_unauthorized`          | Non-backend cannot update backend wallet                                                       |
| `test_update_citizen_role_unauthorized`            | Non-backend cannot update citizen role                                                         |
| `test_citizen_cannot_add_proposal_to_dao_directly` | Citizens cannot bypass bridge to add proposals directly to DAO                                 |
| `test_random_account_cannot_add_proposal_to_dao`   | Random accounts are blocked by DAO policy from adding proposals                                |
| `test_citizen_cannot_vote_remove`                  | Citizens lack VoteRemove permission (only VoteApprove/VoteReject)                              |
| `test_anyone_can_finalize_proposal`                | Verifies expired proposals can be finalized by anyone (tests on InProgress→Expired transition) |

### I. Callback Security Tests (4 tests)

| Test                                                              | Description                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `test_callback_add_member_cannot_be_called_externally`            | `callback_add_member` protected by #[private] macro - verifies error contains "predecessor" or "private" |
| `test_callback_proposal_created_cannot_be_called_externally`      | `callback_proposal_created` protected by #[private] macro - verifies error message                       |
| `test_callback_member_added_cannot_be_called_externally`          | `callback_member_added` protected by #[private] macro - verifies error message                           |
| `test_callback_vote_proposal_created_cannot_be_called_externally` | `callback_vote_proposal_created` protected by #[private] macro - verifies error message                  |

### J. Edge Case Tests (7 tests)

| Test                                               | Description                                                                                   |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `test_add_member_already_citizen`                  | Re-adding existing citizen succeeds idempotently (creates new proposal, user remains citizen) |
| `test_cannot_vote_twice_on_same_proposal`          | User cannot vote twice on the same proposal                                                   |
| `test_vote_on_nonexistent_proposal_fails`          | Voting on non-existent proposal ID fails                                                      |
| `test_create_proposal_exactly_max_length`          | Proposal with exactly 10,000 character description succeeds (boundary test)                   |
| `test_create_proposal_single_char_description`     | Proposal with single character description succeeds (minimum boundary)                        |
| `test_create_proposal_whitespace_only_description` | Whitespace-only descriptions are rejected as "cannot be empty" (trimmed to empty)             |
| `test_create_proposal_unicode_description`         | Unicode characters (emoji, CJK) in descriptions are preserved                                 |

### K. Deposit/Bond Tests (3 tests)

| Test                                        | Description                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `test_add_member_insufficient_deposit`      | add_member with 0.1 NEAR (insufficient) fails with proper error message      |
| `test_create_proposal_insufficient_deposit` | create_proposal with 0.1 NEAR (insufficient) fails with proper error message |
| `test_add_member_zero_deposit`              | add_member with zero deposit fails                                           |

### L. Cross-Contract Call Failure Tests (8 tests)

| Test                                                 | Description                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `test_add_member_verification_fails_no_state_change` | State unchanged when verification cross-contract call fails |
| `test_add_member_auto_approve_failure_no_event`      | Auto-approve failure (missing permission) emits no event and adds no member |
| `test_verification_promise_failure_no_event`         | Uninitialized verification contract causes promise failure, no proposal/event |
| `test_create_proposal_dao_failure_no_event`          | No proposal_created event emitted when DAO rejects          |
| `test_add_member_dao_failure_no_event`               | No member_added event emitted when DAO rejects              |
| `test_multiple_failures_dont_corrupt_state`          | Multiple failures maintain state consistency                |
| `test_gas_exhaustion_partial_operation`              | Gas exhaustion doesn't corrupt state, proper error message  |
| `test_successful_operation_after_failed_callback`    | System works normally after callback failures               |

### M. Concurrent Operations Tests (2 tests)

| Test                               | Description                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| `test_concurrent_member_additions` | Multiple users added in rapid succession all succeed         |
| `test_concurrent_proposal_voting`  | Multiple citizens voting in rapid succession works correctly |

## Helper Functions

Located in `helpers.rs`:

### Setup Functions

- `setup()` - Deploys all contracts with test configuration
- `setup_with_users(count)` - Setup + creates N test user accounts

### Verification Helpers

- `verify_user(backend, verified_accounts, user, index)` - Registers user as verified
- `is_user_verified(verified_accounts, user)` - Checks verification status

### Bridge Helpers

- `add_member_via_bridge(backend, bridge, user)` - Adds verified member to DAO
- `create_proposal_via_bridge(backend, bridge, description)` - Creates Vote proposal

### DAO Helpers

- `get_last_proposal_id(dao)` - Gets latest proposal ID
- `get_proposal(dao, proposal_id)` - Gets proposal details
- `get_dao_policy(dao)` - Gets DAO policy configuration
- `vote_on_proposal(voter, dao, proposal_id, action, proposal_kind)` - Votes on proposal
- `is_account_in_role(dao, account_id, role_name)` - Checks role membership

### Event Helpers

- `extract_event_logs(result)` - Extracts EVENT_JSON logs from transaction
- `parse_events(logs)` - Parses event logs into EventWrapper structs
- `contains_error(result, expected)` - Checks if result contains expected error message

### Cryptographic Helpers

- `generate_nep413_signature(account, message, nonce, recipient)` - Generates valid NEP-413 signatures
- `test_self_proof()` - Creates mock Self.xyz ZK proof data

## Running Tests

```bash
# Run all tests
cargo test

# Run specific test
cargo test test_add_verified_member_success

# Run tests with output
cargo test -- --nocapture

# Run tests matching pattern
cargo test test_citizen
```

## Security Best Practices Applied

These tests are based on security recommendations from:

- **OpenZeppelin** - Access control testing, input validation, error handling
- **Sigma Prime NEAR** - Callback protection (#[private]), cross-contract security
- **NEARBuilders Audits** - Governance mechanisms, treasury/bond handling
- **NEAR Documentation** - Sandbox testing, fast_forward for time-sensitive tests
