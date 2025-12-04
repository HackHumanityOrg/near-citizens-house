# SputnikDAO Bridge Deployment Playbook

This document provides step-by-step instructions for deploying the complete SputnikDAO bridge infrastructure on NEAR testnet and mainnet.

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

1. **SputnikDAO Factory** (optional - use existing factory)
2. **SputnikDAO Instance** - The DAO contract
3. **Sputnik Bridge** - Bridge between verified accounts and SputnikDAO

## Prerequisites

### 1. Install Required Tools

```bash
# Install Rust (if not installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install cargo-near
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh

# Install NEAR CLI
npm install -g near-cli-rs

# Verify installations
cargo near --version
near --version
```

### 2. Set Up NEAR Accounts

You'll need the following accounts:

| Account           | Purpose                      | Testnet Example                   | Mainnet Example                |
| ----------------- | ---------------------------- | --------------------------------- | ------------------------------ |
| Backend Wallet    | Signs bridge transactions    | `backend.testnet`                 | `backend.near`                 |
| Bridge Contract   | Hosts bridge contract        | `bridge.citizens-house.testnet`   | `bridge.citizens-house.near`   |
| SputnikDAO        | Hosts DAO contract           | `dao.citizens-house.testnet`      | `dao.citizens-house.near`      |
| Verified Accounts | Existing verification oracle | `verified.citizens-house.testnet` | `verified.citizens-house.near` |

### 3. Create Accounts (Testnet)

```bash
# Create backend wallet (if needed)
near account create-account fund-myself backend.testnet autogenerate-new-keypair save-to-keychain network-config testnet create

# Create bridge contract account
near account create-account fund-myself bridge.citizens-house.testnet autogenerate-new-keypair save-to-keychain network-config testnet create

# Create DAO account
near account create-account fund-myself dao.citizens-house.testnet autogenerate-new-keypair save-to-keychain network-config testnet create
```

---

## Phase 1: Build Contracts

### 1.1 Build Bridge Contract

```bash
cd contracts/sputnik-bridge
cargo near build non-reproducible-wasm

# Output: target/near/sputnik_bridge.wasm
```

### 1.2 Build SputnikDAO Contract (from submodule)

```bash
cd contracts/sputnik-dao-contract/sputnikdao2

# Build the DAO contract
cargo build --target wasm32-unknown-unknown --release

# The WASM will be at:
# target/wasm32-unknown-unknown/release/sputnikdao2.wasm
```

### 1.3 Verify Builds

```bash
# Check file sizes (should be < 4MB for deployment)
ls -lh contracts/sputnik-bridge/target/near/sputnik_bridge.wasm
ls -lh contracts/sputnik-dao-contract/sputnikdao2/target/wasm32-unknown-unknown/release/sputnikdao2.wasm
```

---

## Phase 2: Deploy SputnikDAO

### 2.1 Deploy DAO Contract

**Option A: Use SputnikDAO Factory (Recommended)**

The SputnikDAO factory is already deployed:

- Testnet: `sputnik-dao.testnet`
- Mainnet: `sputnik-dao.near`

```bash
# Create DAO via factory
near contract call-function as-transaction sputnik-dao.testnet create \
  json-args '{
    "name": "citizens-house",
    "args": "BASE64_ENCODED_POLICY"
  }' \
  prepaid-gas '150 Tgas' \
  attached-deposit '6 NEAR' \
  sign-as backend.testnet \
  network-config testnet \
  sign-with-keychain send
```

**Option B: Direct Deployment**

```bash
# Deploy DAO contract directly
near contract deploy dao.citizens-house.testnet \
  use-file contracts/sputnik-dao-contract/sputnikdao2/target/wasm32-unknown-unknown/release/sputnikdao2.wasm \
  without-init-call \
  network-config testnet \
  sign-with-keychain send
```

### 2.2 Initialize DAO with Policy

