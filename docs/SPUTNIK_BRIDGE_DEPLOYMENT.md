# SputnikDAO Bridge Deployment Playbook

This document provides step-by-step instructions for deploying the complete SputnikDAO bridge infrastructure on NEAR testnet and mainnet.

> **See also:** [DEVELOPER.md](DEVELOPER.md) for general development setup and the verified-accounts contract deployment.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Backend Wallet │────▶│ Bridge Contract │────▶│   SputnikDAO    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │ Verified Accounts│
                      │    Contract      │
                      └─────────────────┘
```

**Contracts to deploy:**

1. **Verified Accounts** - Identity verification oracle
2. **SputnikDAO Instance** - The DAO contract
3. **Sputnik Bridge** - Bridge between verified accounts and SputnikDAO

## Current Testnet Deployment

| Contract          | Address                                  |
| ----------------- | ---------------------------------------- |
| Backend Wallet    | `widefile4023.testnet`                   |
| Verified Accounts | `verification-v1.widefile4023.testnet`   |
| SputnikDAO        | `sputnik-dao-v1.widefile4023.testnet`    |
| Bridge Contract   | `sputnik-bridge-v1.widefile4023.testnet` |

## Voting Model

The Citizens House uses SputnikDAO's voting system with dynamic quorum.

**SputnikDAO v2 Limitation:** Threshold is calculated as a percentage of **total citizens**, not votes cast.

| Parameter               | Value                                  | Description                         |
| ----------------------- | -------------------------------------- | ----------------------------------- |
| **Threshold**           | 50%                                    | 50% of total citizens must vote YES |
| **Quorum**              | 7%                                     | Minimum participation floor         |
| **Effective Threshold** | `max(quorum, (citizen_count / 2) + 1)` | Actual YES votes needed to pass     |

### How It Works

1. **Member Addition**: When a new citizen is added via the bridge, two proposals are created:
   - `AddMemberToRole` proposal (auto-approved by bridge)
   - `ChangePolicyAddOrUpdateRole` proposal to update quorum (auto-approved by bridge)

2. **Dynamic Quorum**: After each member addition, the bridge automatically updates the citizen role's vote policy:
   - `quorum = ceil(citizen_count * 7 / 100)`
   - `threshold = [1, 2]` (50% of total citizens)

3. **Voting**: For a Vote proposal to pass with 100 citizens, you need 51 YES votes regardless of turnout.

### Bridge Permissions

The bridge requires these permissions to manage the DAO:

| Permission                              | Purpose                                  |
| --------------------------------------- | ---------------------------------------- |
| `add_member_to_role:AddProposal`        | Create member addition proposals         |
| `add_member_to_role:VoteApprove`        | Auto-approve member additions            |
| `policy_add_or_update_role:AddProposal` | Create quorum update proposals           |
| `policy_add_or_update_role:VoteApprove` | Auto-approve quorum updates              |
| `vote:AddProposal`                      | Create Vote proposals on behalf of users |

---

## Prerequisites

### 1. Install Required Tools

```bash
# Install Rust 1.86.0 (required - newer versions have WASM incompatibilities)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup install 1.86.0
rustup target add wasm32-unknown-unknown

# Install cargo-near
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh

# Install NEAR CLI (via npx, no global install needed)
# Commands use: npx near-cli-rs ...

# Verify installations
cargo near --version
npx near-cli-rs --version
```

### 2. Set Up Parent Account Credentials

If deploying to sub-accounts (e.g., `dao.parent.testnet`), you need the parent account credentials in the legacy keychain format:

```bash
# Create the credentials directory
mkdir -p ~/.near-credentials/testnet

# Get the public key for your account
npx near-cli-rs account list-keys YOUR_PARENT_ACCOUNT.testnet \
  network-config testnet now

# Create credentials file with your private key
cat > ~/.near-credentials/testnet/YOUR_PARENT_ACCOUNT.testnet.json << EOF
{
  "account_id": "YOUR_PARENT_ACCOUNT.testnet",
  "public_key": "ed25519:YOUR_PUBLIC_KEY",
  "private_key": "ed25519:YOUR_PRIVATE_KEY"
}
EOF
```

### 3. Create Sub-Accounts

```bash
# Set your parent account
PARENT=widefile4023.testnet

