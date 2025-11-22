# NEAR Verification Database Contract

Smart contract for storing Self.xyz passport verification records on NEAR blockchain with on-chain signature verification.

## Features

- **NEAR Signature Verification**: Validates NEP-413 signatures on-chain using `env::ed25519_verify`
- **Access Control**: Only the backend wallet can write to the contract
- **Nullifier Tracking**: Prevents duplicate passport registrations
- **Public Reads**: Anyone can verify account status
- **Defense in Depth**: Backend verifies Self.xyz proof, contract verifies NEAR signature

## Building

**Requirements:**

- Rust 1.86.0 (NEAR VM compatibility)
- `cargo-near` for contract builds
- `wasm-opt` from binaryen (for optimization)

\`\`\`bash

# Set correct Rust version (required for NEAR compatibility)

rustup override set 1.86
rustup target add wasm32-unknown-unknown

# Build contract

cargo near build non-reproducible-wasm

# Output: target/near/verification_db.wasm

\`\`\`

## Deploying

\`\`\`bash

# Create contract account

near account create-account fund-myself CONTRACT_ID '2 NEAR' \
 autogenerate-new-keypair save-to-keychain \
 sign-as YOUR_ACCOUNT network-config testnet sign-with-keychain send

# Deploy contract

near contract deploy CONTRACT_ID \
 use-file target/near/verification_db.wasm \
 without-init-call \
 network-config testnet sign-with-keychain send

# Initialize with backend wallet

near contract call-function as-transaction CONTRACT_ID new \
 json-args '{"backend_wallet":"YOUR_BACKEND_ACCOUNT"}' \
 prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
 sign-as YOUR_BACKEND_ACCOUNT \
 network-config testnet sign-with-keychain send
\`\`\`

## Contract Methods

### Write Methods (Backend Only)

**`store_verification`** - Store a verified passport-wallet association

\`\`\`rust
pub fn store_verification(
&mut self,
nullifier: String,
near_account_id: AccountId,
user_id: String,
attestation_id: String,
merkle_root: Option<String>,
signature_data: NearSignatureData,
)
\`\`\`

### Read Methods (Public)

- `get_verified_account(near_account_id: AccountId) -> Option<VerifiedAccount>`
- `is_nullifier_used(nullifier: String) -> bool`
- `is_account_verified(near_account_id: AccountId) -> bool`
- `get_backend_wallet() -> AccountId`
- `get_verified_count() -> u64`

## Security

1. **Access Control**: `env::predecessor_account_id()` checks ensure only the backend wallet can write
2. **Signature Verification**: On-chain NEP-413 signature verification prevents spoofing
3. **Nullifier Protection**: Prevents same passport from being registered multiple times
4. **Account Protection**: Prevents re-verification of already verified accounts

## Architecture

\`\`\`
User Frontend (NEAR Wallet)
↓ Signs NEP-413 message
Backend API (/api/verify)
↓ Verifies Self.xyz proof
↓ Calls contract.store_verification()
Smart Contract
↓ Verifies NEAR signature on-chain
↓ Stores verification record
Blockchain Storage (permanent)
\`\`\`

## Development

\`\`\`bash

# Build for development

cargo near build non-reproducible-wasm

# Run tests

cargo test

# Check contract size

ls -lh target/near/verification_db.wasm
\`\`\`

## Deployed Contracts

- **Testnet**: `v2.widefile4023.testnet`
- **Backend Wallet**: `widefile4023.testnet`

## Important Notes

- Rust 1.87+ generates WASM opcodes incompatible with NEAR VM - use 1.86.0
- Always use `cargo near build` for proper ABI generation
- Contract state changes are permanent and irreversible
- Storage costs are covered by the contract account balance
