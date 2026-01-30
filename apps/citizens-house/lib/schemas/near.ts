/**
 * NEAR Schemas - Account ID validation and NEP-413 signature schemas.
 */
import { z } from "zod"

// ==================== Signature Validation Constants ====================

/**
 * Constants for NEAR signature validation timing.
 * Used by both token and webhook routes to ensure consistent validation.
 */
export const SIGNATURE_VALIDATION = {
  /** Maximum age of a signature before it's considered expired */
  MAX_AGE_MS: 10 * 60 * 1000, // 10 minutes
  /** Tolerance for clock skew between client and server */
  CLOCK_SKEW_MS: 10 * 1000, // 10 seconds
  /** Required nonce length in bytes */
  NONCE_LENGTH_BYTES: 32,
} as const

// ==================== Account ID Patterns ====================

const NEAR_ACCOUNT_PATTERNS = {
  named: /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/,
  implicit: /^[0-9a-f]{64}$/,
  ethImplicit: /^0x[0-9a-f]{40}$/,
} as const

export const nearNamedAccountSchema = z
  .string()
  .min(2, "Account ID must be at least 2 characters")
  .max(64, "Account ID must be at most 64 characters")
  .regex(NEAR_ACCOUNT_PATTERNS.named, "Invalid NEAR account ID format")

export const nearImplicitAccountSchema = z
  .string()
  .length(64, "Implicit account must be exactly 64 characters")
  .regex(NEAR_ACCOUNT_PATTERNS.implicit, "Invalid implicit account format (must be 64 lowercase hex chars)")

export const ethImplicitAccountSchema = z
  .string()
  .length(42, "ETH-implicit account must be exactly 42 characters")
  .regex(NEAR_ACCOUNT_PATTERNS.ethImplicit, "Invalid ETH-implicit account format (must be 0x + 40 lowercase hex chars)")

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

export function isValidNearAccountId(value: string): boolean {
  return nearAccountIdSchema.safeParse(value).success
}

export function getNearAccountType(value: string): "named" | "implicit" | "eth-implicit" | null {
  if (nearImplicitAccountSchema.safeParse(value).success) return "implicit"
  if (ethImplicitAccountSchema.safeParse(value).success) return "eth-implicit"
  if (nearNamedAccountSchema.safeParse(value).success) return "named"
  return null
}

export const nep413PayloadSchema = z.object({
  message: z.string(),
  nonce: z.string(),
  recipient: z.string(),
  callbackUrl: z.string().nullable().optional(),
})

export type Nep413Payload = z.infer<typeof nep413PayloadSchema>

export const nearSignatureDataSchema = z.object({
  accountId: nearAccountIdSchema,
  signature: z.string(),
  publicKey: z.string(),
  challenge: z.string(),
  timestamp: z.number(),
  nonce: z.string(),
  recipient: z.string(),
})

export type NearSignatureData = z.infer<typeof nearSignatureDataSchema>

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

// NEAR RPC Response Validation Schemas
// Runtime validation for external RPC boundary

const nearAccessKeyPermissionSchema = z.union([
  z.literal("FullAccess"),
  z.object({ FullAccess: z.unknown() }).strict(),
  z
    .object({
      FunctionCall: z.object({
        allowance: z.string().nullable().optional(),
        receiver_id: z.string(),
        method_names: z.array(z.string()),
      }),
    })
    .strict(),
])

export const nearAccessKeyResponseSchema = z.object({
  nonce: z.number(),
  permission: nearAccessKeyPermissionSchema,
  block_height: z.number().optional(),
  block_hash: z.string().optional(),
})

export type NearAccessKeyPermission = z.infer<typeof nearAccessKeyPermissionSchema>

// ==================== Signature Validation Schemas ====================

/**
 * Schema for base64-encoded 32-byte nonce.
 * NEP-413 signatures require exactly 32 bytes of nonce data.
 */
export const nep413NonceSchema = z.string().refine(
  (val) => {
    try {
      const bytes = Buffer.from(val, "base64")
      return bytes.length === SIGNATURE_VALIDATION.NONCE_LENGTH_BYTES
    } catch {
      return false
    }
  },
  { message: `Nonce must be base64-encoded ${SIGNATURE_VALIDATION.NONCE_LENGTH_BYTES} bytes` },
)

/**
 * Schema for fresh signature timestamp (within MAX_AGE + CLOCK_SKEW).
 * Validates that the timestamp is not too old and not in the future (beyond clock skew).
 */
export const freshTimestampSchema = z.number().refine(
  (timestamp) => {
    const now = Date.now()
    const age = now - timestamp
    const { MAX_AGE_MS, CLOCK_SKEW_MS } = SIGNATURE_VALIDATION
    return age <= MAX_AGE_MS + CLOCK_SKEW_MS && age >= -CLOCK_SKEW_MS
  },
  { message: "Signature timestamp expired or in future" },
)

/**
 * Schema for NEAR ed25519 public key format.
 * NEAR public keys are formatted as "ed25519:BASE58_ENCODED_KEY".
 */
export const nearPublicKeySchema = z
  .string()
  .regex(/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/, "Invalid NEAR public key format (expected ed25519:BASE58)")

// ==================== RPC Response Types ====================

/**
 * Access key info from NEAR RPC view_access_key_list response.
 */
export interface AccessKeyInfoView {
  public_key: string
  access_key: {
    nonce: number
    permission:
      | "FullAccess"
      | {
          FunctionCall: {
            allowance: string | null
            receiver_id: string
            method_names: string[]
          }
        }
  }
}

/**
 * Access key list from NEAR RPC view_access_key_list response.
 */
export interface AccessKeyList {
  keys: AccessKeyInfoView[]
}
