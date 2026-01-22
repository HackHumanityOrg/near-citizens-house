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

// Message signing lifecycle
const verificationSignStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_started"),
    platform: platformSchema,
    sessionId: z.string(),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_completed"),
    platform: platformSchema,
    sessionId: z.string(),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationSignFailedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sign_failed"),
    platform: platformSchema,
    sessionId: z.string(),
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

// Mobile callback flow
const verificationCallbackLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("callback_loaded"),
    sessionId: z.string(),
    hasAccountId: z.boolean(),
    source: z.enum(["url_param", "local_storage", "none"]),
  })
  .strict()

const verificationCallbackPollingStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("callback_polling_started"),
    sessionId: z.string(),
  })
  .strict()

const verificationCallbackResultEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("callback_result"),
    sessionId: z.string(),
    status: z.enum(["success", "error", "expired", "timeout"]),
    pollCount: z.number(),
  })
  .strict()

// Success page
const verificationSuccessDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("success_displayed"),
    platform: platformSchema,
    sessionId: z.string().optional(),
    accountId: nearAccountIdSchema,
    attestationType: z.string().optional(),
  })
  .strict()

const verificationSuccessDisconnectClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("success_disconnect_clicked"),
    accountId: nearAccountIdSchema,
  })
  .strict()

const verificationQrDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("qr_displayed"),
    sessionId: z.string(),
  })
  .strict()

const verificationDeeplinkOpenedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("deeplink_opened"),
    sessionId: z.string(),
  })
  .strict()

const verificationPollingStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_started"),
    sessionId: z.string(),
  })
  .strict()

const verificationPollingTimeoutEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_timeout"),
    sessionId: z.string(),
    pollCount: z.number(),
  })
  .strict()

// SumSub SDK lifecycle events
const verificationSumsubSdkLoadedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_sdk_loaded"),
    sessionId: z.string(),
  })
  .strict()

const verificationSumsubMessageEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_message"),
    sessionId: z.string(),
    messageType: z.string(),
  })
  .strict()

const verificationSumsubErrorEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("sumsub_error"),
    sessionId: z.string(),
    errorMessage: z.string(),
  })
  .strict()

const verificationErrorShownEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_shown"),
    errorCode: z.string(),
    stage: z.enum(["wallet_connect", "message_sign", "qr_scan", "polling", "unknown"]),
  })
  .strict()

const verificationErrorRetryClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_retry_clicked"),
    errorCode: z.string(),
  })
  .strict()

const verificationErrorAbandonedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_abandoned"),
    errorCode: z.string(),
  })
  .strict()

// =============================================================================
// Domain: Verification (Server-Side)
// =============================================================================

const verificationProofSubmittedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("proof_submitted"),
    accountId: nearAccountIdSchema.optional(),
    sessionId: z.string(),
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
    attestationType: z.string(),
    nationality: z.string().optional(),
  })
  .strict()

const verificationRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("rejected"),
    accountId: nearAccountIdSchema.optional(),
    reason: z.string(),
    errorCode: z.string(),
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
  // Client-side events - message signing
  verificationSignStartedEventSchema,
  verificationSignCompletedEventSchema,
  verificationSignFailedEventSchema,
  // Client-side events - already verified
  verificationAlreadyVerifiedEventSchema,
  // Client-side events - QR/polling
  verificationQrDisplayedEventSchema,
  verificationDeeplinkOpenedEventSchema,
  verificationPollingStartedEventSchema,
  verificationPollingTimeoutEventSchema,
  // Client-side events - SumSub SDK
  verificationSumsubSdkLoadedEventSchema,
  verificationSumsubMessageEventSchema,
  verificationSumsubErrorEventSchema,
  // Client-side events - mobile callback
  verificationCallbackLoadedEventSchema,
  verificationCallbackPollingStartedEventSchema,
  verificationCallbackResultEventSchema,
  // Client-side events - success
  verificationSuccessDisplayedEventSchema,
  verificationSuccessDisconnectClickedEventSchema,
  // Client-side events - errors
  verificationErrorShownEventSchema,
  verificationErrorRetryClickedEventSchema,
  verificationErrorAbandonedEventSchema,
  // Server-side events
  verificationProofSubmittedEventSchema,
  verificationProofValidatedEventSchema,
  verificationStoredOnchainEventSchema,
  verificationRejectedEventSchema,
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

const citizensProofVerifyOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("proof_verify_opened"),
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

const citizensFileDownloadedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("file_downloaded"),
    viewedAccountId: nearAccountIdSchema,
    fileType: z.enum(["proof", "public_signals", "verification_key"]),
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
  citizensProofVerifyOpenedEventSchema,
  citizensCopiedToClipboardEventSchema,
  citizensFileDownloadedEventSchema,
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
const analyticsEventSchema = z.union([
  verificationEventSchema,
  citizensEventSchema,
  consentEventSchema,
  errorsEventSchema,
])

// =============================================================================
// Type Exports
// =============================================================================

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>
