/**
 * SumSub Provider Schemas
 *
 * Provider payloads and API responses from SumSub only.
 */
import { z } from "zod"
import { nearAccountIdSchema } from "../near"

// ==============================================================================
// Webhook Payloads
// ==============================================================================

const reviewAnswerSchema = z.enum(["GREEN", "RED", "YELLOW"])
const reviewRejectTypeSchema = z.enum(["RETRY", "FINAL"])

const reviewResultSchema = z.object({
  reviewAnswer: reviewAnswerSchema,
  reviewRejectType: reviewRejectTypeSchema.optional(),
  rejectLabels: z.array(z.string()).optional(),
  reviewResult: z.string().optional(),
  moderationComment: z.string().optional(),
  clientComment: z.string().optional(),
})

export const sumsubWebhookPayloadSchema = z.object({
  type: z.string(),
  applicantId: z.string(),
  inspectionId: z.string().optional(),
  correlationId: z.string().optional(),
  levelName: z.string().optional(),
  externalUserId: z.string(),
  externalUserIdType: z.string().optional(),
  reviewResult: reviewResultSchema.optional(),
  reviewStatus: z.string().optional(),
  createdAtMs: z.string().optional(),
  createdAt: z.string().optional(),
  sandboxMode: z.boolean().optional(),
})

export type SumSubWebhookPayload = z.infer<typeof sumsubWebhookPayloadSchema>

// ==============================================================================
// Applicant Metadata
// ==============================================================================

export const applicantMetadataSchema = z.object({
  near_account_id: nearAccountIdSchema,
  near_signature: z.string(),
  near_public_key: z.string(),
  near_nonce: z.string(),
  near_timestamp: z.string(),
})

export type SumSubApplicantMetadata = z.infer<typeof applicantMetadataSchema>

// ==============================================================================
// SumSub API Response Types
// ==============================================================================

export const sumsubAccessTokenApiResponseSchema = z.object({
  token: z.string(),
  userId: z.string(),
})

export type SumSubAccessTokenApiResponse = z.infer<typeof sumsubAccessTokenApiResponseSchema>

export const sumsubMetadataItemSchema = z.object({
  key: z.string(),
  value: z.string(),
})

export type SumSubMetadataItem = z.infer<typeof sumsubMetadataItemSchema>

export const sumsubApplicantSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  externalUserId: z.string().optional(),
  review: z
    .object({
      reviewStatus: z.string().optional(),
      reviewResult: reviewResultSchema.optional(),
    })
    .optional(),
  metadata: z.array(sumsubMetadataItemSchema).optional(),
})

export type SumSubApplicant = z.infer<typeof sumsubApplicantSchema>
