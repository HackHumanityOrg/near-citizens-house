/**
 * Verification API Schemas
 *
 * Backend-to-frontend contracts for verification endpoints.
 */
import { z } from "zod"
import { nearSignatureDataSchema } from "../near"
import { verificationStatusFailureCodeSchema } from "../errors"

// ==============================================================================
// Token API
// ==============================================================================

export const verificationTokenRequestSchema = z.object({
  nearSignature: nearSignatureDataSchema.pick({
    accountId: true,
    signature: true,
    publicKey: true,
    nonce: true,
    timestamp: true,
  }),
})

export const verificationTokenResponseSchema = z.object({
  token: z.string(),
  externalUserId: z.string(),
})

export type VerificationTokenResponse = z.infer<typeof verificationTokenResponseSchema>

// ==============================================================================
// Status API
// ==============================================================================

export const verificationStatusResponseSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("approved") }),
  z.object({ state: z.literal("pending") }),
  z.object({
    state: z.literal("hold"),
    updatedAt: z.number(),
    errorCode: z.literal("VERIFICATION_ON_HOLD"),
  }),
  z.object({
    state: z.literal("failed"),
    updatedAt: z.number(),
    errorCode: verificationStatusFailureCodeSchema,
  }),
])

export type VerificationStatusResponse = z.infer<typeof verificationStatusResponseSchema>
