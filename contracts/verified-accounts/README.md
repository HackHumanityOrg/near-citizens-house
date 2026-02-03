# Verified Accounts Contract

Smart contract for storing SumSub-based verification records on NEAR blockchain with on-chain signature verification.

## Features

- **NEAR Signature Verification**: Validates NEP-413 signatures on-chain using `env::ed25519_verify`
- **Access Control**: Only the backend wallet can write to the contract
- **Verification Records**: Stores verification timestamp and user context data
- **Public Reads**: Anyone can verify account status
- **Defense in Depth**: Backend verifies SumSub KYC, contract verifies NEAR signature

## Building

**Requirements:**

- Rust 1.86.0 (NEAR VM compatibility)
- `cargo-near` for contract builds
- Docker (required for `reproducible-wasm` builds)
- `wasm-opt` from binaryen (for optimization)

```bash
# Set correct Rust version (required for NEAR compatibility)
rustup override set 1.86.0
rustup target add wasm32-unknown-unknown
# Build contract
cargo near build reproducible-wasm
# Output: target/near/verified_accounts.wasm
```

> Reproducible builds require Docker and a clean git working tree with `Cargo.lock` committed.

## Deploying

```bash
# Create contract account
near account create-account fund-myself CONTRACT_ID '2 NEAR' \
 autogenerate-new-keypair save-to-keychain \
 sign-as YOUR_ACCOUNT network-config testnet sign-with-keychain send
# Deploy contract
near contract deploy CONTRACT_ID \
 use-file target/near/verified_accounts.wasm \
 without-init-call \
 network-config testnet sign-with-keychain send
# Initialize with backend wallet
near contract call-function as-transaction CONTRACT_ID new \
 json-args '{"backend_wallet":"YOUR_BACKEND_ACCOUNT"}' \
 prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
 sign-as YOUR_BACKEND_ACCOUNT \
 network-config testnet sign-with-keychain send
```

## Contract Methods

### Write Methods (Backend Only)

**`store_verification`** - Store a verified account with NEAR signature verification

```rust
pub fn store_verification(
    &mut self,
    near_account_id: AccountId,
    signature_data: NearSignatureData,
    user_context_data: String,
)
```

**`update_backend_wallet`** - Change the backend wallet address
**`pause`** / **`unpause`** - Emergency controls

### Read Methods (Public)

- `get_verification(account_id: AccountId) -> Option<VerificationSummary>` - Verification summary (account + timestamp)
- `get_full_verification(account_id: AccountId) -> Option<Verification>` - Full record with user context data
- `is_verified(account_id: AccountId) -> bool` - Simple boolean check
- `get_backend_wallet() -> AccountId` - Get backend wallet address
- `get_verified_count() -> u32` - Get total verified count
- `list_verifications(from_index: u32, limit: u32) -> Vec<Verification>` - Paginated list
- `are_verified(account_ids: Vec<AccountId>) -> Vec<bool>` - Batch verification check
- `get_verifications(account_ids: Vec<AccountId>) -> Vec<Option<VerificationSummary>>` - Batch summaries
- `is_paused() -> bool` - Check if contract is paused
- `get_state_version() -> u8` - Contract state version (diagnostics)

## Security

1. **Access Control**: `env::predecessor_account_id()` checks ensure only the backend wallet can write
2. **Signature Verification**: On-chain NEP-413 signature verification prevents spoofing
3. **Account Protection**: Prevents re-verification of already verified accounts

### Backend Requirements (Operational)

- Verify `signature_data.public_key` is an active full-access key for `signature_data.account_id` via RPC `view_access_key`.
- Enforce one-time challenges and nonce TTL (expire and reject replayed signatures).
- Bind the signature to this service by including the contract ID and domain in `signature_data.challenge`.
- Ensure `signature_data.recipient` equals the verification contract account.
- Log and rate-limit verification writes to detect anomalies.

## Architecture

\`\`\`
User Frontend (NEAR Wallet)
↓ Signs NEP-413 message
Backend API (/api/verify)
↓ Verifies SumSub KYC
↓ Calls contract.store_verification()
Smart Contract
↓ Verifies NEAR signature on-chain
↓ Stores verification record
Blockchain Storage (permanent)
\`\`\`

## Development

```bash
# Build for development
cargo near build reproducible-wasm
# Run tests
cargo test
# Check contract size
ls -lh target/near/verified_accounts.wasm
```

## Deployed Contracts

- **Testnet**: `v2.widefile4023.testnet`
- **Backend Wallet**: `widefile4023.testnet`

## Important Notes

- Rust 1.87+ generates WASM opcodes incompatible with NEAR VM - use 1.86.0
- Always use `cargo near build reproducible-wasm` for release builds (Docker + clean git required)
- Contract state changes are permanent and irreversible
- Storage costs are covered by the contract account balance
- Use a multisig or hardware-secured backend wallet and rotate keys on compromise
- Monitor verification write rate, storage growth, and account balance for anomalies
