/**
 * API Response Schemas - Typed request/response schemas for verification endpoints.
 */
import { z } from "zod"
import { verificationErrorCodeSchema, validationIssueSchema } from "./errors"
import { nearAccountIdSchema } from "./near"

export const verifyResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    result: z.literal(true),
    userData: z.object({
      userId: z.string(),
      nearAccountId: nearAccountIdSchema,
      nearSignature: z.string(),
    }),
    sumsubApplicantId: z.string().optional(),
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

export const statusResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    accountId: nearAccountIdSchema.optional(),
    sumsubApplicantId: z.string().optional(),
  }),
  z.object({
    status: z.literal("pending"),
    accountId: nearAccountIdSchema.optional(),
  }),
  z.object({
    status: z.literal("error"),
    accountId: nearAccountIdSchema.optional(),
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
