/**
 * Analytics Event Schemas
 *
 * Strongly-typed analytics events using Zod discriminated unions.
 * Each domain (wallet, verification) has its own discriminated union on "action".
 * The combined schema uses a regular union since each domain is already discriminated.
 *
 * @example
 * ```ts
 * import { trackEvent } from "@/lib/analytics"
 * trackEvent({ domain: "wallet", action: "connected", accountId: "alice.near" })
 * ```
 */
import { z } from "zod"
import { nearAccountIdSchema } from "./near"

// =============================================================================
// Domain: Wallet
// =============================================================================

const walletEventBase = { domain: z.literal("wallet") } as const

export const walletConnectedEventSchema = z
  .object({
    ...walletEventBase,
    action: z.literal("connected"),
    accountId: nearAccountIdSchema,
    walletType: z.string().optional(),
  })
  .strict()

export const walletDisconnectedEventSchema = z
  .object({
    ...walletEventBase,
    action: z.literal("disconnected"),
    accountId: nearAccountIdSchema,
  })
  .strict()

export const walletSignatureRequestedEventSchema = z
  .object({
    ...walletEventBase,
    action: z.literal("signature_requested"),
    accountId: nearAccountIdSchema,
    messageType: z.enum(["verification", "transaction"]),
  })
  .strict()

export const walletSignatureCompletedEventSchema = z
  .object({
    ...walletEventBase,
    action: z.literal("signature_completed"),
    accountId: nearAccountIdSchema,
    success: z.boolean(),
  })
  .strict()

/** All wallet events - discriminated by action */
export const walletEventSchema = z.discriminatedUnion("action", [
  walletConnectedEventSchema,
  walletDisconnectedEventSchema,
  walletSignatureRequestedEventSchema,
  walletSignatureCompletedEventSchema,
])

// =============================================================================
// Domain: Verification
// =============================================================================

const verificationEventBase = { domain: z.literal("verification") } as const

export const verificationStartedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("started"),
    accountId: nearAccountIdSchema,
  })
  .strict()

export const verificationQrScannedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("qr_scanned"),
    accountId: nearAccountIdSchema,
  })
  .strict()

export const verificationCompletedEventSchema = z
  .object({
    ...verificationEventBase,
    action: z.literal("completed"),
    accountId: nearAccountIdSchema,
    success: z.boolean(),
    errorCode: z.string().optional(),
  })
  .strict()

/** All verification events - discriminated by action */
export const verificationEventSchema = z.discriminatedUnion("action", [
  verificationStartedEventSchema,
  verificationQrScannedEventSchema,
  verificationCompletedEventSchema,
])

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
export const analyticsEventSchema = z.union([walletEventSchema, verificationEventSchema])

// =============================================================================
// Type Exports
// =============================================================================

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>
export type WalletEvent = z.infer<typeof walletEventSchema>
export type VerificationEvent = z.infer<typeof verificationEventSchema>

// Individual event types (for type narrowing)
export type WalletConnectedEvent = z.infer<typeof walletConnectedEventSchema>
export type WalletDisconnectedEvent = z.infer<typeof walletDisconnectedEventSchema>
export type WalletSignatureRequestedEvent = z.infer<typeof walletSignatureRequestedEventSchema>
export type WalletSignatureCompletedEvent = z.infer<typeof walletSignatureCompletedEventSchema>
export type VerificationStartedEvent = z.infer<typeof verificationStartedEventSchema>
export type VerificationQrScannedEvent = z.infer<typeof verificationQrScannedEventSchema>
export type VerificationCompletedEvent = z.infer<typeof verificationCompletedEventSchema>

// Helper types
export type EventDomain = AnalyticsEvent["domain"]
export type WalletAction = WalletEvent["action"]
export type VerificationAction = VerificationEvent["action"]
