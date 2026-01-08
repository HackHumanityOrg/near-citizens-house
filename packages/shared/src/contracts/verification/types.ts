/**
 * Verification Contract Types
 *
 * Zod schemas and TypeScript types for the verified-accounts smart contract.
 * Includes Self.xyz ZK proof schemas, NEAR signature schemas, and contract response transforms.
 */
import { z } from "zod"

// ============================================================================
// Size Constraints
// MUST match contracts/verified-accounts/src/lib.rs lines 34-42
// ============================================================================
export const SIZE_LIMITS = {
  NULLIFIER: 80, // MAX_NULLIFIER_LEN - uint256 max = 77 decimal digits
  ATTESTATION_ID: 1, // MAX_ATTESTATION_ID_LEN - Self.xyz uses "1", "2", "3"
  USER_CONTEXT_DATA: 4096, // MAX_USER_CONTEXT_DATA_LEN
  PUBLIC_SIGNALS_COUNT: 21, // MAX_PUBLIC_SIGNALS_COUNT - Passport proofs have 21 signals
  PROOF_COMPONENT: 80, // MAX_PROOF_COMPONENT_LEN - BN254 field elements ~77 decimal digits
  MAX_BATCH_SIZE: 100, // MAX_BATCH_SIZE - Maximum accounts per batch query
} as const

// ============================================================================
// ZK Proof Schemas
// ============================================================================

// Groth16 ZK proof structure (a, b, c points)
export const zkProofSchema = z.object({
  a: z.tuple([z.string().max(SIZE_LIMITS.PROOF_COMPONENT), z.string().max(SIZE_LIMITS.PROOF_COMPONENT)]),
  b: z.tuple([
    z.tuple([z.string().max(SIZE_LIMITS.PROOF_COMPONENT), z.string().max(SIZE_LIMITS.PROOF_COMPONENT)]),
    z.tuple([z.string().max(SIZE_LIMITS.PROOF_COMPONENT), z.string().max(SIZE_LIMITS.PROOF_COMPONENT)]),
  ]),
  c: z.tuple([z.string().max(SIZE_LIMITS.PROOF_COMPONENT), z.string().max(SIZE_LIMITS.PROOF_COMPONENT)]),
})

export type ZkProof = z.infer<typeof zkProofSchema>

// Self.xyz proof data for async verification
export const selfProofDataSchema = z.object({
  proof: zkProofSchema,
  publicSignals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(SIZE_LIMITS.PUBLIC_SIGNALS_COUNT),
})

export type SelfProofData = z.infer<typeof selfProofDataSchema>

// ============================================================================
// NEP-413 Schemas
// ============================================================================

// NEP-413 payload structure for NEAR message signing
// Used for validation and type inference; Borsh schema is used for serialization
export const nep413PayloadSchema = z.object({
  message: z.string(),
  nonce: z.instanceof(Uint8Array).or(z.array(z.number()).length(32)), // 32-byte nonce
  recipient: z.string(),
  callbackUrl: z.string().nullable().optional(),
})

export type Nep413Payload = z.infer<typeof nep413PayloadSchema>

// ============================================================================
// NEAR Signature Schemas
// ============================================================================

// NEAR wallet signature data (NEP-413)
export const nearSignatureDataSchema = z.object({
  accountId: z.string(),
  signature: z.string(),
  publicKey: z.string(),
  challenge: z.string(),
  timestamp: z.number(),
  nonce: z.array(z.number()).length(32), // NEP-413 nonce (32 bytes)
  recipient: z.string(), // NEP-413 recipient
})

export type NearSignatureData = z.infer<typeof nearSignatureDataSchema>

// ============================================================================
// Verification Request/Response Schemas
// ============================================================================

// API request schema for verification endpoint
export const verifyRequestSchema = z.object({
  attestationId: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  proof: zkProofSchema,
  publicSignals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(SIZE_LIMITS.PUBLIC_SIGNALS_COUNT),
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
})

export type VerifyRequest = z.infer<typeof verifyRequestSchema>

// ============================================================================
// Verification Error Types
// ============================================================================

// All possible verification error codes
export const verificationErrorCodeSchema = z.enum([
  "MISSING_FIELDS",
  "VERIFICATION_FAILED",
  "OFAC_CHECK_FAILED",
  "NULLIFIER_MISSING",
  "NEAR_SIGNATURE_INVALID",
  "NEAR_SIGNATURE_MISSING",
  "SIGNATURE_EXPIRED",
  "SIGNATURE_TIMESTAMP_INVALID",
  "DUPLICATE_PASSPORT",
  "STORAGE_FAILED",
  "INTERNAL_ERROR",
])

