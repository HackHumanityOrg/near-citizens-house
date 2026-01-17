/**
 * Verification Contract Schemas - NEAR smart contract I/O types with snake_case ↔ camelCase transforms.
 *
 * This file handles the boundary between TypeScript (camelCase) and the NEAR contract (snake_case):
 * - `contractVerificationSchema` - Parses contract output (snake_case) to app format (camelCase)
 * - `ContractSelfProofInput`, `ContractSignatureInput` - Contract input types (snake_case)
 * - `VerificationDataWithSignature`, `ProofData` - Extended types for storage and display
 *
 * For Self.xyz SDK types and app-facing verification records, see `selfxyz.ts`.
 */
import { z } from "zod"
import { SIZE_LIMITS } from "./core"
import { nearAccountIdSchema, type NearSignatureData, type NearAccountId } from "./near"
import {
  MAX_PUBLIC_SIGNALS_COUNT,
  attestationIdSchema,
  type AttestationId,
  zkProofSchema,
  type ZkProof,
  type SelfProofData,
  type VerificationData,
} from "./selfxyz"

export interface VerificationDataWithSignature extends VerificationData {
  signatureData: NearSignatureData
  selfProofData: SelfProofData
  userContextData: string
}

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
    nonce: string
    challenge: string
    recipient: string
  }
  userContextData: string
  nearSignatureVerification: {
    nep413Hash: string
    publicKeyHex: string
    signatureHex: string
  }
}

export interface ContractSelfProofInput {
  proof: ZkProof
  public_signals: string[]
}

export interface ContractSignatureInput {
  account_id: NearAccountId
  signature: string
  public_key: string
  challenge: string
  nonce: string
  recipient: string
}

export const contractVerificationSchema = z
  .object({
    nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
    near_account_id: nearAccountIdSchema,
    attestation_id: attestationIdSchema,
    verified_at: z.number(),
    self_proof: z.object({
      proof: zkProofSchema,
      public_signals: z.array(z.string().max(SIZE_LIMITS.PROOF_COMPONENT)).max(MAX_PUBLIC_SIGNALS_COUNT),
    }),
    user_context_data: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    attestationId: data.attestation_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000),
    selfProof: {
      proof: data.self_proof.proof,
      publicSignals: data.self_proof.public_signals,
    },
    userContextData: data.user_context_data,
  }))

export type ContractVerification = z.input<typeof contractVerificationSchema>
export type TransformedVerification = z.output<typeof contractVerificationSchema>

export const contractVerificationSummarySchema = z
  .object({
    nullifier: z.string().max(SIZE_LIMITS.NULLIFIER),
    near_account_id: nearAccountIdSchema,
    attestation_id: attestationIdSchema,
    verified_at: z.number(),
  })
  .transform((data) => ({
    nullifier: data.nullifier,
    nearAccountId: data.near_account_id,
    attestationId: data.attestation_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000),
  }))

export type ContractVerificationSummary = z.input<typeof contractVerificationSummarySchema>
export type TransformedVerificationSummary = z.output<typeof contractVerificationSummarySchema>
