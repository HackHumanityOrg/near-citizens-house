/**
 * API Response Schemas - Typed request/response schemas for verification endpoints.
 */
import { z } from "zod"
import { verificationErrorCodeSchema, validationIssueSchema } from "./errors"
import { nearAccountIdSchema } from "./near"
import { sumsubTokenResponseSchema } from "./sumsub"

export const verifyResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    result: z.literal(true),
    userData: z.object({
      userId: z.string(),
      nearAccountId: nearAccountIdSchema,
      nearSignature: z.string(),
    }),
  }),
  z.object({
    status: z.literal("error"),
    result: z.literal(false),
    code: verificationErrorCodeSchema,
    reason: z.string(),
    issues: z.array(validationIssueSchema).optional(),
  }),
])

export type VerifyResponse = z.infer<typeof verifyResponseSchema>
export type VerifySuccessResponse = Extract<VerifyResponse, { status: "success" }>
export type VerifyErrorResponse = Extract<VerifyResponse, { status: "error" }>

// ============================================================================
// Token Endpoint Schemas
// ============================================================================

/** Token endpoint success response */
export const tokenSuccessResponseSchema = sumsubTokenResponseSchema

/** Token endpoint error response (uses existing error structure) */
export const tokenErrorResponseSchema = z.object({
  status: z.literal("error"),
  result: z.literal(false),
  code: verificationErrorCodeSchema,
  reason: z.string(),
  issues: z.array(validationIssueSchema).optional(),
})

/** Union for complete token response */
export const tokenResponseSchema = z.discriminatedUnion("status", [
  tokenSuccessResponseSchema.extend({ status: z.literal("success") }),
  tokenErrorResponseSchema,
])

export type TokenResponse = z.infer<typeof tokenResponseSchema>

// ============================================================================
// Webhook Acknowledgment Schema
// ============================================================================

/** Webhook acknowledgment response */
export const webhookAckResponseSchema = z.object({
  status: z.literal("ok"),
  message: z.string(),
  accountId: z.string().optional(),
})
