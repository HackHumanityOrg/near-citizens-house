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
 * trackEvent({ domain: "verification", action: "flow_started", platform: "desktop" })
 * ```
 */
import { z } from "zod"
import { verificationErrorCodeSchema } from "./errors"
import { nearAccountIdSchema } from "./near"

// =============================================================================
// Domain: Verification (Client-Side)
// =============================================================================

const verificationEventBase = { domain: z.literal("verification") } as const

const platformSchema = z.enum(["desktop", "mobile"])

const verificationFlowStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("flow_started"),
    platform: platformSchema,
  })
  .strict()

// Landing page CTA tracking
const verificationCtaClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("cta_clicked"),
    platform: platformSchema,
    isConnected: z.boolean(),
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

// Wallet connection lifecycle
const verificationWalletConnectStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("wallet_connect_started"),
    platform: platformSchema,
  })
  .strict()

const verificationWalletConnectFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("wallet_connect_failed"),
    platform: platformSchema,
    errorMessage: z.string(),
  })
  .strict()

const verificationWalletConnectSucceededEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("wallet_connect_succeeded"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Message signing lifecycle
const verificationSignStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_started"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_completed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_failed"),
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
    action: z.literal("already_verified"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Token fetch lifecycle
const verificationTokenFetchStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_fetch_started"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationTokenFetchSucceededEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_fetch_succeeded"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    durationMs: z.number(),
  })
  .strict()

const verificationTokenFetchFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_fetch_failed"),
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
    action: z.literal("success_displayed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSuccessDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("success_disconnect_clicked"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationPollingStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_started"),
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
  })
  .strict()

const verificationManualReviewShownEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("manual_review_shown"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationStatusRecoveredEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("status_recovered"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    recoveredFrom: z.enum(["hold", "error"]),
  })
  .strict()

// SumSub SDK lifecycle events
const verificationSumsubSdkLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_sdk_loaded"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSumsubMessageEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_message"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    messageType: z.string(),
  })
  .strict()

const verificationSumsubErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_error"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Granular SumSub SDK events for better signal-to-noise
const sumsubReviewAnswerSchema = z.enum(["GREEN", "RED", "YELLOW"])

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
    action: z.literal("sumsub_step_started"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    stepType: z.string(),
  })
  .strict()

const verificationSumsubStepCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_step_completed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    stepType: z.string(),
  })
  .strict()

const verificationSumsubSubmittedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_submitted"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Rejection confirmed by webhook or timeout fallback
// source: "webhook" = confirmed by backend status polling, "timeout_fallback" = polling timed out, using WebSDK's last known status
const verificationSumsubRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_rejected"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    reviewAnswer: sumsubReviewAnswerSchema,
    source: z.enum(["webhook", "timeout_fallback"]),
  })
  .strict()

// Raw WebSDK status received - for analytics tracking (not trusted as final source of truth)
const verificationSumsubStatusReceivedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_status_received"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    reviewAnswer: z.string(),
    reviewStatus: z.string(),
  })
  .strict()

// Applicant loaded in WebSDK
const verificationSumsubApplicantLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_applicant_loaded"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Polling confirmed approval
const verificationPollingApprovedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_approved"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    source: z.enum(["webhook", "timeout_fallback"]),
  })
  .strict()

const verificationErrorShownEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_shown"),
    errorCode: verificationErrorCodeSchema,
    stage: z.enum(["wallet_connect", "message_sign", "qr_scan", "polling", "unknown"]),
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationErrorRetryClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_retry_clicked"),
    errorCode: verificationErrorCodeSchema,
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationErrorAbandonedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_abandoned"),
    errorCode: verificationErrorCodeSchema,
    platform: platformSchema,
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

// Polling network error (during step-2-sumsub confirmation polling)
const verificationPollingNetworkErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_network_error"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Token refresh failed (when SDK token expires)
const verificationTokenRefreshFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_refresh_failed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Error page displayed (user lands on error page)
const verificationErrorPageDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_page_displayed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorCode: verificationErrorCodeSchema,
  })
  .strict()

// Hold page displayed (user lands on hold page)
const verificationHoldPageDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("hold_page_displayed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Disconnect from error state
const verificationErrorDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_disconnect_clicked"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Disconnect from hold state
const verificationHoldDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("hold_disconnect_clicked"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
  })
  .strict()

// Error page polling failed
const verificationErrorPollingFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_polling_failed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Hold page polling failed
const verificationHoldPollingFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("hold_polling_failed"),
    platform: platformSchema,
    accountId: nearAccountIdSchema,
    errorMessage: z.string(),
  })
  .strict()

// Verification check failed (when checkIsVerified() fails)
const verificationCheckFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("verification_check_failed"),
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
    action: z.literal("proof_submitted"),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationProofValidatedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("proof_validated"),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationStoredOnchainEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("stored_onchain"),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("rejected"),
    accountId: nearAccountIdSchema,
    reason: z.string(),
    errorCode: verificationErrorCodeSchema,
  })
  .strict()

// Token route events (7 new schemas)

const verificationTokenValidationFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_validation_failed"),
    accountId: nearAccountIdSchema,
    reason: z.enum(["signature_format", "signature_crypto", "key_not_full_access", "nonce_replay"]),
    errorCode: verificationErrorCodeSchema.optional(),
    errorMessage: z.string().optional(),
  })
  .strict()

const verificationTokenConfigErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_config_error"),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationTokenAlreadyVerifiedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_already_verified"),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationTokenApplicantReusedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_applicant_reused"),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
  })
  .strict()

const verificationTokenMetadataStoredEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_metadata_stored"),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
  })
  .strict()

const verificationTokenGeneratedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("token_generated"),
    accountId: nearAccountIdSchema,
    applicantId: z.string(),
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
    action: z.literal("webhook_auth_failed"),
    reason: z.enum(["missing_signature", "invalid_signature"]),
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationWebhookParseFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_parse_failed"),
    errors: z.string(),
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationWebhookReceivedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_received"),
    type: z.string(),
    applicantId: z.string(),
    externalUserId: z.string(),
    reviewStatus: z.string(),
  })
  .strict()

const verificationWebhookMissingUserIdEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_missing_user_id"),
    applicantId: z.string(),
  })
  .strict()

const verificationWebhookNotApprovedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_not_approved"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema.optional(),
    reviewAnswer: z.string(),
    rejectLabels: z.string(),
  })
  .strict()

const verificationWebhookPendingReviewEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_pending_review"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema.optional(),
  })
  .strict()

const verificationWebhookLateRejectionEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_late_rejection"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationWebhookValidationFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("webhook_validation_failed"),
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
    action: z.literal("webhook_storage_failed"),
    applicantId: z.string(),
    accountId: nearAccountIdSchema,
    errorCode: z.string(),
    errorMessage: z.string(),
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