# Create sub-accounts with 5 NEAR each
# Format: fund-myself <new_account> '<amount>' autogenerate-new-keypair save-to-keychain sign-as <parent>

npx near-cli-rs account create-account fund-myself sputnik-dao-v1.$PARENT '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $PARENT \
  network-config testnet sign-with-keychain send

npx near-cli-rs account create-account fund-myself sputnik-bridge-v1.$PARENT '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $PARENT \
  network-config testnet sign-with-keychain send

npx near-cli-rs account create-account fund-myself verification-v1.$PARENT '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as $PARENT \
  network-config testnet sign-with-keychain send
```

**Note:** If you hit rate limits, use `testnet-fastnear` instead of `testnet`:

```bash
network-config testnet-fastnear sign-with-keychain send
```

---

## Phase 1: Build Contracts

### 1.1 Build Bridge Contract

```bash
cd contracts/sputnik-bridge
cargo near build non-reproducible-wasm

# Output: target/near/sputnik_bridge.wasm (~202KB)
```

### 1.2 Build Verified Accounts Contract

```bash
cd contracts/verified-accounts
cargo near build non-reproducible-wasm

# Output: target/near/verified_accounts.wasm (~177KB)
```

### 1.3 Use Pre-built SputnikDAO Contract

**Important:** Building SputnikDAO with Rust 1.87+ causes WASM deserialization errors. Use the pre-built WASM from the submodule:

```bash
# Pre-built WASM location (recommended)
contracts/sputnik-dao-contract/sputnikdao2/res/sputnikdao2.wasm  # ~420KB

# If you must build from source, use Rust 1.86.0:
cd contracts/sputnik-dao-contract/sputnikdao2
rustup override set 1.86.0
cargo build --target wasm32-unknown-unknown --release
```

### 1.4 Verify Builds

```bash
ls -lh contracts/sputnik-bridge/target/near/sputnik_bridge.wasm
ls -lh contracts/verified-accounts/target/near/verified_accounts.wasm
ls -lh contracts/sputnik-dao-contract/sputnikdao2/res/sputnikdao2.wasm
```

---

## Phase 2: Deploy Verified Accounts Contract

### 2.1 Deploy Contract

```bash
npx near-cli-rs contract deploy verification-v1.widefile4023.testnet \
  use-file contracts/verified-accounts/target/near/verified_accounts.wasm \
  without-init-call \
  network-config testnet-fastnear sign-with-keychain send
```

### 2.2 Initialize Contract

```bash
npx near-cli-rs contract call-function as-transaction verification-v1.widefile4023.testnet new \
  json-args '{"backend_wallet": "widefile4023.testnet"}' \
  prepaid-gas '30 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as verification-v1.widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send
```

---

## Phase 3: Deploy SputnikDAO

### 3.1 Deploy DAO Contract

```bash
# Use pre-built WASM to avoid Rust version issues
npx near-cli-rs contract deploy sputnik-dao-v1.widefile4023.testnet \
  use-file contracts/sputnik-dao-contract/sputnikdao2/res/sputnikdao2.wasm \
  without-init-call \
  network-config testnet-fastnear sign-with-keychain send
```

**Note:** SputnikDAO WASM is ~420KB and requires more storage. If you see "remaining balance will not be enough to cover storage", fund the account first:

```bash
npx near-cli-rs tokens widefile4023.testnet send-near sputnik-dao-v1.widefile4023.testnet '1 NEAR' \
  network-config testnet-fastnear sign-with-keychain send
