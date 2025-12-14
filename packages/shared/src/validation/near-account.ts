import { z } from "zod"

/**
 * NEAR Account ID Validation
 *
 * Based on the official NEAR Protocol specification:
 * - https://nomicon.io/DataStructures/Account
 * - https://docs.near.org/protocol/account-id
 *
 * Supports three account types:
 * 1. Named accounts: 2-64 chars, lowercase alphanumeric + separators (., _, -)
 * 2. Implicit accounts: 64 lowercase hex chars (ED25519 public key)
 * 3. ETH-implicit accounts: 0x + 40 lowercase hex chars
 */

// Official NEAR regex from nomicon.io (without length check)
// Ensures: start/end with alphanumeric, no consecutive separators, dots separate parts
const NEAR_NAMED_ACCOUNT_REGEX = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/

// Implicit account patterns
const NEAR_IMPLICIT_REGEX = /^[0-9a-f]{64}$/ // ED25519 public key (64 hex chars)
const ETH_IMPLICIT_REGEX = /^0x[0-9a-f]{40}$/ // Ethereum-style (0x + 40 hex chars)

/**
 * Validates a NEAR named account ID (e.g., alice.near, bob_99.testnet)
 *
 * Rules:
 * - Length: 2-64 characters
 * - Characters: lowercase a-z, digits 0-9, separators (., _, -)
 * - Must start and end with alphanumeric
 * - No consecutive separators
 * - Dots separate subaccount parts
 */
export const nearNamedAccountSchema = z
  .string()
  .min(2, "Account ID must be at least 2 characters")
  .max(64, "Account ID must be at most 64 characters")
  .regex(NEAR_NAMED_ACCOUNT_REGEX, "Invalid NEAR account ID format")

/**
 * Validates a NEAR implicit account (64 hex chars)
 * These are derived from ED25519 public keys
 */
export const nearImplicitAccountSchema = z
  .string()
  .length(64, "Implicit account must be exactly 64 characters")
  .regex(NEAR_IMPLICIT_REGEX, "Invalid implicit account format (must be 64 lowercase hex chars)")

/**
 * Validates an ETH-implicit account (0x + 40 hex chars)
 * These are derived from Ethereum/Secp256k1 keys
 */
export const ethImplicitAccountSchema = z
  .string()
  .length(42, "ETH-implicit account must be exactly 42 characters")
  .regex(ETH_IMPLICIT_REGEX, "Invalid ETH-implicit account format (must be 0x + 40 lowercase hex chars)")

/**
 * Validates any valid NEAR account ID (named, implicit, or ETH-implicit)
 *
 * Use this schema when accepting any type of NEAR account.
 * For stricter validation, use the specific schemas above.
 */
export const nearAccountIdSchema = z.string().refine(
  (val) => {
    // Implicit account (64 hex)
    if (NEAR_IMPLICIT_REGEX.test(val)) return true
    // ETH-implicit (0x + 40 hex)
    if (ETH_IMPLICIT_REGEX.test(val)) return true
    // Named account (2-64 chars, spec regex)
    if (val.length >= 2 && val.length <= 64 && NEAR_NAMED_ACCOUNT_REGEX.test(val)) return true
    return false
  },
  {
    message:
      "Invalid NEAR account ID (named: 2-64 chars a-z0-9._-, implicit: 64 hex chars, or ETH-implicit: 0x + 40 hex chars)",
  },
)

/**
 * Type for a valid NEAR account ID
 */
export type NearAccountId = z.infer<typeof nearAccountIdSchema>

/**
 * Regex patterns for NEAR account validation
 * Exported for use in contexts where zod isn't available (e.g., regex-only validation)
 */
export const NEAR_ACCOUNT_PATTERNS = {
  /** Named account: 2-64 chars, lowercase alphanumeric + separators */
  named: NEAR_NAMED_ACCOUNT_REGEX,
  /** Implicit account: 64 lowercase hex chars */
  implicit: NEAR_IMPLICIT_REGEX,
  /** ETH-implicit: 0x + 40 lowercase hex chars */
  ethImplicit: ETH_IMPLICIT_REGEX,
} as const

/**
 * Helper function to check if a string is a valid NEAR account ID
 * Useful when you need a boolean check without zod
 */
export function isValidNearAccountId(value: string): boolean {
  return nearAccountIdSchema.safeParse(value).success
}

/**
 * Helper function to determine the type of a NEAR account ID
 * Returns null if the account ID is invalid
 */
export function getNearAccountType(value: string): "named" | "implicit" | "eth-implicit" | null {
  if (NEAR_IMPLICIT_REGEX.test(value)) return "implicit"
  if (ETH_IMPLICIT_REGEX.test(value)) return "eth-implicit"
  if (value.length >= 2 && value.length <= 64 && NEAR_NAMED_ACCOUNT_REGEX.test(value)) return "named"
  return null
}
