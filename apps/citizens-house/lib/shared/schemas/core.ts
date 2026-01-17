/**
 * Core Schemas
 *
 * Foundational schemas for size limits, attestation IDs, and pagination.
 * These are used across ZK proof validation, contract interactions, and API boundaries.
 */
import { z } from "zod"

// ============================================================================
// Attestation ID Schema
// ============================================================================

/**
 * Attestation ID schema - numeric only (1, 2, 3).
 * Use z.infer<typeof attestationIdSchema> for the type.
 */
export const attestationIdSchema = z
  .union([z.literal(1), z.literal(2), z.literal(3)])
  .describe("Attestation ID (1, 2, or 3)")

export type AttestationId = z.infer<typeof attestationIdSchema>

// ============================================================================
// Size Constraints
// MUST match contracts/verified-accounts/src/lib.rs lines 34-42
// ============================================================================

/**
 * Size limits for verification data.
 * These MUST match the Rust contract's constants.
 */
export const SIZE_LIMITS = {
  NULLIFIER: 80, // MAX_NULLIFIER_LEN - uint256 max = 77 decimal digits
  ATTESTATION_ID: 1, // Self.xyz uses 1, 2, 3
  USER_CONTEXT_DATA: 4096, // MAX_USER_CONTEXT_DATA_LEN
  PROOF_COMPONENT: 80, // MAX_PROOF_COMPONENT_LEN - BN254 field elements ~77 decimal digits
  MAX_BATCH_SIZE: 100, // MAX_BATCH_SIZE - Maximum accounts per batch query
} as const

/**
 * Public signals count per attestation ID.
 * Different attestation types have different signal counts:
 * - Attestation 1 (Passport): 21 signals
 * - Attestation 2 (Passport + Nationality): 21 signals
 * - Attestation 3 (Name): 19 signals
 */
export const PUBLIC_SIGNALS_COUNT: Record<AttestationId, number> = {
  1: 21,
  2: 21,
  3: 19,
} as const

/**
 * Maximum public signals count across all attestation types.
 * Used when attestation ID is unknown or for maximum bounds checking.
 */
export const MAX_PUBLIC_SIGNALS_COUNT = 21

// ============================================================================
// Pagination Schema
// ============================================================================

/**
 * Pagination parameters for list endpoints.
 * page: 0-indexed page number (max 100,000 for safety)
 * pageSize: items per page (1-100, matching MAX_BATCH_SIZE)
 */
export const paginationSchema = z.object({
  page: z.number().int().min(0).max(100000),
  pageSize: z.number().int().min(1).max(SIZE_LIMITS.MAX_BATCH_SIZE),
})

export type Pagination = z.infer<typeof paginationSchema>