```

### 3.2 Update dao-policy.json

Before initializing, update `contracts/sputnik-bridge/dao-policy.json` with your bridge contract address:

```json
{
  "config": {
    "name": "Citizens House DAO",
    "purpose": "Verified citizen governance for NEAR ecosystem",
    "metadata": ""
  },
  "policy": {
    "roles": [
      {
        "name": "bridge",
        "kind": {
          "Group": ["sputnik-bridge-v1.widefile4023.testnet"]
        },
        "permissions": [
          "add_member_to_role:AddProposal",
          "add_member_to_role:VoteApprove",
          "policy_add_or_update_role:AddProposal",
          "policy_add_or_update_role:VoteApprove",
          "vote:AddProposal"
        ],
        "vote_policy": {}
      },
      {
        "name": "citizen",
        "kind": {
          "Group": []
        },
        "permissions": ["vote:VoteApprove", "vote:VoteReject"],
        "vote_policy": {
          "vote": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [1, 2]
          }
        }
      },
      {
        "name": "all",
        "kind": "Everyone",
        "permissions": ["*:Finalize"],
        "vote_policy": {}
      }
    ],
    "default_vote_policy": {
      "weight_kind": "RoleWeight",
      "quorum": "0",
      "threshold": [1, 2]
    },
    "proposal_bond": "100000000000000000000000",
    "proposal_period": "604800000000000",
    "bounty_bond": "100000000000000000000000",
    "bounty_forgiveness_period": "604800000000000"
  }
}
```

### 3.3 Initialize DAO with Policy

```bash
npx near-cli-rs contract call-function as-transaction sputnik-dao-v1.widefile4023.testnet new \
  json-args "$(cat contracts/sputnik-bridge/dao-policy.json)" \
  prepaid-gas '100 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as sputnik-dao-v1.widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send
```

### 3.4 Verify DAO Deployment

```bash
npx near-cli-rs contract call-function as-read-only sputnik-dao-v1.widefile4023.testnet get_policy \
  json-args '{}' \
  network-config testnet-fastnear now
```

---

## Phase 4: Deploy Bridge Contract

### 4.1 Deploy Bridge WASM

```bash
npx near-cli-rs contract deploy sputnik-bridge-v1.widefile4023.testnet \
  use-file contracts/sputnik-bridge/target/near/sputnik_bridge.wasm \
  without-init-call \
  network-config testnet-fastnear sign-with-keychain send
```

### 4.2 Initialize Bridge Contract

```bash
npx near-cli-rs contract call-function as-transaction sputnik-bridge-v1.widefile4023.testnet new \
  json-args '{
    "backend_wallet": "widefile4023.testnet",
    "sputnik_dao": "sputnik-dao-v1.widefile4023.testnet",
    "verified_accounts_contract": "verification-v1.widefile4023.testnet",
    "citizen_role": "citizen"
  }' \
  prepaid-gas '30 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as sputnik-bridge-v1.widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send
```

### 4.3 Verify Bridge Deployment

```bash
npx near-cli-rs contract call-function as-read-only sputnik-bridge-v1.widefile4023.testnet get_info \
  json-args '{}' \
  network-config testnet-fastnear now
```

Expected output:

```json
{
  "backend_wallet": "widefile4023.testnet",
  "sputnik_dao": "sputnik-dao-v1.widefile4023.testnet",
  "verified_accounts_contract": "verification-v1.widefile4023.testnet",
  "citizen_role": "citizen"
}
```

---

## Phase 5: Fund Contracts

### 5.1 Fund Bridge Contract for Proposal Bonds

The bridge needs NEAR to pay proposal bonds when adding members. Each `add_member` call creates two proposals (member addition + quorum update):

```bash
# Send 10+ NEAR to bridge contract for proposal bonds
npx near-cli-rs tokens widefile4023.testnet send-near sputnik-bridge-v1.widefile4023.testnet '10 NEAR' \
  network-config testnet-fastnear sign-with-keychain send
```

### 5.2 Verify Balances

```bash
# Check bridge balance
npx near-cli-rs account view-account-summary sputnik-bridge-v1.widefile4023.testnet \
  network-config testnet-fastnear now

# Check DAO balance
npx near-cli-rs account view-account-summary sputnik-dao-v1.widefile4023.testnet \
  network-config testnet-fastnear now
```

---

## Phase 6: Test Deployment

### 6.1 Test Add Member Flow

First, ensure you have a verified account in the verified-accounts contract.

```bash
# Add a verified citizen to the DAO
# Note: Requires 300 TGas for full chain including quorum update
npx near-cli-rs contract call-function as-transaction sputnik-bridge-v1.widefile4023.testnet add_member \
  json-args '{"near_account_id": "alice.testnet"}' \
  prepaid-gas '300 Tgas' \
  attached-deposit '1 NEAR' \
  sign-as widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send
