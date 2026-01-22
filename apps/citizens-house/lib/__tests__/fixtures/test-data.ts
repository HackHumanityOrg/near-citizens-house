/**
 * Test Data Fixtures for @/lib tests
 *
 * Contains synthetic test data for unit tests.
 */

import type { NearAccountId } from "../../schemas/near"

// ============================================================================
// NEP-413 Test Data
// ============================================================================

/**
 * Standard 32-byte nonce filled with zeros (base64 encoded)
 */
export const zeroNonce = Buffer.alloc(32, 0).toString("base64")

/**
 * Random nonce for variety tests (base64 encoded)
 */
export const randomNonce = Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 13) % 256)).toString("base64")

/**
 * Max value nonce (all 0xFF) (base64 encoded)
 */
export const maxNonce = Buffer.alloc(32, 255).toString("base64")

/**
 * Sequential nonce (0, 1, 2, ..., 31) (base64 encoded)
 */
export const sequentialNonce = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64")

// ============================================================================
// Account Test Data
// ============================================================================

export const testAccountIds = {
  alice: "alice.testnet",
  bob: "bob.testnet",
  charlie: "charlie.testnet",
  longName: "a".repeat(64) + ".testnet",
  unicode: "тест.testnet", // May not be valid, but tests edge case
}

// ============================================================================
// User Context Test Data
// ============================================================================

/**
 * Create a valid user context JSON object
 * @param nonce - base64 encoded 32-byte nonce
 */
export function createUserContext(accountId: NearAccountId, signature: string, publicKey: string, nonce: string) {
  return {
    accountId,
    signature,
    publicKey,
    nonce, // already base64 encoded
  }
}

/**
 * Convert user context to hex-encoded string
 */
export function userContextToHex(context: object): string {
  return Buffer.from(JSON.stringify(context)).toString("hex")
}

// ============================================================================
// Size Limits (from contracts/verified-accounts-interface)
// ============================================================================

export const SizeLimits = {
  SUMSUB_APPLICANT_ID: 80,
  USER_ID: 80,
  USER_CONTEXT_DATA: 4096,
  MAX_BATCH_SIZE: 100,
  NONCE_LENGTH: 32,
  SIGNATURE_LENGTH: 64,
} as const
