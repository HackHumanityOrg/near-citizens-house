/**
 * Analytics Event Schemas
 *
 * Strongly-typed analytics events using Zod discriminated unions.
 * Each domain (verification, citizens, consent) has its own discriminated union on "action".
 * The combined schema uses a regular union since each domain is already discriminated.
 *
 * @example
 * ```ts
 * import { trackEvent } from "@/lib/analytics"
 * trackEvent({ domain: "verification", action: "flow_start", platform: "desktop" })
 * ```
 */
import { z } from "zod"
import { verificationErrorCodeSchema } from "./errors"
import { nearAccountIdSchema } from "./near"

// =============================================================================
// Domain: Verification (Client-Side)
// =============================================================================

const verificationEventBase = {
  domain: z.literal("verification"),
  verificationAttemptId: z.string().optional(),
} as const

const platformSchema = z.enum(["desktop", "mobile"])

const verificationFlowStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("flow_start"),
    platform: platformSchema,
  })
  .strict()

// Landing page CTA tracking
const verificationCtaClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("cta_click"),
    platform: platformSchema,
    isConnected: z.boolean(),
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

// Wallet connection lifecycle
const verificationWalletConnectStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("wallet_connect_start"),
    platform: platformSchema,
  })
  .strict()

const verificationWalletConnectFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("wallet_connect_fail"),
    platform: platformSchema,
    errorMessage: z.string(),
  })
  .strict()

const verificationWalletConnectSucceededEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("wallet_connect_success"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Message signing lifecycle
const verificationSignStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_start"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_success"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
    wasUserRejection: z.boolean(),
  })
  .strict()

// Already verified detection
const verificationAlreadyVerifiedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("already_verified_detect"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Token fetch lifecycle
const verificationTokenFetchStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_fetch_start"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationTokenFetchSucceededEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_fetch_success"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    durationMs: z.number(),
  })
  .strict()

const verificationTokenFetchFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_fetch_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorCode: verificationErrorCodeSchema,
    durationMs: z.number(),
  })
  .strict()

// Success page
const verificationSuccessDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("success_view"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSuccessDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("success_disconnect_click"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationPollingStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_start"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationPollingTimeoutEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_timeout"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    pollCount: z.number(),
    pollDurationMs: z.number(),
    lastStatusState: z.string().optional(),
  })
  .strict()

const verificationManualReviewShownEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("manual_review_view"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    pollCount: z.number().optional(),
    pollDurationMs: z.number().optional(),
    lastStatusState: z.string().optional(),
  })
  .strict()

const verificationStatusRecoveredEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("status_recover"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    recoveredFrom: z.enum(["hold", "error"]),
  })
  .strict()

// SumSub SDK lifecycle events
const verificationSumsubSdkLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_sdk_load"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSumsubMessageEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_message_receive"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    messageType: z.string(),
  })
  .strict()

const verificationSumsubErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_error_receive"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Granular SumSub SDK events for better signal-to-noise
const sumsubReviewAnswerSchema = z.enum(["GREEN", "RED", "YELLOW"])
const sumsubReviewRejectTypeSchema = z.enum(["RETRY", "FINAL"])

const verificationSumsubReadyEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_ready"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSumsubStepStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_step_start"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    stepType: z.string(),
  })
  .strict()

const verificationSumsubStepCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_step_complete"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    stepType: z.string(),
  })
  .strict()

const verificationSumsubSubmittedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_submit"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Rejection confirmed by webhook or timeout fallback
// source: "webhook" = confirmed by backend status polling, "timeout_fallback" = polling timed out, using WebSDK's last known status
const verificationSumsubRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_review_reject"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    reviewAnswer: sumsubReviewAnswerSchema,
    reviewRejectType: sumsubReviewRejectTypeSchema.optional(),
    rejectLabels: z.array(z.string()).optional(),
    source: z.enum(["webhook", "timeout_fallback"]),
  })
  .strict()

// Raw WebSDK status received - for analytics tracking (not trusted as final source of truth)
const verificationSumsubStatusReceivedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_status_receive"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
    reviewStatus: z.string().optional(),
    reviewRejectType: sumsubReviewRejectTypeSchema.optional(),
    rejectLabels: z.array(z.string()).optional(),
  })
  .strict()

