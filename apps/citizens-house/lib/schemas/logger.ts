/**
 * Logger Event Schemas
 *
 * Strongly-typed wide event logging using Zod schemas.
 * Each request type (verify, status, etc.) has its own schema with all valid fields.
 * The combined WideEvent schema uses a union of all event schemas.
 *
 * @example
 * ```ts
 * import type { VerifyRequestEvent } from "@/lib/schemas/logger"
 * ```
 */
import { z } from "zod"

// =============================================================================
// Shared Enums
// =============================================================================

export const logLevelSchema = z.enum(["info", "warn", "error"])

const outcomeSchema = z.enum([
  "success",
  "validation_error",
  "signature_error",
  "proof_error",
  "storage_error",
  "internal_error",
  "pending",
  "not_found",
  "verified",
  "not_verified",
  "error",
])

const errorStageSchema = z.enum([
  "request_validation",
  "sumsub_verify",
  "sumsub_verify_response",
  "signature_parse",
  "signature_validate",
  "storage",
  "config",
  "internal",
])

const platformSchema = z.enum(["desktop", "mobile", "unknown"])

// =============================================================================
// Nested Context Schemas
// =============================================================================

const errorContextSchema = z
  .object({
    code: z.string().optional(),
    message: z.string().optional(),
    isRetryable: z.boolean().optional(),
    stage: errorStageSchema.optional(),
  })
  .strict()

const stageReachedSchema = z
  .object({
    parsed: z.boolean().optional(),
    signatureValidated: z.boolean().optional(),
    proofValidated: z.boolean().optional(),
    nonceReserved: z.boolean().optional(),
    storedOnChain: z.boolean().optional(),
  })
  .strict()

const externalCallsSchema = z
  .object({
    sumsubCalled: z.boolean().optional(),
    sumsubSuccess: z.boolean().optional(),
    nearRpcCalled: z.boolean().optional(),
    nearRpcSuccess: z.boolean().optional(),
    redisCalled: z.boolean().optional(),
    redisSuccess: z.boolean().optional(),
    contractCalled: z.boolean().optional(),
    contractSuccess: z.boolean().optional(),
  })
  .strict()

const contractContextSchema = z
  .object({
    contractId: z.string().optional(),
    methodCalled: z.string().optional(),
  })
  .strict()

const keyPoolContextSchema = z
  .object({
    index: z.number().optional(),
  })
  .strict()

// =============================================================================
// Timing Schemas (per event type)
// =============================================================================

const verifyTimingsSchema = z
  .object({
    parseBody: z.number().optional(),
    sumsubVerify: z.number().optional(),
    signatureValidation: z.number().optional(),
    nonceReservation: z.number().optional(),
    contractStorage: z.number().optional(),
    sessionUpdate: z.number().optional(),
    keyPoolSelection: z.number().optional(),
    total: z.number().optional(),
  })
  .strict()

const statusTimingsSchema = z
  .object({
    redisLookup: z.number().optional(),
    contractFallback: z.number().optional(),
    total: z.number().optional(),
  })
  .strict()

const getVerificationsTimingsSchema = z
  .object({
    contractFetch: z.number().optional(),
    zkVerification: z.number().optional(),
    total: z.number().optional(),
  })
  .strict()

const checkIsVerifiedTimingsSchema = z
  .object({
    contractCall: z.number().optional(),
    total: z.number().optional(),
  })
  .strict()

// =============================================================================
// Base Event Fields
// =============================================================================

const baseEventFieldsSchema = z.object({
  requestId: z.string(),
  timestamp: z.number().optional(),
  distinctId: z.string().nullish(),
  sessionId: z.string().nullish(),
  platform: platformSchema.optional(),
})

// =============================================================================
// Event Schemas
// =============================================================================

/**
 * SumSub webhook event - /api/verification/sumsub/webhook
 */
const sumsubWebhookEventSchema = baseEventFieldsSchema
  .extend({
    route: z.literal("/api/verification/sumsub/webhook"),
    method: z.literal("POST"),
    nearAccountId: z.string().optional(),
    sumsubApplicantId: z.string().optional(),
    webhookType: z.string().optional(),
    reviewResult: z.string().optional(),
    signaturePresent: z.boolean().optional(),
    signatureTimestampAge: z.number().optional(),
    stageReached: stageReachedSchema.optional(),
    timings: verifyTimingsSchema.optional(),
    externalCalls: externalCallsSchema.optional(),
    contract: contractContextSchema.optional(),
    keyPool: keyPoolContextSchema.optional(),
    outcome: outcomeSchema.optional(),
    statusCode: z.number().optional(),
    error: errorContextSchema.optional(),
  })
  .strict()

