/**
 * Contract Schemas
 *
 * Schemas for NEAR smart contract input/output formats.
 * Handles snake_case to camelCase transforms for Rust interop.
 *
 * Only schemas used for runtime parsing are exported (contractVerificationSchema,
 * contractVerificationSummarySchema). Other schemas are internal; their inferred
 * types are exported for use in application code.
 */
import { z } from "zod"
import { SIZE_LIMITS, MAX_PUBLIC_SIGNALS_COUNT, attestationIdSchema, type AttestationId } from "./core"
import { zkProofSchema, type ZkProof, type VerificationData, type SelfProofData } from "./zk-proof"
import { nearAccountIdSchema, type NearSignatureData, type NearAccountId } from "./near"

// ============================================================================
// Verification Data with Signature
// ============================================================================

/**
 * Verification data with NEAR signature and Self proof for on-chain verification.
 */
export interface VerificationDataWithSignature extends VerificationData {
  signatureData: NearSignatureData
  selfProofData: SelfProofData
  userContextData: string
}

// ============================================================================
// Proof Data (for verification display)
// ============================================================================

/**
 * Proof data for verification display (combines nullifier, user info, and ZK proof).
 */
export interface ProofData {
  nullifier: string
  attestationId: AttestationId
  verifiedAt: number
  zkProof: ZkProof
  publicSignals: string[]
  signature: {
    accountId: NearAccountId
    publicKey: string
    signature: string
    nonce: string // base64 encoded 32-byte nonce
    challenge: string
    recipient: string
  }
  userContextData: string
  nearSignatureVerification: {
    nep413Hash: string // SHA-256 hash of NEP-413 formatted message (hex)
    publicKeyHex: string // Raw Ed25519 public key (hex)
    signatureHex: string // Signature in hex
  }
}

// ============================================================================
// Contract Input Types (snake_case for Rust)
// ============================================================================

/**
 * Contract input format for Self proof data (snake_case).
 */
export interface ContractSelfProofInput {
  proof: ZkProof
  public_signals: string[]
}

/**
 * Contract input format for NEAR signature data (snake_case, matches Rust struct).
 */
export interface ContractSignatureInput {
  account_id: NearAccountId
  signature: number[] // Vec<u8> in Rust
  public_key: string
  challenge: string
  nonce: number[] // Vec<u8> - 32 bytes
  recipient: string
}

/**
 * Contract format for Verification (full record with ZK proof, with transform to app format).
 */
export const contractVerificationSchema = z
  .object({
    nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
    near_account_id: nearAccountIdSchema,
    attestation_id: attestationIdSchema,
    verified_at: z.number(), // nanoseconds
    self_proof: z.object({
      proof: zkProofSchema,
      public_signals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(MAX_PUBLIC_SIGNALS_COUNT),
    }),
    user_context_data: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    attestationId: Number(data.attestation_id) as AttestationId,
    verifiedAt: Math.floor(data.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
    selfProof: {
      proof: data.self_proof.proof,
      publicSignals: data.self_proof.public_signals,
    },
    userContextData: data.user_context_data,
  }))

export type ContractVerification = z.input<typeof contractVerificationSchema>
export type TransformedVerification = z.output<typeof contractVerificationSchema>

/**
 * Contract format for VerificationSummary (lightweight, with transform to app format).
 */
export const contractVerificationSummarySchema = z
  .object({
    nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
    near_account_id: nearAccountIdSchema,
    attestation_id: attestationIdSchema,
    verified_at: z.number(), // nanoseconds
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    attestationId: Number(data.attestation_id) as AttestationId,
    verifiedAt: Math.floor(data.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
  }))

export type ContractVerificationSummary = z.input<typeof contractVerificationSummarySchema>
export type TransformedVerificationSummary = z.output<typeof contractVerificationSummarySchema>
