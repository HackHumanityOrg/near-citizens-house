/**
 * Log Event Schemas
 *
 * Strongly-typed log events using Zod discriminated unions.
 * Each domain (verification, session, rpc, citizens, auth) has its own discriminated union on "action".
 * The combined schema uses a regular union since each domain is already discriminated.
 *
 * @example
 * ```ts
 * import { logger } from "@/lib/logger"
 * logger.info("verification", "completed", {
 *   accountId: "alice.near",
 *   attestationId: 1,
 *   durationMs: 1500,
 * }, "Verification successful")
 * ```
 */
import { z } from "zod"
import { verificationErrorCodeSchema } from "./errors"
import { nearAccountIdSchema } from "./near"
import { sessionIdSchema, sessionStatusSchema } from "./session"
import { attestationIdSchema } from "./selfxyz"

// ============================================================================
// Log Level Schema
// ============================================================================

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"])

export type LogLevel = z.infer<typeof logLevelSchema>

// ============================================================================
// Log Error Schema
// ============================================================================

export const logErrorSchema = z.object({
  name: z.string(),
  message: z.string(),
  code: verificationErrorCodeSchema.optional(),
  stack: z.string().optional(),
})

export type LogError = z.infer<typeof logErrorSchema>

// ============================================================================
// Structured Log Event Schemas
// ============================================================================
//
// Follows the same pattern as analytics.ts for codebase consistency:
// - Named exports for each event schema
// - .strict() to prevent extra properties
// - Per-domain discriminated unions on "action"
// - Combined z.union at outer level
//
// @see lib/schemas/analytics.ts for reference pattern
// ============================================================================

// --- Base fields for all log events ---
const logEventBase = {
  level: logLevelSchema,
  message: z.string(),
  // Auto-populated by logger (optional in schema)
  timestamp: z.number().optional(),
  requestId: z.string().uuid().optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  distinctId: z.string().optional(),
} as const

// =============================================================================
// Domain: Verification
// =============================================================================

const verificationLogBase = { ...logEventBase, domain: z.literal("verification") } as const

export const verificationStartLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("start"),
    source: z.enum(["button_click", "auto_redirect", "deeplink"]),
  })
  .strict()

export const verificationQrGeneratedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("qr_generated"),
    sessionId: sessionIdSchema,
  })
  .strict()

export const verificationQrScannedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("qr_scanned"),
    sessionId: sessionIdSchema,
  })
  .strict()

export const verificationProofReceivedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("proof_received"),
    sessionId: sessionIdSchema,
    proofType: z.string(),
  })
  .strict()

export const verificationProofValidatedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("proof_validated"),
    sessionId: sessionIdSchema,
    nullifierHash: z.string(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const verificationSignatureValidatedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("signature_validated"),
    accountId: nearAccountIdSchema,
    publicKey: z.string(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const verificationContractCallStartedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("contract_call_started"),
    accountId: nearAccountIdSchema,
    method: z.string(),
  })
  .strict()

