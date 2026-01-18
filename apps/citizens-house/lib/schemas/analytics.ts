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

export const verificationFlowStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("flow_started"),
    platform: z.enum(["desktop", "mobile"]),
  })
  .strict()

export const verificationQrDisplayedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("qr_displayed"),
    sessionId: z.string(),
  })
  .strict()

export const verificationDeeplinkOpenedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("deeplink_opened"),
    sessionId: z.string(),
  })
  .strict()

export const verificationPollingStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_started"),
    sessionId: z.string(),
  })
  .strict()

export const verificationPollingTimeoutEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("polling_timeout"),
    sessionId: z.string(),
    pollCount: z.number(),
  })
  .strict()

export const verificationErrorShownEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_shown"),
    errorCode: z.string(),
    stage: z.enum(["wallet_connect", "message_sign", "qr_scan", "polling", "unknown"]),
  })
  .strict()

export const verificationErrorRetryClickedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_retry_clicked"),
    errorCode: z.string(),
  })
  .strict()

export const verificationErrorAbandonedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("error_abandoned"),
    errorCode: z.string(),
  })
  .strict()

// =============================================================================
// Domain: Verification (Server-Side)
// =============================================================================

export const verificationProofSubmittedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("proof_submitted"),
    accountId: nearAccountIdSchema.optional(),
    sessionId: z.string(),
  })
  .strict()

export const verificationProofValidatedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("proof_validated"),
    accountId: nearAccountIdSchema,
  })
  .strict()

export const verificationStoredOnchainEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("stored_onchain"),
    accountId: nearAccountIdSchema,
    attestationType: z.string(),
  })
  .strict()

export const verificationRejectedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("rejected"),
    accountId: nearAccountIdSchema.optional(),
    reason: z.string(),
    errorCode: z.string(),
  })
  .strict()

/** All verification events - discriminated by action */
export const verificationEventSchema = z.discriminatedUnion("action", [
  // Client-side events
  verificationFlowStartedEventSchema,
  verificationQrDisplayedEventSchema,
  verificationDeeplinkOpenedEventSchema,
  verificationPollingStartedEventSchema,
  verificationPollingTimeoutEventSchema,
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

export const citizensDetailsViewedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("details_viewed"),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

export const citizensSignatureVerifyOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("signature_verify_opened"),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

export const citizensProofVerifyOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("proof_verify_opened"),
    viewedAccountId: nearAccountIdSchema,
  })
  .strict()

export const citizensCopiedToClipboardEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("copied_to_clipboard"),
    viewedAccountId: nearAccountIdSchema,
    field: z.enum(["hash", "publicKey", "signature"]),
  })
  .strict()

export const citizensFileDownloadedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("file_downloaded"),
    viewedAccountId: nearAccountIdSchema,
    fileType: z.enum(["proof", "public_signals", "verification_key"]),
  })
  .strict()

export const citizensExternalVerifierOpenedEventSchema = z
  .object({
    ...citizensEventBase,
    action: z.literal("external_verifier_opened"),
    viewedAccountId: nearAccountIdSchema,
    verifier: z.enum(["cyphrme", "snarkjs_docs", "self_docs"]),
  })
  .strict()

/** All citizens events - discriminated by action */
export const citizensEventSchema = z.discriminatedUnion("action", [
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

export const consentResponseEventSchema = z
  .object({
    ...consentEventBase,
    action: z.literal("response"),
    granted: z.boolean(),
  })
  .strict()

/** All consent events - discriminated by action */
export const consentEventSchema = z.discriminatedUnion("action", [consentResponseEventSchema])

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
export const analyticsEventSchema = z.union([verificationEventSchema, citizensEventSchema, consentEventSchema])

// =============================================================================
// Type Exports
// =============================================================================

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>
export type VerificationEvent = z.infer<typeof verificationEventSchema>
export type CitizensEvent = z.infer<typeof citizensEventSchema>
export type ConsentEvent = z.infer<typeof consentEventSchema>

// Individual event types (for type narrowing)
export type VerificationFlowStartedEvent = z.infer<typeof verificationFlowStartedEventSchema>
export type VerificationQrDisplayedEvent = z.infer<typeof verificationQrDisplayedEventSchema>
export type VerificationDeeplinkOpenedEvent = z.infer<typeof verificationDeeplinkOpenedEventSchema>
export type VerificationPollingStartedEvent = z.infer<typeof verificationPollingStartedEventSchema>
export type VerificationPollingTimeoutEvent = z.infer<typeof verificationPollingTimeoutEventSchema>
export type VerificationErrorShownEvent = z.infer<typeof verificationErrorShownEventSchema>
export type VerificationErrorRetryClickedEvent = z.infer<typeof verificationErrorRetryClickedEventSchema>
export type VerificationErrorAbandonedEvent = z.infer<typeof verificationErrorAbandonedEventSchema>
export type VerificationProofSubmittedEvent = z.infer<typeof verificationProofSubmittedEventSchema>
export type VerificationProofValidatedEvent = z.infer<typeof verificationProofValidatedEventSchema>
export type VerificationStoredOnchainEvent = z.infer<typeof verificationStoredOnchainEventSchema>
export type VerificationRejectedEvent = z.infer<typeof verificationRejectedEventSchema>
export type CitizensDetailsViewedEvent = z.infer<typeof citizensDetailsViewedEventSchema>
export type CitizensSignatureVerifyOpenedEvent = z.infer<typeof citizensSignatureVerifyOpenedEventSchema>
export type CitizensProofVerifyOpenedEvent = z.infer<typeof citizensProofVerifyOpenedEventSchema>
export type CitizensCopiedToClipboardEvent = z.infer<typeof citizensCopiedToClipboardEventSchema>
export type CitizensFileDownloadedEvent = z.infer<typeof citizensFileDownloadedEventSchema>
export type CitizensExternalVerifierOpenedEvent = z.infer<typeof citizensExternalVerifierOpenedEventSchema>
export type ConsentResponseEvent = z.infer<typeof consentResponseEventSchema>

// Helper types
export type EventDomain = AnalyticsEvent["domain"]
export type VerificationAction = VerificationEvent["action"]
export type CitizensAction = CitizensEvent["action"]
export type ConsentAction = ConsentEvent["action"]
