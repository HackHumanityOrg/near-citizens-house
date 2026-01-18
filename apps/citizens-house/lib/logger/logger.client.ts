/**
 * Client-Side Logger
 *
 * Pino logger for browser with immediate transmit to /api/logs endpoint.
 * Correlates logs with PostHog user identity for user journey tracking.
 *
 * @example
 * ```ts
 * import { logger } from "@/lib/logger"
 *
 * logger.info("verification", "start", {
 *   source: "button_click",
 * }, "User started verification")
 * ```
 */
import pino from "pino"
import posthog from "posthog-js"
import {
  serializeError,
  type LogLevel,
  type LogDomain,
  type LogActionForDomain,
  type LogEventForAction,
} from "@/lib/schemas/log"

// Base fields that are auto-populated and should be omitted from user input
type BaseFieldsToOmit =
  | "level"
  | "domain"
  | "action"
  | "message"
  | "timestamp"
  | "requestId"
  | "traceId"
  | "spanId"
  | "distinctId"

/**
 * Browser Pino logger with transmit to backend.
 *
 * Uses sendBeacon for reliable delivery even on page unload.
 * Correlates with PostHog distinct_id for user journey analysis.
 */
const pinoLogger = pino({
  browser: {
    asObject: true,
    transmit: {
      level: "debug",
      send: (_level, logEvent) => {
        // Get PostHog distinct_id for user correlation
        const distinctId = posthog.get_distinct_id?.()

        // Build payload for backend
        const payload = {
          level: logEvent.level.label,
          messages: logEvent.messages,
          bindings: logEvent.bindings,
          ts: logEvent.ts,
          distinctId,
          url: typeof window !== "undefined" ? window.location.href : undefined,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        }

        // Use sendBeacon for reliable delivery (survives page unload)
        if (typeof navigator !== "undefined" && navigator.sendBeacon) {
          navigator.sendBeacon("/api/logs", JSON.stringify(payload))
        }
      },
    },
  },
})

/**
 * Type-safe structured logging for browser.
 *
 * @example
 * ```ts
 * logger.info("verification", "start", {
 *   source: "button_click",
 * }, "User started verification")
 * ```
 */
function log<D extends LogDomain, A extends LogActionForDomain<D>>(
  level: LogLevel,
  domain: D,
  action: A,
  data: Omit<LogEventForAction<D, A>, BaseFieldsToOmit>,
  message: string,
): void {
  const event = {
    level,
    domain,
    action,
    message,
    timestamp: Date.now(),
    ...data,
  }

  // Browser Pino with asObject: true expects just the object (message is in the event)
  // Use type assertion - our schema types are correct but Pino's generics are strict
  ;(pinoLogger[level] as (obj: object) => void)(event)
}

/**
 * Strongly-typed logger with level-specific methods.
 */
export const logger = {
  debug: <D extends LogDomain, A extends LogActionForDomain<D>>(
    domain: D,
    action: A,
    data: Omit<LogEventForAction<D, A>, BaseFieldsToOmit>,
    message: string,
  ) => log("debug", domain, action, data, message),

  info: <D extends LogDomain, A extends LogActionForDomain<D>>(
    domain: D,
    action: A,
    data: Omit<LogEventForAction<D, A>, BaseFieldsToOmit>,
    message: string,
  ) => log("info", domain, action, data, message),

  warn: <D extends LogDomain, A extends LogActionForDomain<D>>(
    domain: D,
    action: A,
    data: Omit<LogEventForAction<D, A>, BaseFieldsToOmit>,
    message: string,
  ) => log("warn", domain, action, data, message),

  error: <D extends LogDomain, A extends LogActionForDomain<D>>(
    domain: D,
    action: A,
    data: Omit<LogEventForAction<D, A>, BaseFieldsToOmit>,
    message: string,
  ) => log("error", domain, action, data, message),
}

// Re-export serializeError for convenience
export { serializeError }