export const verificationContractCallCompletedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("contract_call_completed"),
    accountId: nearAccountIdSchema,
    method: z.string(),
    txHash: z.string().optional(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const verificationCompletedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("completed"),
    accountId: nearAccountIdSchema,
    attestationId: attestationIdSchema,
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const verificationFailedLogSchema = z
  .object({
    ...verificationLogBase,
    action: z.literal("failed"),
    accountId: nearAccountIdSchema.optional(),
    errorCode: verificationErrorCodeSchema,
    error: logErrorSchema.optional(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

/** All verification log events - discriminated by action */
export const verificationLogSchema = z.discriminatedUnion("action", [
  verificationStartLogSchema,
  verificationQrGeneratedLogSchema,
  verificationQrScannedLogSchema,
  verificationProofReceivedLogSchema,
  verificationProofValidatedLogSchema,
  verificationSignatureValidatedLogSchema,
  verificationContractCallStartedLogSchema,
  verificationContractCallCompletedLogSchema,
  verificationCompletedLogSchema,
  verificationFailedLogSchema,
])

// =============================================================================
// Domain: Session
// =============================================================================

const sessionLogBase = { ...logEventBase, domain: z.literal("session") } as const

export const sessionCreatedLogSchema = z
  .object({
    ...sessionLogBase,
    action: z.literal("created"),
    sessionId: sessionIdSchema,
  })
  .strict()

export const sessionUpdatedLogSchema = z
  .object({
    ...sessionLogBase,
    action: z.literal("updated"),
    sessionId: sessionIdSchema,
    status: sessionStatusSchema,
    previousStatus: sessionStatusSchema.optional(),
  })
  .strict()

export const sessionExpiredLogSchema = z
  .object({
    ...sessionLogBase,
    action: z.literal("expired"),
    sessionId: sessionIdSchema,
    ageMs: z.number().nonnegative(),
  })
  .strict()

export const sessionDeletedLogSchema = z
  .object({
    ...sessionLogBase,
    action: z.literal("deleted"),
    sessionId: sessionIdSchema,
    reason: z.enum(["completed", "expired", "manual", "error"]),
  })
  .strict()

/** All session log events - discriminated by action */
export const sessionLogSchema = z.discriminatedUnion("action", [
  sessionCreatedLogSchema,
  sessionUpdatedLogSchema,
  sessionExpiredLogSchema,
  sessionDeletedLogSchema,
])

// =============================================================================
// Domain: RPC
// =============================================================================

const rpcLogBase = { ...logEventBase, domain: z.literal("rpc") } as const

export const rpcCallStartedLogSchema = z
  .object({
    ...rpcLogBase,
    action: z.literal("call_started"),
    provider: z.string(),
    method: z.string(),
  })
  .strict()

export const rpcCallCompletedLogSchema = z
  .object({
    ...rpcLogBase,
    action: z.literal("call_completed"),
    provider: z.string(),
    method: z.string(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const rpcCallFailedLogSchema = z
  .object({
    ...rpcLogBase,
    action: z.literal("call_failed"),
    provider: z.string(),
    method: z.string(),
    error: logErrorSchema,
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const rpcFallbackUsedLogSchema = z
  .object({
    ...rpcLogBase,
    action: z.literal("fallback_used"),
    primaryProvider: z.string(),
    fallbackProvider: z.string(),
    reason: z.string(),
  })
  .strict()

/** All RPC log events - discriminated by action */
export const rpcLogSchema = z.discriminatedUnion("action", [
  rpcCallStartedLogSchema,
  rpcCallCompletedLogSchema,
  rpcCallFailedLogSchema,
  rpcFallbackUsedLogSchema,
])

// =============================================================================
// Domain: Citizens
// =============================================================================

const citizensLogBase = { ...logEventBase, domain: z.literal("citizens") } as const

export const citizensPageLoadedLogSchema = z
  .object({
    ...citizensLogBase,
    action: z.literal("page_loaded"),
    page: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
  })
  .strict()

export const citizensFetchedLogSchema = z
  .object({
    ...citizensLogBase,
    action: z.literal("fetched"),
    count: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const citizensClickedLogSchema = z
  .object({
    ...citizensLogBase,
    action: z.literal("citizen_clicked"),
    citizenAccountId: nearAccountIdSchema,
  })
  .strict()

/** All citizens log events - discriminated by action */
export const citizensLogSchema = z.discriminatedUnion("action", [
  citizensPageLoadedLogSchema,
  citizensFetchedLogSchema,
  citizensClickedLogSchema,
])

// =============================================================================
// Domain: Auth
// =============================================================================

const authLogBase = { ...logEventBase, domain: z.literal("auth") } as const

export const authSignatureRequestedLogSchema = z
  .object({
    ...authLogBase,
    action: z.literal("signature_requested"),
    accountId: nearAccountIdSchema,
    challenge: z.string(),
  })
  .strict()

export const authSignatureValidatedLogSchema = z
  .object({
    ...authLogBase,
    action: z.literal("signature_validated"),
    accountId: nearAccountIdSchema,
    publicKey: z.string(),
    durationMs: z.number().nonnegative(),
  })
  .strict()

export const authSignatureInvalidLogSchema = z
  .object({
    ...authLogBase,
    action: z.literal("signature_invalid"),
    accountId: nearAccountIdSchema,
    reason: z.string(),
  })
  .strict()

export const authNonceDuplicateLogSchema = z
  .object({
    ...authLogBase,
    action: z.literal("nonce_duplicate"),
    nonce: z.string(),
    originalTimestamp: z.number(),
  })
  .strict()

/** All auth log events - discriminated by action */
export const authLogSchema = z.discriminatedUnion("action", [
  authSignatureRequestedLogSchema,
  authSignatureValidatedLogSchema,
  authSignatureInvalidLogSchema,
  authNonceDuplicateLogSchema,
])

// =============================================================================
// Combined Schema
// =============================================================================

/**
 * All log events - union of domain-specific discriminated unions.
 *
 * Uses z.union at the outer level since each domain schema is already
 * a discriminated union on "action". Type safety is preserved through
 * the domain literal on each event schema.
 *
 * @see lib/schemas/analytics.ts for the same pattern
 */
export const logEventSchema = z.union([
  verificationLogSchema,
  sessionLogSchema,
  rpcLogSchema,
  citizensLogSchema,
  authLogSchema,
])

// =============================================================================
// Type Exports
// =============================================================================

export type LogEvent = z.infer<typeof logEventSchema>
export type VerificationLog = z.infer<typeof verificationLogSchema>
export type SessionLog = z.infer<typeof sessionLogSchema>
export type RpcLog = z.infer<typeof rpcLogSchema>
export type CitizensLog = z.infer<typeof citizensLogSchema>
export type AuthLog = z.infer<typeof authLogSchema>

// Individual event types (for type narrowing)
export type VerificationStartLog = z.infer<typeof verificationStartLogSchema>
export type VerificationQrGeneratedLog = z.infer<typeof verificationQrGeneratedLogSchema>
export type VerificationQrScannedLog = z.infer<typeof verificationQrScannedLogSchema>
export type VerificationProofReceivedLog = z.infer<typeof verificationProofReceivedLogSchema>
export type VerificationProofValidatedLog = z.infer<typeof verificationProofValidatedLogSchema>
export type VerificationSignatureValidatedLog = z.infer<typeof verificationSignatureValidatedLogSchema>
export type VerificationContractCallStartedLog = z.infer<typeof verificationContractCallStartedLogSchema>
export type VerificationContractCallCompletedLog = z.infer<typeof verificationContractCallCompletedLogSchema>
export type VerificationCompletedLog = z.infer<typeof verificationCompletedLogSchema>
export type VerificationFailedLog = z.infer<typeof verificationFailedLogSchema>
export type SessionCreatedLog = z.infer<typeof sessionCreatedLogSchema>
export type SessionUpdatedLog = z.infer<typeof sessionUpdatedLogSchema>
export type SessionExpiredLog = z.infer<typeof sessionExpiredLogSchema>
export type SessionDeletedLog = z.infer<typeof sessionDeletedLogSchema>
export type RpcCallStartedLog = z.infer<typeof rpcCallStartedLogSchema>
export type RpcCallCompletedLog = z.infer<typeof rpcCallCompletedLogSchema>
export type RpcCallFailedLog = z.infer<typeof rpcCallFailedLogSchema>
export type RpcFallbackUsedLog = z.infer<typeof rpcFallbackUsedLogSchema>
export type CitizensPageLoadedLog = z.infer<typeof citizensPageLoadedLogSchema>
export type CitizensFetchedLog = z.infer<typeof citizensFetchedLogSchema>
export type CitizensClickedLog = z.infer<typeof citizensClickedLogSchema>
export type AuthSignatureRequestedLog = z.infer<typeof authSignatureRequestedLogSchema>
export type AuthSignatureValidatedLog = z.infer<typeof authSignatureValidatedLogSchema>
export type AuthSignatureInvalidLog = z.infer<typeof authSignatureInvalidLogSchema>
export type AuthNonceDuplicateLog = z.infer<typeof authNonceDuplicateLogSchema>

// Helper types (prefixed with Log to avoid collision with analytics.ts)
export type LogDomain = LogEvent["domain"]
export type LogVerificationAction = VerificationLog["action"]
export type LogSessionAction = SessionLog["action"]
export type LogRpcAction = RpcLog["action"]
export type LogCitizensAction = CitizensLog["action"]
export type LogAuthAction = AuthLog["action"]

// =============================================================================
// Type Helpers for Logger
// =============================================================================

/**
 * Maps a domain to its corresponding log schema type.
 */
export type LogSchemaForDomain<D extends LogDomain> = D extends "verification"
  ? VerificationLog
  : D extends "session"
    ? SessionLog
    : D extends "rpc"
      ? RpcLog
      : D extends "citizens"
        ? CitizensLog
        : D extends "auth"
          ? AuthLog
          : never

/**
 * Gets available actions for a specific domain.
 */
export type LogActionForDomain<D extends LogDomain> = LogSchemaForDomain<D>["action"]

/**
 * Gets the log event type for a specific domain and action combination.
 */
export type LogEventForAction<D extends LogDomain, A extends LogActionForDomain<D>> = Extract<
  LogSchemaForDomain<D>,
  { action: A }
>

// ============================================================================
// Log Event Helpers
// ============================================================================

/** Serialize an Error object into the log error format */
export function serializeError(error: unknown): LogError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Extract code if it's a known verification error
      code:
        "code" in error && typeof error.code === "string"
          ? verificationErrorCodeSchema.safeParse(error.code).data
          : undefined,
    }
  }
  return {
    name: "UnknownError",
    message: String(error),
  }
}

/** Validate a log event (useful for API route receiving frontend logs) */
export function parseLogEvent(data: unknown): LogEvent | null {
  const result = logEventSchema.safeParse(data)
  return result.success ? result.data : null
}
