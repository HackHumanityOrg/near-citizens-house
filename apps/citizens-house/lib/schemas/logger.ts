/**
 * Logger Event Schemas
 *
 * Strongly-typed log events using Zod discriminated unions.
 * Each event has a unique "event" field that discriminates the union.
 *
 * @example
 * ```ts
 * import { logEvent } from "@/lib/logger"
 * logEvent({ event: "sumsub_token_generated", level: "info", externalUserId: "...", applicantId: "..." })
 * ```
 */
import { z } from "zod"

// =============================================================================
// Log Levels
// =============================================================================

export const logLevelSchema = z.enum(["info", "warn", "error"])
export type LogLevel = z.infer<typeof logLevelSchema>

// =============================================================================
// Token Route Events (8 events)
// =============================================================================

const sumsubTokenInvalidFormatEventSchema = z
  .object({
    event: z.literal("sumsub_token_invalid_format"),
    level: z.literal("warn"),
    accountId: z.string(),
    error: z.string(),
    errorCode: z.string(),
  })
  .strict()

const sumsubTokenMissingConfigEventSchema = z
  .object({
    event: z.literal("sumsub_token_missing_config"),
    level: z.literal("error"),
  })
  .strict()

const sumsubTokenInvalidSignatureEventSchema = z
  .object({
    event: z.literal("sumsub_token_invalid_signature"),
    level: z.literal("warn"),
    accountId: z.string(),
    error: z.string(),
  })
  .strict()

const sumsubTokenNotFullAccessEventSchema = z
  .object({
    event: z.literal("sumsub_token_not_full_access"),
    level: z.literal("warn"),
    accountId: z.string(),
    error: z.string(),
  })
  .strict()

const sumsubTokenAlreadyVerifiedEventSchema = z
  .object({
    event: z.literal("sumsub_token_already_verified"),
    level: z.literal("info"),
    accountId: z.string(),
  })
  .strict()

const sumsubApplicantExistsEventSchema = z
  .object({
    event: z.literal("sumsub_applicant_exists"),
    level: z.literal("info"),
    externalUserId: z.string(),
    applicantId: z.string(),
  })
  .strict()

const sumsubMetadataStoredEventSchema = z
  .object({
    event: z.literal("sumsub_metadata_stored"),
    level: z.literal("info"),
    externalUserId: z.string(),
    applicantId: z.string(),
  })
  .strict()

const sumsubTokenGeneratedEventSchema = z
  .object({
    event: z.literal("sumsub_token_generated"),
    level: z.literal("info"),
    externalUserId: z.string(),
    applicantId: z.string(),
  })
  .strict()

const sumsubTokenErrorEventSchema = z
  .object({
    event: z.literal("sumsub_token_error"),
    level: z.literal("error"),
    error: z.string(),
  })
  .strict()

// =============================================================================
// Webhook Route Events (15 events)
// =============================================================================

const sumsubWebhookMissingSignatureEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_missing_signature"),
    level: z.literal("warn"),
  })
  .strict()

const sumsubWebhookInvalidSignatureEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_invalid_signature"),
    level: z.literal("warn"),
  })
  .strict()

const sumsubWebhookInvalidPayloadEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_invalid_payload"),
    level: z.literal("warn"),
    errors: z.string(),
  })
  .strict()

const sumsubWebhookReceivedEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_received"),
    level: z.literal("info"),
    type: z.string(),
    applicantId: z.string(),
    externalUserId: z.string(),
    reviewStatus: z.string(),
  })
  .strict()

const sumsubWebhookNotApprovedEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_not_approved"),
    level: z.literal("info"),
    applicantId: z.string(),
    reviewAnswer: z.string(),
    rejectLabels: z.string(),
  })
  .strict()

const sumsubWebhookMissingMetadataEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_missing_metadata"),
    level: z.literal("error"),
    applicantId: z.string(),
    missingFields: z.string(),
  })
  .strict()

const sumsubWebhookInvalidFormatEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_invalid_format"),
    level: z.literal("warn"),
    applicantId: z.string(),
    accountId: z.string(),
    error: z.string(),
    errorCode: z.string(),
  })
  .strict()

const sumsubWebhookMissingConfigEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_missing_config"),
    level: z.literal("error"),
    applicantId: z.string(),
  })
  .strict()

const sumsubWebhookSignatureInvalidEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_signature_invalid"),
    level: z.literal("warn"),
    applicantId: z.string(),
    accountId: z.string(),
    error: z.string(),
  })
  .strict()

const sumsubWebhookNotFullAccessEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_not_full_access"),
    level: z.literal("warn"),
    applicantId: z.string(),
    accountId: z.string(),
    error: z.string(),
  })
  .strict()

const sumsubWebhookNonceUsedEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_nonce_used"),
    level: z.literal("warn"),
    applicantId: z.string(),
    accountId: z.string(),
  })
  .strict()

const sumsubWebhookMissingBackendConfigEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_missing_backend_config"),
    level: z.literal("error"),
    applicantId: z.string(),
  })
  .strict()

const sumsubWebhookStoredOnchainEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_stored_onchain"),
    level: z.literal("info"),
    applicantId: z.string(),
    accountId: z.string(),
  })
  .strict()

const sumsubWebhookStorageFailedEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_storage_failed"),
    level: z.literal("error"),
    applicantId: z.string(),
    accountId: z.string(),
    error: z.string(),
    errorCode: z.string(),
  })
  .strict()

const sumsubWebhookErrorEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_error"),
    level: z.literal("error"),
    applicantId: z.string(),
    accountId: z.string(),
    error: z.string(),
  })
  .strict()

const sumsubWebhookPendingReviewEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_pending_review"),
    level: z.literal("info"),
    applicantId: z.string(),
    reviewAnswer: z.string(),
  })
  .strict()

const sumsubWebhookMissingExternalUserIdEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_missing_external_user_id"),
    level: z.literal("warn"),
    applicantId: z.string(),
  })
  .strict()

// =============================================================================
// SumSub Provider Events (11 events)
// =============================================================================

const sumsubCreateApplicantFailedEventSchema = z
  .object({
    event: z.literal("sumsub_create_applicant_failed"),
    level: z.literal("error"),
    status: z.number(),
    error: z.string(),
    externalUserId: z.string(),
  })
  .strict()

const sumsubCreateApplicantInvalidResponseEventSchema = z
  .object({
    event: z.literal("sumsub_create_applicant_invalid_response"),
    level: z.literal("error"),
    error: z.string(),
  })
  .strict()

const sumsubApplicantCreatedEventSchema = z
  .object({
    event: z.literal("sumsub_applicant_created"),
    level: z.literal("info"),
    applicantId: z.string(),
    externalUserId: z.string(),
  })
  .strict()

const sumsubAccessTokenFailedEventSchema = z
  .object({
    event: z.literal("sumsub_access_token_failed"),
    level: z.literal("error"),
    status: z.number(),
    error: z.string(),
    externalUserId: z.string(),
  })
  .strict()

const sumsubAccessTokenInvalidResponseEventSchema = z
  .object({
    event: z.literal("sumsub_access_token_invalid_response"),
    level: z.literal("error"),
    error: z.string(),
    response: z.unknown(),
  })
  .strict()

const sumsubGetApplicantFailedEventSchema = z
  .object({
    event: z.literal("sumsub_get_applicant_failed"),
    level: z.literal("error"),
    status: z.number(),
    error: z.string(),
    applicantId: z.string(),
  })
  .strict()

const sumsubGetApplicantInvalidResponseEventSchema = z
  .object({
    event: z.literal("sumsub_get_applicant_invalid_response"),
    level: z.literal("error"),
    error: z.string(),
    response: z.unknown(),
  })
  .strict()

const sumsubGetApplicantByExternalIdFailedEventSchema = z
  .object({
    event: z.literal("sumsub_get_applicant_by_external_id_failed"),
    level: z.literal("error"),
    status: z.number(),
    error: z.string(),
    externalUserId: z.string(),
  })
  .strict()

const sumsubGetApplicantByExternalIdInvalidResponseEventSchema = z
  .object({
    event: z.literal("sumsub_get_applicant_by_external_id_invalid_response"),
    level: z.literal("error"),
    error: z.string(),
    response: z.unknown(),
  })
  .strict()

