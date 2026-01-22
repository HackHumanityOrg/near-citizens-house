/**
 * Server-only NEAR signature verification utilities.
 *
 * These utilities require server-side access to NEAR RPC and should only be
 * imported in API routes, not in client components.
 *
 * NOTE: This module is server-only because it uses the RPC provider.
 */
import "server-only"

import { getRpcProvider } from "./providers/rpc-provider"
import { nearAccessKeyResponseSchema, type NearAccountId, type NearAccessKeyPermission } from "./schemas/near"

/**
 * Result of full-access key check.
 */
export interface FullAccessKeyResult {
  isFullAccess: boolean
  error?: string
}

/**
 * Check if a permission represents full access.
 */
function isFullAccessPermission(permission: NearAccessKeyPermission): boolean {
  if (permission === "FullAccess") return true
  if (typeof permission === "object" && "FullAccess" in permission) return true
  return false
}

/**
 * Check if a public key is a full-access key for the given account via NEAR RPC.
 *
 * This verifies that:
 * 1. The account exists
 * 2. The public key is registered as an access key
 * 3. The key has FullAccess permission (not a function call key)
 */
export async function hasFullAccessKey(accountId: NearAccountId, publicKey: string): Promise<FullAccessKeyResult> {
  const provider = getRpcProvider()

  try {
    const rawResponse = await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    })

    const parseResult = nearAccessKeyResponseSchema.safeParse(rawResponse)
    if (!parseResult.success) {
      return { isFullAccess: false, error: "Invalid RPC response format" }
    }

    if (!isFullAccessPermission(parseResult.data.permission)) {
      return { isFullAccess: false, error: "Public key is not a full-access key" }
    }

    return { isFullAccess: true }
  } catch (error) {
    // RPC errors typically mean the key doesn't exist or account doesn't exist
    const message = error instanceof Error ? error.message : "Unknown error"

    // Common RPC error patterns
    if (message.includes("does not exist") || message.includes("UnknownAccessKey")) {
      return { isFullAccess: false, error: "Public key not found for account" }
    }
    if (message.includes("UnknownAccount")) {
      return { isFullAccess: false, error: "Account not found" }
    }

    return { isFullAccess: false, error: `RPC error: ${message}` }
  }
}
