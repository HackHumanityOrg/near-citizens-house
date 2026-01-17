/**
 * API Response Schemas
 *
 * Typed request and response schemas for verification API endpoints.
 * Provides discriminated unions for type-safe response handling.
 *
 * Only the discriminated union schemas are exported. Individual variant
 * types can be extracted using TypeScript's Extract utility if needed.
 */
import { z } from "zod"
import { attestationIdSchema } from "./core"
import { verificationErrorCodeSchema, validationIssueSchema } from "./errors"
import { nearAccountIdSchema } from "./near"

// ============================================================================
// Verification Endpoint Schema
// ============================================================================

/**
 * Verification response discriminated union.
 * Use for type-safe handling of verify endpoint responses.
 */
export const verifyResponseSchema = z.discriminatedUnion("status", [
  // Success response
  z.object({
    status: z.literal("success"),
    result: z.literal(true),
    attestationId: attestationIdSchema,
    userData: z.object({
      userId: z.string(),
      nearAccountId: nearAccountIdSchema,
      nearSignature: z.string(),
    }),
    discloseOutput: z
      .object({
        nullifier: z.string().optional(),
      })
      .catchall(z.unknown())
      .optional(),
  }),
  // Error response
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
// Status Endpoint Schema
// ============================================================================

/**
 * Status response discriminated union.
 * Use for type-safe handling of status endpoint responses.
 */
export const statusResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    accountId: nearAccountIdSchema.optional(),
    attestationId: attestationIdSchema.optional(),
  }),
  z.object({
    status: z.literal("pending"),
    accountId: nearAccountIdSchema.optional(),
    attestationId: attestationIdSchema.optional(),
  }),
  z.object({
    status: z.literal("error"),
    accountId: nearAccountIdSchema.optional(),
    attestationId: attestationIdSchema.optional(),
    error: z.string().optional(),
    errorCode: z.string().optional(),
  }),
  z.object({
    status: z.literal("expired"),
    error: z.string().optional(),
  }),
])

export type StatusResponse = z.infer<typeof statusResponseSchema>
export type StatusSuccessResponse = Extract<StatusResponse, { status: "success" }>
export type StatusPendingResponse = Extract<StatusResponse, { status: "pending" }>
export type StatusErrorResponse = Extract<StatusResponse, { status: "error" }>
export type StatusExpiredResponse = Extract<StatusResponse, { status: "expired" }>
