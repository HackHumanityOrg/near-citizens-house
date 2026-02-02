/**
 * Analytics Event Schemas
 *
 * Strongly-typed analytics events using Zod discriminated unions.
 * Each domain (verification, citizens, consent) has its own discriminated union on "action".
 * The combined schema uses a regular union since each domain is already discriminated.
 *
 * Event name constants (VERIFICATION_EVENTS, etc.) are derived from this schema -
 * this file is the single source of truth for all analytics events.
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
// Action Constants (Single Source of Truth)
// =============================================================================

/** Verification domain actions */
const V = {
  // Flow lifecycle
  flow_start: "flow_start",
  cta_click: "cta_click",
  // Wallet connection
  wallet_connect_start: "wallet_connect_start",
  wallet_connect_success: "wallet_connect_success",
  wallet_connect_fail: "wallet_connect_fail",
  // Message signing
  sign_start: "sign_start",
  sign_success: "sign_success",
  sign_fail: "sign_fail",
  // Already verified
  already_verified_detect: "already_verified_detect",
  // Token fetch
  token_fetch_start: "token_fetch_start",
  token_fetch_success: "token_fetch_success",
  token_fetch_fail: "token_fetch_fail",
  // Polling
  polling_start: "polling_start",
  polling_timeout: "polling_timeout",
  polling_approve: "polling_approve",
  polling_network_fail: "polling_network_fail",
  // Manual review / status recovery
  manual_review_view: "manual_review_view",
  status_recover: "status_recover",
  // SumSub SDK lifecycle
  sumsub_sdk_load: "sumsub_sdk_load",
  sumsub_message_receive: "sumsub_message_receive",
  sumsub_error_receive: "sumsub_error_receive",
  sumsub_ready: "sumsub_ready",
  sumsub_step_start: "sumsub_step_start",
  sumsub_step_complete: "sumsub_step_complete",
  sumsub_submit: "sumsub_submit",
  sumsub_review_reject: "sumsub_review_reject",
  sumsub_status_receive: "sumsub_status_receive",
  sumsub_applicant_load: "sumsub_applicant_load",
  // Token refresh
  token_refresh_fail: "token_refresh_fail",
  // Success page
  success_view: "success_view",
  success_disconnect_click: "success_disconnect_click",
  // Error modals
  error_modal_view: "error_modal_view",
  error_modal_retry_click: "error_modal_retry_click",
  error_modal_abandon: "error_modal_abandon",
  // Error page
  error_page_view: "error_page_view",
  error_page_disconnect_click: "error_page_disconnect_click",
  error_polling_fail: "error_polling_fail",
  // Hold page
  hold_page_view: "hold_page_view",
  hold_page_disconnect_click: "hold_page_disconnect_click",
  hold_polling_fail: "hold_polling_fail",
  // Verification check
  verification_check_fail: "verification_check_fail",
  // Server-side: proof lifecycle
  proof_submit: "proof_submit",
  proof_validate: "proof_validate",
  onchain_store_success: "onchain_store_success",
  onchain_store_reject: "onchain_store_reject",
  // Server-side: token route
  token_validate_fail: "token_validate_fail",
  token_config_error: "token_config_error",
  token_already_verified: "token_already_verified",
  token_applicant_reuse: "token_applicant_reuse",
  token_applicant_deactivated: "token_applicant_deactivated",
  token_metadata_store: "token_metadata_store",
  token_generate: "token_generate",
  token_error: "token_error",
  // Server-side: webhook route
  webhook_auth_fail: "webhook_auth_fail",
  webhook_parse_fail: "webhook_parse_fail",
  webhook_receive: "webhook_receive",
  webhook_user_missing: "webhook_user_missing",
  webhook_review_reject: "webhook_review_reject",
  webhook_review_hold: "webhook_review_hold",
  webhook_review_late_reject: "webhook_review_late_reject",
  webhook_validation_fail: "webhook_validation_fail",
  webhook_config_error: "webhook_config_error",
  webhook_storage_fail: "webhook_storage_fail",
  webhook_error: "webhook_error",
} as const

/** Citizens domain actions */
const C = {
  details_viewed: "details_viewed",
  signature_verify_opened: "signature_verify_opened",
  copied_to_clipboard: "copied_to_clipboard",
  external_verifier_opened: "external_verifier_opened",
} as const