// Applicant loaded in WebSDK
const verificationSumsubApplicantLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_applicant_load"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
  })
  .strict()

// Polling confirmed approval
const verificationPollingApprovedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_approve"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    source: z.enum(["webhook", "timeout_fallback"]),
    pollCount: z.number().optional(),
    pollDurationMs: z.number().optional(),
    lastStatusState: z.string().optional(),
  })
  .strict()

const verificationErrorShownEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_modal_view"),
    errorCode: verificationErrorCodeSchema,
    stage: z.enum(["wallet_connect", "message_sign", "qr_scan", "polling", "unknown"]),
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationErrorRetryClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_modal_retry_click"),
    errorCode: verificationErrorCodeSchema,
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationErrorAbandonedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_modal_abandon"),
    errorCode: verificationErrorCodeSchema,
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

// Polling network error (during step-2-sumsub confirmation polling)
const verificationPollingNetworkErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_network_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Token refresh failed (when SDK token expires)
const verificationTokenRefreshFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_refresh_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Error page displayed (user lands on error page)
const verificationErrorPageDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_page_view"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorCode: verificationErrorCodeSchema,
  })
  .strict()

// Hold page displayed (user lands on hold page)
const verificationHoldPageDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("hold_page_view"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorCode: verificationErrorCodeSchema.optional(),
  })
  .strict()

// Disconnect from error state
const verificationErrorDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_page_disconnect_click"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Disconnect from hold state
const verificationHoldDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("hold_page_disconnect_click"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Error page polling failed
const verificationErrorPollingFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_polling_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Hold page polling failed
const verificationHoldPollingFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("hold_polling_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Verification check failed (when checkIsVerified() fails)
const verificationCheckFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("verification_check_fail"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// =============================================================================
// Domain: Verification (Server-Side)
// =============================================================================

const verificationProofSubmittedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("proof_submit"),
    accountId: nearAccountIdSchema,
    applicantId: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
    levelName: z.string().optional(),
    reviewStatus: z.string().optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
  })
  .strict()

const verificationProofValidatedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("proof_validate"),
    accountId: nearAccountIdSchema,
    applicantId: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
    levelName: z.string().optional(),
    reviewStatus: z.string().optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
  })
  .strict()

const verificationStoredOnchainEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("onchain_store_success"),
    accountId: nearAccountIdSchema,
    applicantId: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
    levelName: z.string().optional(),
    reviewStatus: z.string().optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
  })
  .strict()

const verificationRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("onchain_store_reject"),
    accountId: nearAccountIdSchema,
    reason: z.string(),
    errorCode: verificationErrorCodeSchema,
    applicantId: z.string().optional(),
  })
  .strict()

// Token route events (7 new schemas)

const verificationTokenValidationFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_validate_fail"),
    accountId: nearAccountIdSchema,
    reason: z.enum(["signature_format", "signature_crypto", "key_not_full_access", "nonce_replay"]),
    errorCode: verificationErrorCodeSchema.optional(),
    errorMessage: z.string().optional(),
    levelName: z.string().optional(),
  })
  .strict()

const verificationTokenConfigErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_config_error"),
    accountId: nearAccountIdSchema,
    levelName: z.string().optional(),
  })
  .strict()

const verificationTokenAlreadyVerifiedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_already_verified"),
    accountId: nearAccountIdSchema,
    levelName: z.string().optional(),
  })
  .strict()

const verificationTokenApplicantReusedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_applicant_reuse"),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenMetadataStoredEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_metadata_store"),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenGeneratedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_generate"),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_error"),
    accountId: nearAccountIdSchema.optional(),
    errorMessage: z.string(),
  })
  .strict()

// Webhook route events (11 new schemas)

const verificationWebhookAuthFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_auth_fail"),
    reason: z.enum(["missing_signature", "invalid_signature"]),
    accountId: nearAccountIdSchema.optional(),
    applicantId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookParseFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_parse_fail"),
    errors: z.string(),
    accountId: nearAccountIdSchema.optional(),
    applicantId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookReceivedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_receive"),
    type: z.string(),
    applicantId: z.string(),
    externalUserId: z.string().optional(),
    reviewStatus: z.string().optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
    reviewRejectType: sumsubReviewRejectTypeSchema.optional(),
    rejectLabels: z.array(z.string()).optional(),
    buttonIds: z.array(z.string()).optional(),
    moderationComment: z.string().optional(),
    clientComment: z.string().optional(),
    levelName: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
    reviewMode: z.string().optional(),
    sandboxMode: z.boolean().optional(),
    applicantType: z.string().optional(),
    externalUserIdType: z.string().optional(),
    clientId: z.string().optional(),
    createdAtMs: z.string().optional(),
    createdAt: z.string().optional(),
  })
  .strict()

const verificationWebhookMissingUserIdEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_user_missing"),
    applicantId: z.string(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookNotApprovedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_review_reject"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema.optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
    reviewRejectType: sumsubReviewRejectTypeSchema.optional(),
    rejectLabels: z.array(z.string()).optional(),
    buttonIds: z.array(z.string()).optional(),
    moderationComment: z.string().optional(),
    clientComment: z.string().optional(),
    reviewStatus: z.string().optional(),
    levelName: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookPendingReviewEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_review_hold"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema.optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
    reviewRejectType: sumsubReviewRejectTypeSchema.optional(),
    reviewStatus: z.string().optional(),
    levelName: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookLateRejectionEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_review_late_reject"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema,
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
    reviewRejectType: sumsubReviewRejectTypeSchema.optional(),
    rejectLabels: z.array(z.string()).optional(),
  })
  .strict()

const verificationWebhookValidationFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_validation_fail"),
    reason: z.enum([
      "missing_metadata",
      "user_mismatch",
      "signature_format",
      "signature_crypto",
      "key_not_full_access",
    ]),
    applicantId: z.string(),
    accountId: nearAccountIdSchema.optional(),
    errorMessage: z.string().optional(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
    levelName: z.string().optional(),
    reviewStatus: z.string().optional(),
  })
  .strict()

const verificationWebhookConfigErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_config_error"),
    applicantId: z.string(),
    configKey: z.enum(["signing_recipient", "backend_signer"]),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationWebhookStorageFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_storage_fail"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema,
    errorCode: z.string(),
    errorMessage: z.string(),
    reviewStatus: z.string().optional(),
    reviewAnswer: sumsubReviewAnswerSchema.optional(),
  })
  .strict()

const verificationWebhookErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_error"),
    applicantId: z.string().optional(),
    accountId: nearAccountIdSchema.optional(),
    errorMessage: z.string(),
  })
  .strict()

/** All verification events - discriminated by action */
const verificationEventSchema = z.discriminatedUnion("action", [
  // Client-side events - flow lifecycle
  verificationFlowStartedEventSchema,
  verificationCtaClickedEventSchema,
  // Client-side events - wallet connection
  verificationWalletConnectStartedEventSchema,
  verificationWalletConnectFailedEventSchema,
  verificationWalletConnectSucceededEventSchema,
  // Client-side events - message signing
  verificationSignStartedEventSchema,
  verificationSignCompletedEventSchema,
  verificationSignFailedEventSchema,
  // Client-side events - already verified
  verificationAlreadyVerifiedEventSchema,
  // Client-side events - token fetch
  verificationTokenFetchStartedEventSchema,
  verificationTokenFetchSucceededEventSchema,
  verificationTokenFetchFailedEventSchema,
  // Client-side events - polling
  verificationPollingStartedEventSchema,
  verificationPollingTimeoutEventSchema,
  verificationManualReviewShownEventSchema,
  verificationStatusRecoveredEventSchema,
  verificationPollingNetworkErrorEventSchema,
  // Client-side events - SumSub SDK
  verificationSumsubSdkLoadedEventSchema,
  verificationSumsubMessageEventSchema,
  verificationSumsubErrorEventSchema,
  verificationSumsubReadyEventSchema,
  verificationSumsubStepStartedEventSchema,
  verificationSumsubStepCompletedEventSchema,
  verificationSumsubSubmittedEventSchema,
  verificationSumsubRejectedEventSchema,
  verificationSumsubStatusReceivedEventSchema,
  verificationSumsubApplicantLoadedEventSchema,
  verificationPollingApprovedEventSchema,
  verificationTokenRefreshFailedEventSchema,
  // Client-side events - success
  verificationSuccessDisplayedEventSchema,
  verificationSuccessDisconnectClickedEventSchema,
  // Client-side events - errors
  verificationErrorShownEventSchema,
  verificationErrorRetryClickedEventSchema,
  verificationErrorAbandonedEventSchema,
  verificationErrorPageDisplayedEventSchema,
  verificationErrorDisconnectClickedEventSchema,
  verificationErrorPollingFailedEventSchema,
  // Client-side events - hold page
  verificationHoldPageDisplayedEventSchema,
  verificationHoldDisconnectClickedEventSchema,
  verificationHoldPollingFailedEventSchema,
  // Client-side events - verification check
  verificationCheckFailedEventSchema,
  // Server-side events
  verificationProofSubmittedEventSchema,
  verificationProofValidatedEventSchema,
  verificationStoredOnchainEventSchema,
  verificationRejectedEventSchema,
  // Server-side token route events
  verificationTokenValidationFailedEventSchema,
  verificationTokenConfigErrorEventSchema,
  verificationTokenAlreadyVerifiedEventSchema,
  verificationTokenApplicantReusedEventSchema,
  verificationTokenMetadataStoredEventSchema,
  verificationTokenGeneratedEventSchema,
  verificationTokenErrorEventSchema,
  // Server-side webhook route events
  verificationWebhookAuthFailedEventSchema,
  verificationWebhookParseFailedEventSchema,
  verificationWebhookReceivedEventSchema,
  verificationWebhookMissingUserIdEventSchema,
  verificationWebhookNotApprovedEventSchema,
  verificationWebhookPendingReviewEventSchema,
  verificationWebhookLateRejectionEventSchema,
  verificationWebhookValidationFailedEventSchema,
  verificationWebhookConfigErrorEventSchema,
  verificationWebhookStorageFailedEventSchema,
  verificationWebhookErrorEventSchema,
])