export type VerificationErrorCode = z.infer<typeof verificationErrorCodeSchema>

// Error messages mapped to codes
export const VERIFICATION_ERROR_MESSAGES: Record<VerificationErrorCode, string> = {
  MISSING_FIELDS: "Missing required fields",
  VERIFICATION_FAILED: "Verification failed",
  OFAC_CHECK_FAILED: "OFAC verification failed",
  NULLIFIER_MISSING: "Nullifier missing from proof",
  NEAR_SIGNATURE_INVALID: "NEAR signature verification failed",
  NEAR_SIGNATURE_MISSING: "Invalid or missing NEAR signature data",
  SIGNATURE_EXPIRED: "Signature expired",
  SIGNATURE_TIMESTAMP_INVALID: "Invalid signature timestamp",
  DUPLICATE_PASSPORT: "This passport has already been registered",
  STORAGE_FAILED: "Failed to store verification",
  INTERNAL_ERROR: "Internal server error",
} as const

// Verification error response schema
export const verificationErrorSchema = z.object({
  status: z.literal("error"),
  result: z.literal(false),
  code: verificationErrorCodeSchema,
  reason: z.string(),
})

export type VerificationError = z.infer<typeof verificationErrorSchema>

// Helper to create typed error responses
export function createVerificationError(code: VerificationErrorCode, details?: string): VerificationError {
  const baseMessage = VERIFICATION_ERROR_MESSAGES[code]
  return {
    status: "error",
    result: false,
    code,
    reason: details ? `${baseMessage}: ${details}` : baseMessage,
  }
}

// ============================================================================
// Verification Result Schema
// ============================================================================

// Self.xyz verification result (API response) - discriminated union for type safety
export const selfVerificationResultSchema = z.discriminatedUnion("status", [
  // Success case - attestationId and userData are required
  z.object({
    status: z.literal("success"),
    result: z.literal(true),
    attestationId: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    userData: z.object({
      userId: z.string(),
      nearAccountId: z.string(),
      nearSignature: z.string(),
    }),
    discloseOutput: z
      .object({
        nullifier: z.string().optional(), // Unique passport identifier for Sybil resistance
      })
      .catchall(z.unknown()) // Allow other fields from Self.xyz
      .optional(),
  }),
  // Error case - code and reason are required
  verificationErrorSchema,
])

export type SelfVerificationResult = z.infer<typeof selfVerificationResultSchema>

// ============================================================================
// Database Schemas
// ============================================================================

// Base verification data
export const verificationDataSchema = z.object({
  nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
  nearAccountId: z.string(),
  attestationId: z.string().max(SIZE_LIMITS.ATTESTATION_ID),
})

export type VerificationData = z.infer<typeof verificationDataSchema>

// Verification data with NEAR signature and Self proof for on-chain verification
export const verificationDataWithSignatureSchema = verificationDataSchema.extend({
  signatureData: nearSignatureDataSchema,
  selfProofData: selfProofDataSchema,
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA), // Original hex-encoded userContextData
})

export type VerificationDataWithSignature = z.infer<typeof verificationDataWithSignatureSchema>

// Full verification record (stored in database/contract)
// Includes ZK proof data - use VerificationSummary for lightweight queries
export const verificationSchema = z.object({
  nullifier: z.string().max(SIZE_LIMITS.NULLIFIER), // Unique passport identifier (prevents duplicate registrations)
  nearAccountId: z.string(), // Associated NEAR wallet
  attestationId: z.string().max(SIZE_LIMITS.ATTESTATION_ID),
  verifiedAt: z.number(),
  selfProof: selfProofDataSchema, // Self.xyz ZK proof for async verification
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA), // Original hex-encoded userContextData for Self.xyz re-verification
})

export type Verification = z.infer<typeof verificationSchema>

// Lightweight verification summary (no ZK proof data)
// Use this for most queries to save bandwidth
export const verificationSummarySchema = z.object({
  nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
  nearAccountId: z.string(),
  attestationId: z.string().max(SIZE_LIMITS.ATTESTATION_ID),
  verifiedAt: z.number(),
})

export type VerificationSummary = z.infer<typeof verificationSummarySchema>

// ============================================================================
// Verification Utility Schemas
// ============================================================================