/** Consent domain actions */
const N = {
  response: "response",
} as const

/** Errors domain actions */
const E = {
  exception_captured: "exception_captured",
} as const

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
    action: z.literal(V.flow_start),
    platform: platformSchema,
  })
  .strict()

// Landing page CTA tracking
const verificationCtaClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.cta_click),
    platform: platformSchema,
    isConnected: z.boolean(),
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

// Wallet connection lifecycle
const verificationWalletConnectStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.wallet_connect_start),
    platform: platformSchema,
  })
  .strict()

const verificationWalletConnectFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.wallet_connect_fail),
    platform: platformSchema,
    errorMessage: z.string(),
  })
  .strict()

const verificationWalletConnectSucceededEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.wallet_connect_success),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Message signing lifecycle
const verificationSignStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sign_start),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sign_success),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sign_fail),
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
    action: z.literal(V.already_verified_detect),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Token fetch lifecycle
const verificationTokenFetchStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_fetch_start),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationTokenFetchSucceededEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_fetch_success),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    durationMs: z.number(),
  })
  .strict()

const verificationTokenFetchFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_fetch_fail),
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
    action: z.literal(V.success_view),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSuccessDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.success_disconnect_click),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationPollingStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.polling_start),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationPollingTimeoutEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.polling_timeout),
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
    action: z.literal(V.manual_review_view),
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
    action: z.literal(V.status_recover),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    recoveredFrom: z.enum(["hold", "error"]),
  })
  .strict()

// SumSub SDK lifecycle events
const verificationSumsubSdkLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_sdk_load),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSumsubMessageEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_message_receive),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    messageType: z.string(),
  })
  .strict()

const verificationSumsubErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_error_receive),
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
    action: z.literal(V.sumsub_ready),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSumsubStepStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_step_start),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    stepType: z.string(),
  })
  .strict()

const verificationSumsubStepCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_step_complete),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    stepType: z.string(),
  })
  .strict()

const verificationSumsubSubmittedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_submit),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Rejection confirmed by webhook or timeout fallback
// source: "webhook" = confirmed by backend status polling, "timeout_fallback" = polling timed out, using WebSDK's last known status
const verificationSumsubRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.sumsub_review_reject),
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
    action: z.literal(V.sumsub_status_receive),
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
    action: z.literal(V.sumsub_applicant_load),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
  })
  .strict()

// Polling confirmed approval
const verificationPollingApprovedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.polling_approve),
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
    action: z.literal(V.error_modal_view),
    errorCode: verificationErrorCodeSchema,
    stage: z.enum(["wallet_connect", "message_sign", "qr_scan", "polling", "unknown"]),
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationErrorRetryClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.error_modal_retry_click),
    errorCode: verificationErrorCodeSchema,
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationErrorAbandonedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.error_modal_abandon),
    errorCode: verificationErrorCodeSchema,
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

// Polling network error (during step-2-sumsub confirmation polling)
const verificationPollingNetworkErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.polling_network_fail),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Token refresh failed (when SDK token expires)
const verificationTokenRefreshFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_refresh_fail),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Error page displayed (user lands on error page)
const verificationErrorPageDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.error_page_view),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorCode: verificationErrorCodeSchema,
  })
  .strict()

// Hold page displayed (user lands on hold page)
const verificationHoldPageDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.hold_page_view),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorCode: verificationErrorCodeSchema.optional(),
  })
  .strict()

// Disconnect from error state
const verificationErrorDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.error_page_disconnect_click),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Disconnect from hold state
const verificationHoldDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.hold_page_disconnect_click),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Error page polling failed
const verificationErrorPollingFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.error_polling_fail),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Hold page polling failed
const verificationHoldPollingFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.hold_polling_fail),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Verification check failed (when checkIsVerified() fails)
const verificationCheckFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.verification_check_fail),
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
    action: z.literal(V.proof_submit),
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
    action: z.literal(V.proof_validate),
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
    action: z.literal(V.onchain_store_success),
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
    action: z.literal(V.onchain_store_reject),
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
    action: z.literal(V.token_validate_fail),
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
    action: z.literal(V.token_config_error),
    accountId: nearAccountIdSchema,
    levelName: z.string().optional(),
  })
  .strict()

const verificationTokenAlreadyVerifiedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_already_verified),
    accountId: nearAccountIdSchema,
    levelName: z.string().optional(),
  })
  .strict()

const verificationTokenApplicantReusedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_applicant_reuse),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenApplicantDeactivatedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_applicant_deactivated),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenMetadataStoredEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_metadata_store),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenGeneratedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_generate),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
    levelName: z.string().optional(),
    externalUserId: z.string().optional(),
  })
  .strict()

const verificationTokenErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.token_error),
    accountId: nearAccountIdSchema.optional(),
    errorMessage: z.string(),
  })
  .strict()

// Webhook route events (11 new schemas)

const verificationWebhookAuthFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.webhook_auth_fail),
    reason: z.enum(["missing_signature", "invalid_signature"]),
    accountId: nearAccountIdSchema.optional(),
    applicantId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookParseFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.webhook_parse_fail),
    errors: z.string(),
    accountId: nearAccountIdSchema.optional(),
    applicantId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookReceivedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.webhook_receive),
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
    action: z.literal(V.webhook_user_missing),
    applicantId: z.string(),
    inspectionId: z.string().optional(),
    correlationId: z.string().optional(),
  })
  .strict()

const verificationWebhookNotApprovedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.webhook_review_reject),
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
    action: z.literal(V.webhook_review_hold),
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
    action: z.literal(V.webhook_review_late_reject),
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
    action: z.literal(V.webhook_validation_fail),
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
    action: z.literal(V.webhook_config_error),
    applicantId: z.string(),
    configKey: z.enum(["signing_recipient", "backend_signer"]),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationWebhookStorageFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal(V.webhook_storage_fail),
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
    action: z.literal(V.webhook_error),
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
  verificationTokenApplicantDeactivatedEventSchema,
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
    action: z.literal(C.details_viewed),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

const citizensSignatureVerifyOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal(C.signature_verify_opened),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

const citizensCopiedToClipboardEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal(C.copied_to_clipboard),
    viewedAccountId: nearAccountIdSchema,
    field: z.enum(["hash", "publicKey", "signature"]),
  })
  .strict()

const citizensExternalVerifierOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal(C.external_verifier_opened),
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
    action: z.literal(N.response),
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
    action: z.literal(E.exception_captured),
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

// =============================================================================
// Event Name Constants (Derived from Action Constants)
// =============================================================================

/** Helper to create event names from domain and actions */
function createEventNames<D extends string, A extends Record<string, string>>(
  domain: D,
  actions: A,
): { [K in keyof A]: `${D}:${A[K]}` } {
  return Object.fromEntries(Object.entries(actions).map(([key, action]) => [key, `${domain}:${action}`])) as {
    [K in keyof A]: `${D}:${A[K]}`
  }
}

/** Verification event names for PostHog queries */
export const VERIFICATION_EVENTS = createEventNames("verification", V)
export type VerificationEventName = (typeof VERIFICATION_EVENTS)[keyof typeof VERIFICATION_EVENTS]

/** Citizens event names for PostHog queries */
export const CITIZENS_EVENTS = createEventNames("citizens", C)
export type CitizensEventName = (typeof CITIZENS_EVENTS)[keyof typeof CITIZENS_EVENTS]

/** Consent event names for PostHog queries */
export const CONSENT_EVENTS = createEventNames("consent", N)
export type ConsentEventName = (typeof CONSENT_EVENTS)[keyof typeof CONSENT_EVENTS]

/** Errors event names for PostHog queries */
export const ERRORS_EVENTS = createEventNames("errors", E)
export type ErrorsEventName = (typeof ERRORS_EVENTS)[keyof typeof ERRORS_EVENTS]

/** All event name constants by domain */
export const ANALYTICS_EVENTS = {
  verification: VERIFICATION_EVENTS,
  citizens: CITIZENS_EVENTS,
  consent: CONSENT_EVENTS,
  errors: ERRORS_EVENTS,
} as const

/** Union of all event names */
export type AnalyticsEventName = VerificationEventName | CitizensEventName | ConsentEventName | ErrorsEventName