const sumsubUpdateMetadataFailedEventSchema = z
  .object({
    event: z.literal("sumsub_update_metadata_failed"),
    level: z.literal("error"),
    status: z.number(),
    error: z.string(),
    applicantId: z.string(),
  })
  .strict()

const sumsubWebhookSecretNotConfiguredEventSchema = z
  .object({
    event: z.literal("sumsub_webhook_secret_not_configured"),
    level: z.literal("error"),
  })
  .strict()

// =============================================================================
// Redis Events (2 events)
// =============================================================================

const redisConnectionEstablishedEventSchema = z
  .object({
    event: z.literal("redis_connection_established"),
    level: z.literal("info"),
    url: z.string(),
  })
  .strict()

const redisConnectionFailedEventSchema = z
  .object({
    event: z.literal("redis_connection_failed"),
    level: z.literal("error"),
    error: z.string(),
  })
  .strict()

// =============================================================================
// Verification Status Events (2 events)
// =============================================================================

const verificationStatusSetEventSchema = z
  .object({
    event: z.literal("verification_status_set"),
    level: z.literal("info"),
    accountId: z.string(),
    status: z.string(),
  })
  .strict()

const verificationStatusClearedEventSchema = z
  .object({
    event: z.literal("verification_status_cleared"),
    level: z.literal("info"),
    accountId: z.string(),
  })
  .strict()

// =============================================================================
// Combined Schema
// =============================================================================

/**
 * All log events - discriminated union by "event" field
 */
export const logEventSchema = z.discriminatedUnion("event", [
  // Token route events
  sumsubTokenInvalidFormatEventSchema,
  sumsubTokenMissingConfigEventSchema,
  sumsubTokenInvalidSignatureEventSchema,
  sumsubTokenNotFullAccessEventSchema,
  sumsubTokenAlreadyVerifiedEventSchema,
  sumsubApplicantExistsEventSchema,
  sumsubMetadataStoredEventSchema,
  sumsubTokenGeneratedEventSchema,
  sumsubTokenErrorEventSchema,
  // Webhook route events
  sumsubWebhookMissingSignatureEventSchema,
  sumsubWebhookInvalidSignatureEventSchema,
  sumsubWebhookInvalidPayloadEventSchema,
  sumsubWebhookReceivedEventSchema,
  sumsubWebhookNotApprovedEventSchema,
  sumsubWebhookMissingMetadataEventSchema,
  sumsubWebhookInvalidFormatEventSchema,
  sumsubWebhookMissingConfigEventSchema,
  sumsubWebhookSignatureInvalidEventSchema,
  sumsubWebhookNotFullAccessEventSchema,
  sumsubWebhookNonceUsedEventSchema,
  sumsubWebhookMissingBackendConfigEventSchema,
  sumsubWebhookStoredOnchainEventSchema,
  sumsubWebhookStorageFailedEventSchema,
  sumsubWebhookErrorEventSchema,
  sumsubWebhookPendingReviewEventSchema,
  sumsubWebhookMissingExternalUserIdEventSchema,
  // SumSub provider events
  sumsubCreateApplicantFailedEventSchema,
  sumsubCreateApplicantInvalidResponseEventSchema,
  sumsubApplicantCreatedEventSchema,
  sumsubAccessTokenFailedEventSchema,
  sumsubAccessTokenInvalidResponseEventSchema,
  sumsubGetApplicantFailedEventSchema,
  sumsubGetApplicantInvalidResponseEventSchema,
  sumsubGetApplicantByExternalIdFailedEventSchema,
  sumsubGetApplicantByExternalIdInvalidResponseEventSchema,
  sumsubUpdateMetadataFailedEventSchema,
  sumsubWebhookSecretNotConfiguredEventSchema,
  // Redis events
  redisConnectionEstablishedEventSchema,
  redisConnectionFailedEventSchema,
  // Verification status events
  verificationStatusSetEventSchema,
  verificationStatusClearedEventSchema,
])

// =============================================================================
// Type Exports
// =============================================================================

export type LogEvent = z.infer<typeof logEventSchema>