```

### 6.2 Verify Member Was Added and Quorum Updated

```bash
# Check DAO policy for new member and quorum
npx near-cli-rs contract call-function as-read-only sputnik-dao-v1.widefile4023.testnet get_policy \
  json-args '{}' \
  network-config testnet-fastnear now | jq '.roles[] | select(.name == "citizen")'
```

### 6.3 Test Create Proposal Flow

```bash
# Create a text proposal
npx near-cli-rs contract call-function as-transaction sputnik-bridge-v1.widefile4023.testnet create_proposal \
  json-args '{"description": "# Test Proposal\n\nThis is a test governance proposal."}' \
  prepaid-gas '100 Tgas' \
  attached-deposit '1 NEAR' \
  sign-as widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send
```

### 6.4 Verify Proposal Created

```bash
# Get last proposal ID
npx near-cli-rs contract call-function as-read-only sputnik-dao-v1.widefile4023.testnet get_last_proposal_id \
  json-args '{}' \
  network-config testnet-fastnear now

# Get proposal details (replace 0 with actual ID)
npx near-cli-rs contract call-function as-read-only sputnik-dao-v1.widefile4023.testnet get_proposal \
  json-args '{"id": 0}' \
  network-config testnet-fastnear now
```

---

## Phase 7: Configure Frontend

### 7.1 Update Environment Variables

Add to your `.env` file:

```bash
# Sputnik DAO and Bridge
NEXT_PUBLIC_SPUTNIK_DAO_CONTRACT=sputnik-dao-v1.widefile4023.testnet
NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT=sputnik-bridge-v1.widefile4023.testnet

# Verification Contract
NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT=verification-v1.widefile4023.testnet

# Backend wallet (for signing transactions)
NEAR_ACCOUNT_ID=widefile4023.testnet
NEAR_PRIVATE_KEY=ed25519:YOUR_PRIVATE_KEY
```

---

## Redeployment Guide

To redeploy contracts (e.g., after code changes):

### Delete and Recreate Accounts

```bash
# Delete existing accounts (funds returned to beneficiary)
npx near-cli-rs account delete-account sputnik-dao-v1.widefile4023.testnet \
  beneficiary widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send

npx near-cli-rs account delete-account sputnik-bridge-v1.widefile4023.testnet \
  beneficiary widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send

# Recreate accounts
npx near-cli-rs account create-account fund-myself sputnik-dao-v1.widefile4023.testnet '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send

npx near-cli-rs account create-account fund-myself sputnik-bridge-v1.widefile4023.testnet '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as widefile4023.testnet \
  network-config testnet-fastnear sign-with-keychain send
```

### Redeploy Code Only (Keep State)

If you only need to update the contract code without resetting state:

```bash
# Redeploy bridge contract (keeps existing state)
npx near-cli-rs contract deploy sputnik-bridge-v1.widefile4023.testnet \
  use-file contracts/sputnik-bridge/target/near/sputnik_bridge.wasm \
  without-init-call \
  network-config testnet-fastnear sign-with-keychain send
