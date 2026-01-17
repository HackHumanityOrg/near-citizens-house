/**
 * NEAR Schemas
 *
 * Account ID validation, NEP-413 signature schemas, and user context parsing.
 * Based on the official NEAR Protocol specification:
 * - https://nomicon.io/DataStructures/Account
 * - https://docs.near.org/protocol/account-id
 */
import { z } from "zod"

// ============================================================================
// NEAR Account ID Patterns
// ============================================================================

/**
 * Regex patterns for NEAR account validation.
 * Exported for use in contexts where zod isn't available.
 */
export const NEAR_ACCOUNT_PATTERNS = {
  /** Named account: 2-64 chars, lowercase alphanumeric + separators (., _, -) */
  named: /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/,
  /** Implicit account: 64 lowercase hex chars (ED25519 public key) */
  implicit: /^[0-9a-f]{64}$/,
  /** ETH-implicit: 0x + 40 lowercase hex chars */
  ethImplicit: /^0x[0-9a-f]{40}$/,
} as const

// ============================================================================
// NEAR Account ID Schemas
// ============================================================================

/**
 * Named account: 2-64 chars, lowercase alphanumeric + separators (., _, -)
 * Examples: alice.near, bob_99.testnet
 */
export const nearNamedAccountSchema = z
  .string()
  .min(2, "Account ID must be at least 2 characters")
  .max(64, "Account ID must be at most 64 characters")
  .regex(NEAR_ACCOUNT_PATTERNS.named, "Invalid NEAR account ID format")

/**
 * Implicit account: 64 lowercase hex chars (ED25519 public key hash)
 */
export const nearImplicitAccountSchema = z
  .string()
  .length(64, "Implicit account must be exactly 64 characters")
  .regex(NEAR_ACCOUNT_PATTERNS.implicit, "Invalid implicit account format (must be 64 lowercase hex chars)")

/**
 * ETH-implicit account: 0x + 40 lowercase hex chars (Ethereum/Secp256k1 key)
 */
export const ethImplicitAccountSchema = z
  .string()
  .length(42, "ETH-implicit account must be exactly 42 characters")
  .regex(NEAR_ACCOUNT_PATTERNS.ethImplicit, "Invalid ETH-implicit account format (must be 0x + 40 lowercase hex chars)")

/**
 * Any valid NEAR account ID (named, implicit, or ETH-implicit).
 * Use this schema when accepting any type of NEAR account.
 */
export const nearAccountIdSchema = z
  .string()
  .refine(
    (val) =>
      nearImplicitAccountSchema.safeParse(val).success ||
      ethImplicitAccountSchema.safeParse(val).success ||
      nearNamedAccountSchema.safeParse(val).success,
    {
      message:
        "Invalid NEAR account ID (named: 2-64 chars a-z0-9._-, implicit: 64 hex chars, or ETH-implicit: 0x + 40 hex chars)",
    },
  )

export type NearAccountId = z.infer<typeof nearAccountIdSchema>

// ============================================================================
// NEAR Account ID Helpers
// ============================================================================

/**
 * Check if a string is a valid NEAR account ID.
 * Returns a boolean without throwing exceptions.
 */
export function isValidNearAccountId(value: string): boolean {
  return nearAccountIdSchema.safeParse(value).success
}

/**
 * Determine the type of a NEAR account ID.
 * Returns null if the account ID is invalid.
 */
export function getNearAccountType(value: string): "named" | "implicit" | "eth-implicit" | null {
  if (nearImplicitAccountSchema.safeParse(value).success) return "implicit"
  if (ethImplicitAccountSchema.safeParse(value).success) return "eth-implicit"
  if (nearNamedAccountSchema.safeParse(value).success) return "named"
  return null
}

// ============================================================================
// NEP-413 Signature Schemas
// ============================================================================

/**
 * NEP-413 payload structure for NEAR message signing.
 * Used for validation and type inference; Borsh schema is used for serialization.
 * Nonce is base64 encoded for consistency across all boundaries.
 */
export const nep413PayloadSchema = z.object({
  message: z.string(),
  nonce: z.string(), // base64 encoded 32-byte nonce
  recipient: z.string(),
  callbackUrl: z.string().nullable().optional(),
})

export type Nep413Payload = z.infer<typeof nep413PayloadSchema>

/**
 * NEAR wallet signature data (NEP-413).
 * Full signature data including challenge, timestamp, and recipient.
 * All binary fields (signature, nonce) are base64 encoded strings.
 */
export const nearSignatureDataSchema = z.object({
  accountId: nearAccountIdSchema,
  signature: z.string(), // base64 encoded 64-byte signature
  publicKey: z.string(), // ed25519:BASE58 format
  challenge: z.string(),
  timestamp: z.number(),
  nonce: z.string(), // base64 encoded 32-byte nonce
  recipient: z.string(), // NEP-413 recipient
})

export type NearSignatureData = z.infer<typeof nearSignatureDataSchema>

/**
 * Parsed NEAR signature data from user context.
 * Subset of nearSignatureDataSchema with optional challenge/recipient.
 */
export const parsedSignatureDataSchema = nearSignatureDataSchema
  .pick({
    accountId: true,
    signature: true,
    publicKey: true,
    nonce: true,
    challenge: true,
    recipient: true,
  })
  .partial({
    challenge: true,
    recipient: true,
  })

export type ParsedSignatureData = z.infer<typeof parsedSignatureDataSchema>

// ============================================================================
// User Defined Data Schema (Self.xyz context)
// ============================================================================

/**
 * Schema for the NEAR signature data embedded in Self.xyz userDefinedData.
 * This is the JSON structure inside the hex-encoded userContextData.
 * Nonce is base64 encoded for consistent handling.
 */
export const userDefinedDataSchema = z.object({
  accountId: nearAccountIdSchema,
  signature: z.string(), // base64 encoded
  publicKey: z.string(), // ed25519:BASE58 format
  nonce: z.string(), // base64 encoded 32-byte nonce
  timestamp: z.number().optional(),
})

export type UserDefinedData = z.infer<typeof userDefinedDataSchema>

/**
 * Parse userDefinedData from Self.xyz to extract signature JSON.
 * Handles hex-encoded strings, byte arrays, and object formats.
 *
 * @returns The parsed JSON string, or null if parsing fails
 */
export function parseUserDefinedDataRaw(userDefinedDataRaw: unknown): string | null {
  if (!userDefinedDataRaw) return null

  let jsonString = ""

  if (typeof userDefinedDataRaw === "string") {
    // Check if it's hex-encoded
    if (userDefinedDataRaw.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(userDefinedDataRaw)) {
      jsonString = Buffer.from(userDefinedDataRaw, "hex").toString("utf8")
    } else {
      jsonString = userDefinedDataRaw
    }
  } else if (Array.isArray(userDefinedDataRaw)) {
    jsonString = new TextDecoder().decode(new Uint8Array(userDefinedDataRaw))
  } else if (typeof userDefinedDataRaw === "object" && userDefinedDataRaw !== null) {
    const values = Object.values(userDefinedDataRaw)
    if (values.every((v) => typeof v === "number")) {
      jsonString = new TextDecoder().decode(new Uint8Array(values as number[]))
    }
  }

  if (!jsonString) return null

  // Strip null bytes
  jsonString = jsonString.replace(/\0/g, "")

  // Extract JSON object
  const firstBrace = jsonString.indexOf("{")
  const lastBrace = jsonString.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return jsonString.substring(firstBrace, lastBrace + 1)
  }

  return jsonString
}