/**
 * Status request event - /api/verification/status
 */
const statusRequestEventSchema = baseEventFieldsSchema
  .extend({
    route: z.literal("/api/verification/status"),
    method: z.literal("GET"),
    nearAccountId: z.string().optional(),
    sessionFound: z.boolean().optional(),
    sessionStatus: z.string().optional(),
    sessionAge: z.number().optional(),
    usedContractFallback: z.boolean().optional(),
    contractCheckSuccess: z.boolean().optional(),
    timings: statusTimingsSchema.optional(),
    outcome: outcomeSchema.optional(),
    statusCode: z.number().optional(),
    error: errorContextSchema.optional(),
  })
  .strict()

/**
 * Server action event - getVerificationsWithStatus
 */
const getVerificationsEventSchema = baseEventFieldsSchema
  .extend({
    action: z.literal("getVerificationsWithStatus"),
    page: z.number().optional(),
    pageSize: z.number().optional(),
    verificationsRequested: z.number().optional(),
    verificationsReturned: z.number().optional(),
    totalVerifications: z.number().optional(),
    zkVerificationAttempted: z.number().optional(),
    zkVerificationSucceeded: z.number().optional(),
    zkVerificationFailed: z.number().optional(),
    signatureVerificationAttempted: z.number().optional(),
    signatureVerificationSucceeded: z.number().optional(),
    signatureVerificationFailed: z.number().optional(),
    timings: getVerificationsTimingsSchema.optional(),
    outcome: outcomeSchema.optional(),
  })
  .strict()

/**
 * Server action event - checkIsVerified
 */
const checkIsVerifiedEventSchema = baseEventFieldsSchema
  .extend({
    action: z.literal("checkIsVerified"),
    nearAccountId: z.string().optional(),
    isVerified: z.boolean().optional(),
    timings: checkIsVerifiedTimingsSchema.optional(),
    outcome: outcomeSchema.optional(),
  })
  .strict()

// =============================================================================
// Combined Schema & Type Exports
// =============================================================================

/**
 * Union of all wide event schemas
 */
export const wideEventSchema = z.union([
  sumsubWebhookEventSchema,
  statusRequestEventSchema,
  getVerificationsEventSchema,
  checkIsVerifiedEventSchema,
])

// =============================================================================
// Type Exports
// =============================================================================

export type LogLevel = z.infer<typeof logLevelSchema>
export type Outcome = z.infer<typeof outcomeSchema>
export type ErrorStage = z.infer<typeof errorStageSchema>
export type Platform = z.infer<typeof platformSchema>

export type SumSubWebhookEvent = z.infer<typeof sumsubWebhookEventSchema>
export type StatusRequestEvent = z.infer<typeof statusRequestEventSchema>
export type GetVerificationsEvent = z.infer<typeof getVerificationsEventSchema>
export type CheckIsVerifiedEvent = z.infer<typeof checkIsVerifiedEventSchema>
export type WideEvent = z.infer<typeof wideEventSchema>

// Timer type unions (for compile-time timer name validation)
export type SumSubWebhookTimers = keyof Omit<z.infer<typeof verifyTimingsSchema>, "total">
export type StatusTimers = keyof Omit<z.infer<typeof statusTimingsSchema>, "total">
export type GetVerificationsTimers = keyof Omit<z.infer<typeof getVerificationsTimingsSchema>, "total">
export type CheckIsVerifiedTimers = keyof Omit<z.infer<typeof checkIsVerifiedTimingsSchema>, "total">

// =============================================================================
// Type-Level Mappings (for RequestContext)
// =============================================================================

/**
 * Maps an event type to its valid timer names
 */
export type EventTimers<E extends WideEvent> = E extends SumSubWebhookEvent
  ? SumSubWebhookTimers
  : E extends StatusRequestEvent
    ? StatusTimers
    : E extends GetVerificationsEvent
      ? GetVerificationsTimers
      : E extends CheckIsVerifiedEvent
        ? CheckIsVerifiedTimers
        : never