```

---

## Mainnet Deployment

For mainnet deployment, replace all `.testnet` suffixes with `.near` and use `network-config mainnet`.

### Key Differences for Mainnet:

1. **Higher deposit requirements** - Fund bridge with more NEAR
2. **Use reproducible builds** for verification:
   ```bash
   cargo near build reproducible-wasm
   ```
3. **Verify contracts on NEARBlocks** after deployment
4. **Test thoroughly on testnet first**

### Mainnet Account Structure

```
citizens-house.near              # Top-level account
├── dao.citizens-house.near      # SputnikDAO instance
├── bridge.citizens-house.near   # Bridge contract
├── verified.citizens-house.near # Verified accounts oracle
└── backend.citizens-house.near  # Backend wallet
```

---

## Troubleshooting

### Common Issues

**1. "this client has exceeded the rate limit"**

- Use `testnet-fastnear` instead of `testnet` in network-config
- Alternative RPC endpoints: `testnet-lava`
- Wait 60 seconds between requests if persistent

**2. "CompilationError(PrepareError(Deserialization))"**

- SputnikDAO was built with incompatible Rust version (1.87+)
- Use pre-built WASM from `contracts/sputnik-dao-contract/sputnikdao2/res/sputnikdao2.wasm`
- Or build with Rust 1.86.0: `rustup override set 1.86.0`

**3. "remaining balance will not be enough to cover storage"**

- Account needs more NEAR for contract storage
- SputnikDAO requires ~0.5 NEAR for storage
- Fund the account before deploying

**4. "Access key file not found"**

- Create credentials file in `~/.near-credentials/testnet/ACCOUNT.json`
- Must include `account_id`, `public_key`, and `private_key`
- Get public key with: `near account list-keys ACCOUNT network-config testnet now`

**5. "Account is not verified"**

- Ensure the account is registered in the verified-accounts contract
- Check: `near contract call-function as-read-only verification-v1.widefile4023.testnet is_account_verified json-args '{"near_account_id": "alice.testnet"}' network-config testnet-fastnear now`

**6. "Only backend wallet can call this function"**

- Ensure you're signing with the correct backend wallet
- Check bridge config with `get_info` method

**7. "Exceeded the prepaid gas"**

- Use 300 TGas for `add_member` (includes quorum update chain)
- Use 100 TGas for `create_proposal`
- The add_member flow creates 2 proposals with 7 cross-contract calls

**8. "Proposal bond not attached"**

- `add_member` requires ~1 NEAR (for 2 proposal bonds)
- `create_proposal` requires ~0.1 NEAR (for 1 proposal bond)

**9. "ERR_PERMISSION_DENIED" or "Failed to create quorum update proposal"**

- Bridge is missing required permissions in DAO policy
- Verify bridge has all 5 permissions listed in dao-policy.json

### Useful Debug Commands

```bash
# View all proposals
npx near-cli-rs contract call-function as-read-only sputnik-dao-v1.widefile4023.testnet get_proposals \
  json-args '{"from_index": 0, "limit": 100}' \
  network-config testnet-fastnear now

# Check contract state
npx near-cli-rs contract view-storage sputnik-bridge-v1.widefile4023.testnet \
  all as-json \
  network-config testnet-fastnear now

# Check citizen quorum
npx near-cli-rs contract call-function as-read-only sputnik-dao-v1.widefile4023.testnet get_policy \
  json-args '{}' \
  network-config testnet-fastnear now | jq '.roles[] | select(.name == "citizen") | .vote_policy'

# View available network configs
npx near-cli-rs config show-connections
```

---

## Quick Reference

### Gas Requirements

| Operation               | Gas (TGas) | Notes                                |
| ----------------------- | ---------- | ------------------------------------ |
| add_member              | 300        | Includes quorum update (2 proposals) |
| create_proposal         | 100        | Single Vote proposal                 |
| act_proposal (vote)     | 50         | Voting on proposals                  |
| act_proposal (finalize) | 50         | Finalizing after voting period       |

### Deposit Requirements

| Operation       | Deposit                    |
| --------------- | -------------------------- |
| add_member      | 1 NEAR (2 proposal bonds)  |
| create_proposal | 0.1 NEAR (1 proposal bond) |
| Voting          | 0 NEAR                     |
| Finalize        | 0 NEAR                     |

### Voting Requirements

| Citizens | Quorum (7%) | Threshold (50%) | Votes Needed to Pass |
| -------- | ----------- | --------------- | -------------------- |
| 1        | 1           | 1               | 1                    |
| 10       | 1           | 6               | 6                    |
| 50       | 4           | 26              | 26                   |
| 100      | 7           | 51              | 51                   |
| 1000     | 70          | 501             | 501                  |

_Threshold is based on total citizens, not votes cast._

---

## Security Checklist

Before going live:

- [ ] Backend wallet private key is securely stored (not in git)
- [ ] Bridge contract has correct backend_wallet set
- [ ] DAO policy has minimal permissions for bridge role
- [ ] Bridge has `policy_add_or_update_role` permissions for dynamic quorum
- [ ] Citizens can only vote (not create proposals or finalize)
- [ ] Everyone can finalize (prevents stuck proposals)
- [ ] Verified accounts contract is correctly configured
- [ ] Bridge contract is funded for proposal bonds (enough for 2 per member)
- [ ] All contracts tested on testnet first
- [ ] Reproducible builds verified on mainnet
- [ ] Quorum updates correctly after member additions
