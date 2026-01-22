/**
 * Verification Contract Schemas - NEAR smart contract I/O types with snake_case ↔ camelCase transforms.
 *
 * This file handles the boundary between TypeScript (camelCase) and the NEAR contract (snake_case):
 * - `contractVerificationSchema` - Parses contract output (snake_case) to app format (camelCase)
 * - `ContractSignatureInput` - Contract input type (snake_case)
 * - `VerificationDataWithSignature` - Extended type for storage
 */
import { z } from "zod"
import { SIZE_LIMITS } from "./core"
import { nearAccountIdSchema, type NearSignatureData, type NearAccountId } from "./near"

// Size limit for SumSub applicant IDs (matching contract constant)
const MAX_SUMSUB_APPLICANT_ID_LEN = 80

/**
 * Data required to store a verification on-chain.
 * This is the frontend-facing type with camelCase.
 */
export interface VerificationDataWithSignature {
  /** SumSub applicant ID (unique identifier for the verified identity) */
  sumsubApplicantId: string
  nearAccountId: NearAccountId
  signatureData: NearSignatureData
  userContextData: string
}

/**
 * Contract input format for NEAR signature data (snake_case).
 */
export interface ContractSignatureInput {
  account_id: NearAccountId
  signature: string
  public_key: string
  challenge: string
  nonce: string
  recipient: string
}

/**
 * Contract output schema for full verification records.
 * Transforms from snake_case contract output to camelCase app format.
 * Converts nanoseconds to milliseconds for timestamps.
 */
export const contractVerificationSchema = z
  .object({
    sumsub_applicant_id: z.string().max(MAX_SUMSUB_APPLICANT_ID_LEN),
    near_account_id: nearAccountIdSchema,
    verified_at: z.number(),
    user_context_data: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
  })
  .transform((data) => ({
    sumsubApplicantId: data.sumsub_applicant_id,
    nearAccountId: data.near_account_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000),
    userContextData: data.user_context_data,
  }))

export type ContractVerification = z.input<typeof contractVerificationSchema>
export type TransformedVerification = z.output<typeof contractVerificationSchema>

/**
 * Contract output schema for verification summaries (without userContextData).
 * Transforms from snake_case contract output to camelCase app format.
 */
export const contractVerificationSummarySchema = z
  .object({
    sumsub_applicant_id: z.string().max(MAX_SUMSUB_APPLICANT_ID_LEN),
    near_account_id: nearAccountIdSchema,
    verified_at: z.number(),
  })
  .transform((data) => ({
    sumsubApplicantId: data.sumsub_applicant_id,
    nearAccountId: data.near_account_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000),
  }))

export type ContractVerificationSummary = z.input<typeof contractVerificationSummarySchema>
export type TransformedVerificationSummary = z.output<typeof contractVerificationSummarySchema>