// =============================================================================
// Domain: Citizens
// =============================================================================

const citizensEventBase = { domain: z.literal("citizens") } as const

const citizensDetailsViewedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("details_viewed"),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

const citizensSignatureVerifyOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("signature_verify_opened"),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

const citizensCopiedToClipboardEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("copied_to_clipboard"),
    viewedAccountId: nearAccountIdSchema,
    field: z.enum(["hash", "publicKey", "signature"]),
  })
  .strict()

const citizensExternalVerifierOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("external_verifier_opened"),
    viewedAccountId: nearAccountIdSchema,
    verifier: z.enum(["cyphrme", "snarkjs_docs", "self_docs"]),
  })
  .strict()

/** All citizens events - discriminated by action */
const citizensEventSchema = z.discriminatedUnion("action", [
  citizensDetailsViewedEventSchema,
  citizensSignatureVerifyOpenedEventSchema,
  citizensCopiedToClipboardEventSchema,
  citizensExternalVerifierOpenedEventSchema,
])

// =============================================================================
// Domain: Consent
// =============================================================================

const consentEventBase = { domain: z.literal("consent") } as const

const consentResponseEventSchema = z
  .object({
    ...consentEventBase,
    action: z.literal("response"),
    granted: z.boolean(),
  })
  .strict()

/** All consent events - discriminated by action */
const consentEventSchema = z.discriminatedUnion("action", [consentResponseEventSchema])

// =============================================================================
// Domain: Errors
// =============================================================================

const errorsEventBase = { domain: z.literal("errors") } as const

const errorExceptionCapturedEventSchema = z
  .object({
    ...errorsEventBase,
    action: z.literal("exception_captured"),
    errorName: z.string(),
    errorMessage: z.string(),
    errorStack: z.string().optional(),
    stage: z.enum(["client_render", "global_error", "server_handler", "api_route"]),
    componentStack: z.string().optional(),
  })
  .strict()

/** All errors events - discriminated by action */
const errorsEventSchema = z.discriminatedUnion("action", [errorExceptionCapturedEventSchema])

// =============================================================================
// Combined Schema
// =============================================================================

/**
 * All analytics events - union of domain-specific discriminated unions.
 *
 * Uses z.union at the outer level since each domain schema is already
 * a discriminated union on "action". Type safety is preserved through
 * the domain literal on each event schema.
 */
export const analyticsEventSchema = z.union([
  verificationEventSchema,
  citizensEventSchema,
  consentEventSchema,
  errorsEventSchema,
])

// =============================================================================
// Type Exports
// =============================================================================

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>
