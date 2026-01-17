/**
 * ZK Proof Schemas
 *
 * Groth16 ZK proof structure and Self.xyz proof data schemas.
 * Includes verification request schemas for API endpoints.
 */
import { z } from "zod"
import {
  SIZE_LIMITS,
  PUBLIC_SIGNALS_COUNT,
  MAX_PUBLIC_SIGNALS_COUNT,
  attestationIdSchema,
  type AttestationId,
} from "./core"
import { nearAccountIdSchema } from "./near"

// ============================================================================
// ZK Proof Component Schema
// ============================================================================

/**
 * Single ZK proof component (field element).
 * BN254 field elements are ~77 decimal digits max.
 */
export const proofComponentSchema = z.string().max(SIZE_LIMITS.PROOF_COMPONENT)

// ============================================================================
// Groth16 Proof Schema
// ============================================================================

/**
 * Groth16 ZK proof structure (a, b, c points).
 * - a: G1 point (2 field elements)
 * - b: G2 point (2x2 field elements)
 * - c: G1 point (2 field elements)
 */
export const zkProofSchema = z.object({
  a: z.tuple([proofComponentSchema, proofComponentSchema]),
  b: z.tuple([
    z.tuple([proofComponentSchema, proofComponentSchema]),
    z.tuple([proofComponentSchema, proofComponentSchema]),
  ]),
  c: z.tuple([proofComponentSchema, proofComponentSchema]),
})

export type ZkProof = z.infer<typeof zkProofSchema>

// ============================================================================
// Public Signals Schema
// ============================================================================

/**
 * Public signals array with max length validation.
 * Use getPublicSignalsSchema(attestationId) for attestation-specific validation.
 */
export const publicSignalsSchema = z.array(proofComponentSchema).max(MAX_PUBLIC_SIGNALS_COUNT)

export type PublicSignals = z.infer<typeof publicSignalsSchema>

/**
 * Get attestation-specific public signals schema.
 * Different attestation types have different signal counts.
 */
export function getPublicSignalsSchema(attestationId: AttestationId) {
  const expectedCount = PUBLIC_SIGNALS_COUNT[attestationId]
  return z
    .array(proofComponentSchema)
    .length(expectedCount, `Attestation ${attestationId} requires exactly ${expectedCount} public signals`)
}

// ============================================================================
// Self.xyz Proof Data Schema
// ============================================================================

/**
 * Self.xyz proof data for async verification.
 * Combines ZK proof with public signals.
 */
export const selfProofDataSchema = z.object({
  proof: zkProofSchema,
  publicSignals: publicSignalsSchema,
})

export type SelfProofData = z.infer<typeof selfProofDataSchema>

// ============================================================================
// Verification Request Schema
// ============================================================================

/**
 * API request schema for verification endpoint.
 * Validates incoming proof data before processing.
 */
export const verifyRequestSchema = z.object({
  attestationId: attestationIdSchema,
  proof: zkProofSchema,
  publicSignals: publicSignalsSchema,
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
})

export type VerifyRequest = z.infer<typeof verifyRequestSchema>

// ============================================================================
// Nullifier Schema
// ============================================================================

/**
 * Nullifier string with max length validation.
 * Used for Sybil resistance (unique passport identifier).
 */
export const nullifierSchema = z.string().max(SIZE_LIMITS.NULLIFIER)

export type Nullifier = z.infer<typeof nullifierSchema>

// ============================================================================
// Verification Data Schemas
// ============================================================================

/**
 * Base verification data (nullifier, account, attestation).
 */
export const verificationDataSchema = z.object({
  nullifier: nullifierSchema,
  nearAccountId: nearAccountIdSchema,
  attestationId: attestationIdSchema,
})

export type VerificationData = z.infer<typeof verificationDataSchema>

/**
 * Verification summary (no ZK proof data).
 * Use this for lightweight queries.
 */
export const verificationSummarySchema = z.object({
  nullifier: nullifierSchema,
  nearAccountId: nearAccountIdSchema,
  attestationId: attestationIdSchema,
  verifiedAt: z.number(),
})

export type VerificationSummary = z.output<typeof verificationSummarySchema>

/**
 * Full verification record with ZK proof.
 * Use VerificationSummary for queries that don't need proof data.
 */
export const verificationSchema = z.object({
  nullifier: nullifierSchema,
  nearAccountId: nearAccountIdSchema,
  attestationId: attestationIdSchema,
  verifiedAt: z.number(),
  selfProof: selfProofDataSchema,
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
})

export type Verification = z.output<typeof verificationSchema>
