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
import { logger, LogScope, Op } from "../../lib/logger"

const logContext = { scope: LogScope.E2E, operation: Op.E2E.CLEANUP_ORPHAN_ACCOUNTS }

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
    logger.error("Missing NEAR credentials for cleanup script", {
      ...logContext,
      reason: "missing_env",
    })
    logger.info("Run with: doppler run -- pnpm cleanup-orphan-accounts", {
      ...logContext,
    })
    process.exit(1)
  }

  // Get subaccounts file from command line or use default
  const subaccountsFile = process.argv[2] || "/tmp/subaccounts.txt"

  if (!fs.existsSync(subaccountsFile)) {
    logger.error("Subaccounts file not found", {
      ...logContext,
      subaccounts_file: subaccountsFile,
    })
    logger.info("Provide a file with one subaccount per line", {
      ...logContext,
    })
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

  logger.info("Cleanup orphan E2E accounts", {
    ...logContext,
    parent_account: parentAccountId,
    network: process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet",
    total_accounts: allAccounts.length,
    e2e_accounts: e2eAccounts.length,
  })

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
      logger.info("Account already deleted", {
        ...logContext,
        account_id: accountId,
        status: "already_deleted",
      })
      notFound++
      continue
    }

    const balance = await getAccountBalance(accountId)

    try {
      // Try to delete using parent key
      const subaccount = new Account(accountId, provider, signer)

      await subaccount.deleteAccount(parentAccountId)

      logger.info("Account deleted", {
        ...logContext,
        account_id: accountId,
        status: "deleted",
        balance_returned: balance,
      })
      deleted++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      // Key not registered = old account before the fix
      if (msg.includes("InvalidAccessKeyError") || msg.includes("does not exist")) {
        logger.warn("Account missing parent key", {
          ...logContext,
          account_id: accountId,
          status: "missing_parent_key",
          balance_locked: balance,
        })
        failed++
      } else {
        logger.warn("Account cleanup failed", {
          ...logContext,
          account_id: accountId,
          status: "error",
          error_message: msg.slice(0, 100),
        })
        failed++
      }
    }

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  logger.info("Cleanup summary", {
    ...logContext,
    deleted,
    not_found: notFound,
    failed,
  })

  if (failed > 0) {
    logger.warn("Some accounts have locked funds from pre-backup accounts", {
      ...logContext,
      failed,
    })
  }
}

main().catch((error) => {
  const errorDetails =
    error instanceof Error
      ? { error_type: error.name, error_message: error.message, error_stack: error.stack }
      : { error_message: String(error) }
  logger.error("Cleanup script failed", {
    ...logContext,
    ...errorDetails,
  })
  process.exit(1)
})
