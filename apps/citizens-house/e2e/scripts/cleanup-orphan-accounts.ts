#!/usr/bin/env npx tsx
/**
 * Cleanup Orphan E2E Test Accounts
 *
 * This script deletes orphaned E2E test subaccounts and returns their funds
 * to the parent account.
 *
 * For NEW accounts (created after this fix):
 * - Each subaccount has the parent key registered as a backup
 * - Cleanup uses the parent key to delete these accounts
 *
 * For OLD accounts (created before this fix):
 * - Only random keys were registered (now lost)
 * - These accounts cannot be recovered - script will report them as failures
 *
 * Usage:
 *   pnpm cleanup-orphan-accounts [subaccounts-file]
 *
 * If no file is provided, reads from /tmp/subaccounts.txt
 *
 * Environment variables required:
 *   NEAR_ACCOUNT_ID - Parent account ID
 *   NEAR_PRIVATE_KEY - Parent account private key
 *   NEXT_PUBLIC_NEAR_NETWORK - Network (mainnet/testnet)
 */

import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import * as fs from "fs"

// RPC Configuration (same as near-account-manager.ts)
function getFastNearUrl(): string {
  const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  return networkId === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com"
}

function getFastNearHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  const apiKey = process.env.FASTNEAR_API_KEY
  if (apiKey) {
    headers["X-API-Key"] = apiKey
  }
  return headers
}

function createRpcProvider() {
  const fastNearUrl = getFastNearUrl()
  return new JsonRpcProvider({ url: fastNearUrl, headers: getFastNearHeaders() })
}

async function checkAccountExists(accountId: string): Promise<boolean> {
  try {
    const rpcUrl = getFastNearUrl()
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getFastNearHeaders() },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "check-account",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
    })
    const data = await response.json()
    return !data.error
  } catch {
    return false
  }
}

async function getAccountBalance(accountId: string): Promise<string> {
  try {
    const rpcUrl = getFastNearUrl()
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getFastNearHeaders() },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "view-account",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
    })
    const data = await response.json()
    if (data.result?.amount) {
      const nearBalance = Number(BigInt(data.result.amount) / BigInt(10 ** 24))
      return `${nearBalance.toFixed(4)} NEAR`
    }
    return "unknown"
  } catch {
    return "error"
  }
}

async function main() {
  // Get environment variables
  const parentAccountId = process.env.NEAR_ACCOUNT_ID
  const parentPrivateKey = process.env.NEAR_PRIVATE_KEY

  if (!parentAccountId || !parentPrivateKey) {
    console.error("Missing NEAR credentials for cleanup script")
    console.error("Run with: doppler run -- pnpm cleanup-orphan-accounts")
    process.exit(1)
  }

  // Get subaccounts file from command line or use default
  const subaccountsFile = process.argv[2] || "/tmp/subaccounts.txt"

  if (!fs.existsSync(subaccountsFile)) {
    console.error(`Subaccounts file not found: ${subaccountsFile}`)
    console.error("Provide a file with one subaccount per line")
    process.exit(1)
  }

  // Read subaccounts
  const content = fs.readFileSync(subaccountsFile, "utf-8")
  const allAccounts = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  // Filter to E2E test accounts for this parent
  const e2eAccounts = allAccounts.filter((id) => id.startsWith("e2e") && id.endsWith(`.${parentAccountId}`))

  console.log(`Cleanup orphan E2E accounts`)
  console.log(`  Parent: ${parentAccountId}`)
  console.log(`  Network: ${process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"}`)
  console.log(`  Total accounts in file: ${allAccounts.length}`)
  console.log(`  E2E accounts to process: ${e2eAccounts.length}`)
  console.log("")

  // Create parent signer
  const parentKeyPair = KeyPair.fromString(parentPrivateKey as KeyPairString)
  const signer = new KeyPairSigner(parentKeyPair)
  const provider = createRpcProvider()

  let deleted = 0
  let failed = 0
  let notFound = 0

  for (const accountId of e2eAccounts) {
    // Check if account still exists
    const exists = await checkAccountExists(accountId)
    if (!exists) {
      console.log(`  ${accountId}: already deleted`)
      notFound++
      continue
    }

    const balance = await getAccountBalance(accountId)

    try {
      // Try to delete using parent key
      const subaccount = new Account(accountId, provider, signer)

      await subaccount.deleteAccount(parentAccountId)

      console.log(`  ${accountId}: deleted (returned ${balance})`)
      deleted++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      // Key not registered = old account before the fix
      if (msg.includes("InvalidAccessKeyError") || msg.includes("does not exist")) {
        console.log(`  ${accountId}: missing parent key (locked ${balance})`)
        failed++
      } else {
        console.log(`  ${accountId}: error - ${msg.slice(0, 80)}`)
        failed++
      }
    }

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log("")
  console.log("=== Summary ===")
  console.log(`  Deleted: ${deleted}`)
  console.log(`  Not found: ${notFound}`)
  console.log(`  Failed: ${failed}`)

  if (failed > 0) {
    console.log("")
    console.log("Note: Some accounts have locked funds from pre-backup accounts")
  }
}

main().catch((error) => {
  console.error("Cleanup script failed:", error)
  process.exit(1)
})