// Parsed NEAR signature data from user context (subset of nearSignatureDataSchema)
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

// Proof data for verification (combines nullifier, user info, and ZK proof)
export const proofDataSchema = z.object({
  nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
  attestationId: z.string().max(SIZE_LIMITS.ATTESTATION_ID),
  verifiedAt: z.number(),
  zkProof: zkProofSchema,
  publicSignals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(SIZE_LIMITS.PUBLIC_SIGNALS_COUNT),
  signature: z.object({
    accountId: z.string(),
    publicKey: z.string(),
    signature: z.string(),
    nonce: z.string(), // base64 encoded 32-byte nonce
    challenge: z.string(),
    recipient: z.string(),
  }),
  userContextData: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA), // raw hex-encoded data
  nearSignatureVerification: z.object({
    nep413Hash: z.string(), // SHA-256 hash of NEP-413 formatted message (hex)
    publicKeyHex: z.string(), // Raw Ed25519 public key (hex)
    signatureHex: z.string(), // Signature in hex
  }),
})

export type ProofData = z.infer<typeof proofDataSchema>

// ============================================================================
// Contract Input Format Schemas (snake_case for Rust)
// ============================================================================
// These schemas define the format for data sent TO the contract

// Contract input format for Self proof data (snake_case)
export const contractSelfProofInputSchema = z.object({
  proof: zkProofSchema,
  public_signals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(SIZE_LIMITS.PUBLIC_SIGNALS_COUNT),
})

export type ContractSelfProofInput = z.infer<typeof contractSelfProofInputSchema>

// Contract input format for NEAR signature data (snake_case, matches Rust struct)
export const contractSignatureInputSchema = z.object({
  account_id: z.string(),
  signature: z.array(z.number()), // Vec<u8> in Rust
  public_key: z.string(),
  challenge: z.string(),
  nonce: z.array(z.number()).length(32), // Vec<u8> - 32 bytes
  recipient: z.string(),
})

export type ContractSignatureInput = z.infer<typeof contractSignatureInputSchema>

// ============================================================================
// Contract Response Format Schemas (snake_case from Rust)
// ============================================================================
// These schemas validate contract responses and transform snake_case to camelCase

// Contract format for SelfProofData (with transform to app format)
export const contractSelfProofDataSchema = z
  .object({
    proof: zkProofSchema, // ZkProof fields don't have underscores
    public_signals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(SIZE_LIMITS.PUBLIC_SIGNALS_COUNT),
  })
  .transform((data) => ({
    proof: data.proof,
    publicSignals: data.public_signals,
  }))

// Contract format for Verification (full record with ZK proof, with transform to app format)
export const contractVerificationSchema = z
  .object({
    nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
    near_account_id: z.string(),
    attestation_id: z.string().max(SIZE_LIMITS.ATTESTATION_ID),
    verified_at: z.number(), // nanoseconds
    self_proof: z.object({
      proof: zkProofSchema,
      public_signals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(SIZE_LIMITS.PUBLIC_SIGNALS_COUNT),
    }),
    user_context_data: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    attestationId: data.attestation_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
    selfProof: {
      proof: data.self_proof.proof,
      publicSignals: data.self_proof.public_signals,
    },
    userContextData: data.user_context_data,
  }))

export type ContractVerification = z.input<typeof contractVerificationSchema>
export type TransformedVerification = z.output<typeof contractVerificationSchema>

// Contract format for VerificationSummary (lightweight, with transform to app format)
export const contractVerificationSummarySchema = z
  .object({
    nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
    near_account_id: z.string(),
    attestation_id: z.string().max(SIZE_LIMITS.ATTESTATION_ID),
    verified_at: z.number(), // nanoseconds
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    attestationId: data.attestation_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000), // Convert nanoseconds to milliseconds
  }))

export type ContractVerificationSummary = z.input<typeof contractVerificationSummarySchema>
export type TransformedVerificationSummary = z.output<typeof contractVerificationSummarySchema>

// ============================================================================
// Verification Database Interface
// ============================================================================

export interface IVerificationDatabase {
  isVerified(nearAccountId: string): Promise<boolean>
  storeVerification(data: VerificationDataWithSignature): Promise<void>
  getVerification(nearAccountId: string): Promise<VerificationSummary | null>
  getFullVerification(nearAccountId: string): Promise<Verification | null>
  listVerifications(fromIndex?: number, limit?: number): Promise<{ accounts: Verification[]; total: number }>
}
