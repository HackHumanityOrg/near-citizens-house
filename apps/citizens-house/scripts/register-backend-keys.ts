#!/usr/bin/env npx tsx
/**
 * Register Backend Wallet Key Pool
 *
 * This script registers the 10 deterministically-derived access keys on the
 * backend wallet. Run this once per environment (staging, production).
 *
 * Usage:
 *   pnpm register-backend-keys
 *
 * Prerequisites:
 *   - NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY set in environment
 *   - Backend wallet must have enough NEAR for gas (~0.1 NEAR per key)
 */
import "server-only"

import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import type { Signer } from "@near-js/signers"
import { NEAR_CONFIG } from "../lib/config"
import { createRpcProvider } from "../lib/providers/rpc-provider"
import { backendKeyPool } from "../lib/backend-key-pool"

async function main(): Promise<void> {
  const { backendAccountId, backendPrivateKey, networkId } = NEAR_CONFIG

  if (!backendAccountId || !backendPrivateKey) {
    console.error("Error: NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY environment variables are required")
    process.exit(1)
  }

  console.log(`\n=== Registering Backend Key Pool ===`)
  console.log(`Account: ${backendAccountId}`)
  console.log(`Network: ${networkId}`)
  console.log(`Pool Size: ${backendKeyPool.getPoolSize()} keys`)
  console.log("")

  // Create account with master key for adding new keys
  const masterKeyPair = KeyPair.fromString(backendPrivateKey as `ed25519:${string}`)
  const signer = new KeyPairSigner(masterKeyPair)
  const provider = createRpcProvider()
  const account = new Account(backendAccountId, provider, signer as unknown as Signer)

  const poolSize = backendKeyPool.getPoolSize()
  let added = 0
  let existing = 0
  let failed = 0

  for (let i = 0; i < poolSize; i++) {
    const derivedKey = backendKeyPool.getKeyByIndex(i)
    const publicKey = derivedKey.getPublicKey()
    const publicKeyStr = publicKey.toString()
    const shortKey = publicKeyStr.slice(0, 20) + "..."

    try {
      await account.addFullAccessKey(publicKey)
      console.log(`  Key ${i}: ${shortKey} - Added`)
      added++
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Key already exists = success (idempotent)
      if (
        errorMessage.includes("AddKeyAlreadyExists") ||
        errorMessage.includes("already exists") ||
        errorMessage.includes("already used")
      ) {
        console.log(`  Key ${i}: ${shortKey} - Already registered`)
        existing++
      } else {
        console.error(`  Key ${i}: ${shortKey} - Failed: ${errorMessage}`)
        failed++
      }
    }
  }

  console.log("")
  console.log("=== Summary ===")
  console.log(`  Added: ${added}`)
  console.log(`  Already registered: ${existing}`)
  console.log(`  Failed: ${failed}`)
  console.log("")

  if (failed > 0) {
    console.error(`Warning: ${failed} key(s) failed to register`)
    process.exit(1)
  }

  console.log("Backend key pool registered successfully!")
  console.log("")
  console.log("Next steps:")
  console.log("  1. Deploy the updated code to use the key pool")
  console.log("  2. Run E2E tests: E2E_TESTING=true pnpm exec playwright test --workers=10")
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
