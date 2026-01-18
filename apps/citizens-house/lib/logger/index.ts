/**
 * Logger Module
 *
 * Provides structured, type-safe logging with OpenTelemetry integration.
 *
 * ## Server Usage
 * ```ts
 * import { logger, serializeError, withRequestContext, getRequestContext } from "@/lib/logger/server"
 *
 * // In API routes
 * await withRequestContext({ requestId: crypto.randomUUID(), route: "/api/verify" }, async () => {
 *   logger.info("verification", "start", { source: "button_click" }, "Started verification")
 *   // requestId automatically attached to log
 * })
 * ```
 *
 * ## Client Usage
 * ```ts
 * import { logger, serializeError } from "@/lib/logger/client"
 *
 * logger.info("verification", "start", { source: "button_click" }, "Started verification")
 * ```
 *
 * ## Why Separate Imports?
 * - Server logger uses AsyncLocalStorage (Node.js only)
 * - Server logger uses pino-opentelemetry-transport for OTEL export
 * - Client logger uses sendBeacon for reliable delivery
 * - Keeps bundle size small by avoiding server code in client bundle
 */

// Re-export schemas and types for convenience
export type {
  LogLevel,
  LogDomain,
  LogEvent,
  VerificationLog,
  SessionLog,
  RpcLog,
  CitizensLog,
  AuthLog,
  LogError,
  LogActionForDomain,
  LogEventForAction,
} from "@/lib/schemas/log"

export { logEventSchema, logLevelSchema, logErrorSchema, serializeError, parseLogEvent } from "@/lib/schemas/log"