Create the policy JSON file `dao-policy.json`:

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
          "Group": ["bridge.citizens-house.testnet"]
        },
        "permissions": ["AddMemberToRole:AddProposal", "AddMemberToRole:VoteApprove", "Vote:AddProposal"],
        "vote_policy": {}
      },
      {
        "name": "citizen",
        "kind": {
          "Group": []
        },
        "permissions": ["*:VoteApprove", "*:VoteReject"],
        "vote_policy": {}
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

Initialize the DAO:

```bash
# If deployed directly (not via factory), initialize with policy
near contract call-function as-transaction dao.citizens-house.testnet new \
  json-args "$(cat dao-policy.json)" \
  prepaid-gas '100 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as dao.citizens-house.testnet \
  network-config testnet \
  sign-with-keychain send
```

### 2.3 Verify DAO Deployment

```bash
# Check DAO policy
near contract call-function as-read-only dao.citizens-house.testnet get_policy \
  json-args '{}' \
  network-config testnet now

# Check roles
near contract call-function as-read-only dao.citizens-house.testnet get_policy \
  json-args '{}' \
  network-config testnet now | jq '.roles'
```

---

## Phase 3: Deploy Bridge Contract

### 3.1 Deploy Bridge WASM

```bash
near contract deploy bridge.citizens-house.testnet \
  use-file contracts/sputnik-bridge/target/near/sputnik_bridge.wasm \
  without-init-call \
  network-config testnet \
  sign-with-keychain send
```

### 3.2 Initialize Bridge Contract

```bash
near contract call-function as-transaction bridge.citizens-house.testnet new \
  json-args '{
    "backend_wallet": "backend.testnet",
    "sputnik_dao": "dao.citizens-house.testnet",
    "verified_accounts_contract": "verified.citizens-house.testnet",
    "citizen_role": "citizen"
  }' \
  prepaid-gas '30 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as bridge.citizens-house.testnet \
  network-config testnet \
  sign-with-keychain send
```

### 3.3 Verify Bridge Deployment

```bash
# Check bridge info
near contract call-function as-read-only bridge.citizens-house.testnet get_info \
  json-args '{}' \
  network-config testnet now
```

Expected output:

```json
{
  "backend_wallet": "backend.testnet",
  "sputnik_dao": "dao.citizens-house.testnet",
  "verified_accounts_contract": "verified.citizens-house.testnet",
  "citizen_role": "citizen"
}
```

---

## Phase 4: Fund Contracts

### 4.1 Fund Bridge Contract for Proposal Bonds

The bridge needs NEAR to pay proposal bonds when adding members:

```bash
# Send 10 NEAR to bridge contract for proposal bonds
near tokens backend.testnet send-near bridge.citizens-house.testnet '10 NEAR' \
  network-config testnet \
  sign-with-keychain send
```

### 4.2 Verify Balances

```bash
# Check bridge balance
near account view-account-summary bridge.citizens-house.testnet \
  network-config testnet now

# Check DAO balance
near account view-account-summary dao.citizens-house.testnet \
  network-config testnet now
```

---

## Phase 5: Test Deployment

### 5.1 Test Add Member Flow

First, ensure you have a verified account in the verified-accounts contract.

```bash
# Add a verified citizen to the DAO
near contract call-function as-transaction bridge.citizens-house.testnet add_member \
  json-args '{
    "near_account_id": "alice.testnet"
  }' \
  prepaid-gas '200 Tgas' \
  attached-deposit '0.1 NEAR' \
  sign-as backend.testnet \
  network-config testnet \
  sign-with-keychain send
```

### 5.2 Verify Member Was Added

```bash
# Check DAO policy for new member
near contract call-function as-read-only dao.citizens-house.testnet get_policy \
  json-args '{}' \
  network-config testnet now | jq '.roles[] | select(.name == "citizen")'
```

### 5.3 Test Create Proposal Flow

```bash
# Create a text proposal
near contract call-function as-transaction bridge.citizens-house.testnet create_proposal \
  json-args '{
    "description": "# Test Proposal\n\nThis is a test governance proposal."
  }' \
  prepaid-gas '100 Tgas' \
  attached-deposit '0.1 NEAR' \
  sign-as backend.testnet \
  network-config testnet \
  sign-with-keychain send
```

### 5.4 Verify Proposal Created

```bash
# Get last proposal
near contract call-function as-read-only dao.citizens-house.testnet get_last_proposal_id \
  json-args '{}' \
  network-config testnet now

# Get proposal details (replace 0 with actual ID)
near contract call-function as-read-only dao.citizens-house.testnet get_proposal \
  json-args '{"id": 0}' \
  network-config testnet now
```

### 5.5 Test Voting (as citizen)

```bash
# Vote on proposal (must be done by a citizen, not through bridge)
near contract call-function as-transaction dao.citizens-house.testnet act_proposal \
  json-args '{
    "id": 0,
    "action": "VoteApprove"
  }' \
  prepaid-gas '50 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as alice.testnet \
  network-config testnet \
  sign-with-keychain send
```

### 5.6 Test Finalization (anyone can finalize)

```bash
# Wait for proposal period to end, then finalize
near contract call-function as-transaction dao.citizens-house.testnet act_proposal \
  json-args '{
    "id": 0,
    "action": "Finalize"
  }' \
  prepaid-gas '50 Tgas' \
  attached-deposit '0 NEAR' \
  sign-as anyone.testnet \
  network-config testnet \
  sign-with-keychain send
```

---

## Phase 6: Configure Frontend

### 6.1 Update Environment Variables

Add to your `.env` file:

```bash
# Bridge Contract
NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT=bridge.citizens-house.testnet

# SputnikDAO Contract (for direct voting)
NEXT_PUBLIC_NEAR_DAO_CONTRACT=dao.citizens-house.testnet
```

### 6.2 Verify TypeScript Client Works

```typescript
import { bridgeContract } from "@near-citizens/shared"

// Get bridge info
const info = await bridgeContract.getInfo()
console.log(info)

// Add member (backend only)
await bridgeContract.addMember("alice.testnet", 0.1)

// Create proposal (backend only)
const proposalId = await bridgeContract.createProposal("# My Proposal\n\nDescription here", 0.1)
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

**1. "Account is not verified"**

- Ensure the account is registered in the verified-accounts contract
- Check: `near contract call-function as-read-only verified.citizens-house.testnet is_account_verified json-args '{"near_account_id": "alice.testnet"}' network-config testnet now`

**2. "Only backend wallet can call this function"**

- Ensure you're signing with the correct backend wallet
- Check bridge config: `near contract call-function as-read-only bridge.citizens-house.testnet get_backend_wallet json-args '{}' network-config testnet now`

**3. "Exceeded the prepaid gas"**

- Increase gas limit to 200+ TGas for cross-contract calls
- The add_member flow requires 3 cross-contract calls

**4. "Proposal bond not attached"**

- Ensure sufficient deposit is attached (0.1 NEAR default)
- Check DAO's proposal_bond in policy

**5. "Member not added to DAO"**

- Check bridge has correct permissions in DAO policy
- Verify bridge account is in the "bridge" role

### Useful Debug Commands

```bash
# View all proposals
near contract call-function as-read-only dao.citizens-house.testnet get_proposals \
  json-args '{"from_index": 0, "limit": 100}' \
  network-config testnet now

# View transaction logs
near transaction view TX_HASH network-config testnet

# Check contract state
near contract view-storage bridge.citizens-house.testnet \
  all as-json \
  network-config testnet now
```

---

## Quick Reference

### Contract Addresses (Testnet)

| Contract           | Address                           |
| ------------------ | --------------------------------- |
| SputnikDAO Factory | `sputnik-dao.testnet`             |
| Citizens House DAO | `dao.citizens-house.testnet`      |
| Bridge Contract    | `bridge.citizens-house.testnet`   |
| Verified Accounts  | `verified.citizens-house.testnet` |

### Gas Requirements

| Operation               | Gas (TGas) |
| ----------------------- | ---------- |
| add_member              | 200        |
| create_proposal         | 100        |
| act_proposal (vote)     | 50         |
| act_proposal (finalize) | 50         |

### Deposit Requirements

| Operation       | Deposit                  |
| --------------- | ------------------------ |
| add_member      | 0.1 NEAR (proposal bond) |
| create_proposal | 0.1 NEAR (proposal bond) |
| Voting          | 0 NEAR                   |
| Finalize        | 0 NEAR                   |

---

## Security Checklist

Before going live:

- [ ] Backend wallet private key is securely stored (not in git)
- [ ] Bridge contract has correct backend_wallet set
- [ ] DAO policy has minimal permissions for bridge role
- [ ] Citizens can only vote (not create proposals or finalize)
- [ ] Everyone can finalize (prevents stuck proposals)
- [ ] Verified accounts contract is correctly configured
- [ ] Bridge contract is funded for proposal bonds
- [ ] All contracts tested on testnet first
- [ ] Reproducible builds verified on mainnet
