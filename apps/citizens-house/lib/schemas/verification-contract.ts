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

/**
 * Data required to store a verification on-chain.
 * This is the frontend-facing type with camelCase.
 */
export interface VerificationDataWithSignature {
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
    near_account_id: nearAccountIdSchema,
    verified_at: z.number(),
    user_context_data: z.string().max(SIZE_LIMITS.USER_CONTEXT_DATA),
  })
  .transform((data) => ({
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
    near_account_id: nearAccountIdSchema,
    verified_at: z.number(),
  })
  .transform((data) => ({
    nearAccountId: data.near_account_id,
    verifiedAt: Math.floor(data.verified_at / 1_000_000),
  }))

export type ContractVerificationSummary = z.input<typeof contractVerificationSummarySchema>
export type TransformedVerificationSummary = z.output<typeof contractVerificationSummarySchema>
