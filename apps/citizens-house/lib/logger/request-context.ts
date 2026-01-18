/**
 * RequestContext - Builder pattern for wide event logging
 *
 * A single RequestContext accumulates structured data throughout a request lifecycle,
 * then emits one comprehensive log event with all context, timings, and PostHog correlation.
 *
 * Usage:
 * ```typescript
 * const ctx = createVerifyContext()
 * ctx.setMany({ route: "/api/verify", method: "POST" })
 * ctx.startTimer("selfxyzVerify")
 * // ... perform verification
 * ctx.endTimer("selfxyzVerify")
 * ctx.set("outcome", "success")
 * ctx.emit("info")
 * ```
 *
 * Type Safety:
 * - Each factory function returns a context typed for its event
 * - Invalid keys, values, or timer names are compile-time errors
 * - Use createVerifyContext(), createStatusContext(), etc.
 */

import { logger } from "./server"
import { setNestedProperty, getNestedProperty } from "./helpers"
import type {
  LogLevel,
  WideEvent,
  VerifyRequestEvent,
  StatusRequestEvent,
  GetVerificationsEvent,
  CheckIsVerifiedEvent,
} from "./types"
import type { EventPaths, EventTimers, PathValue } from "./paths"

/**
 * Strongly-typed RequestContext for wide event logging.
 *
 * Generic over the event type E to provide compile-time safety for:
 * - Field paths (set/get)
 * - Timer names (startTimer/endTimer)
 * - Field value types
 */
export class RequestContext<E extends WideEvent> {
  private data: Record<string, unknown> = {}
  private timers: Map<string, number> = new Map()
  private readonly startTime: number
  readonly requestId: string

  constructor() {
    this.startTime = performance.now()
    this.requestId = crypto.randomUUID()
    this.data.requestId = this.requestId
  }

  /**
   * Set a single field on the event
   *
   * Supports nested paths using dot notation:
   * - ctx.set("error.code", "INVALID") sets event.error.code = "INVALID"
   * - ctx.set("outcome", "success") sets event.outcome = "success"
   *
   * Type-safe: only valid paths for this event type are accepted.
   */
  set<P extends EventPaths<E>>(key: P, value: PathValue<E, P>): this {
    const keyStr = key as string
    if (keyStr.includes(".")) {
      setNestedProperty(this.data, keyStr, value)
    } else {
      this.data[keyStr] = value
    }
    return this
  }

  /**
   * Set multiple fields at once
   *
   * Useful for setting initial context:
   * ctx.setMany({ route: "/api/verify", method: "POST", distinctId })
   */
  setMany(values: Partial<Record<EventPaths<E>, unknown>>): this {
    for (const [key, value] of Object.entries(values)) {
      const keyStr = key as string
      if (keyStr.includes(".")) {
        setNestedProperty(this.data, keyStr, value)
      } else {
        this.data[keyStr] = value
      }
    }
    return this
  }

  /**
   * Get a field value (supports nested paths)
   *
   * Type-safe: only valid paths for this event type are accepted.
   */
  get<P extends EventPaths<E>>(key: P): PathValue<E, P> | undefined {
    const keyStr = key as string
    if (keyStr.includes(".")) {
      return getNestedProperty(this.data, keyStr) as PathValue<E, P> | undefined
    }
    return this.data[keyStr] as PathValue<E, P> | undefined
  }

  /**
   * Start a timer for measuring operation duration
   *
   * Timer names become fields in timings.{name}
   *
   * Type-safe: only valid timer names for this event type are accepted.
   */
  startTimer(name: EventTimers<E>): void {
    this.timers.set(name as string, performance.now())
  }

  /**
   * End a timer and record the duration
   *
   * Duration is recorded as timings.{name} in milliseconds
   *
   * Type-safe: only valid timer names for this event type are accepted.
   */
  endTimer(name: EventTimers<E>): void {
    const startTime = this.timers.get(name as string)
    if (startTime !== undefined) {
      const duration = Math.round(performance.now() - startTime)
      setNestedProperty(this.data, `timings.${name as string}`, duration)
      this.timers.delete(name as string)
    }
  }

  /**
   * Emit the final wide event
   *
   * Adds total timing, timestamp, and logs to both console and PostHog.
   * Silent fails - never throws.
   */
  emit(level: LogLevel): void {
    try {
      // Add total timing
      const totalMs = Math.round(performance.now() - this.startTime)
      setNestedProperty(this.data, "timings.total", totalMs)

      // Add timestamp
      this.data.timestamp = Date.now()

      // Build the log attributes, flattening nested objects for PostHog
      const attributes = this.flattenForLogging(this.data)

      // Log via the server logger (console + PostHog)
      logger[level]("request_complete", attributes)
    } catch {
      // Silent fail - logging should never break the request
    }
  }

  /**
   * Flatten nested objects for logging
   *
   * PostHog works better with flat attributes, so we convert:
   * { error: { code: "X", message: "Y" } }
   * to:
   * { "error.code": "X", "error.message": "Y" }
   */
  private flattenForLogging(
    obj: Record<string, unknown>,
    prefix = "",
  ): Record<string, string | number | boolean | null> {
    const result: Record<string, string | number | boolean | null> = {}

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key

      if (value === null) {
        result[fullKey] = null
      } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        result[fullKey] = value
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, this.flattenForLogging(value as Record<string, unknown>, fullKey))
      } else if (Array.isArray(value)) {
        // Convert arrays to JSON strings
        result[fullKey] = JSON.stringify(value)
      }
    }

    return result
  }
}

// ============================================================================
// Factory functions for creating typed contexts
// ============================================================================

/**
 * Create a RequestContext for /api/verification/verify
 */
export function createVerifyContext(): RequestContext<VerifyRequestEvent> {
  return new RequestContext<VerifyRequestEvent>()
}

/**
 * Create a RequestContext for /api/verification/status
 */
export function createStatusContext(): RequestContext<StatusRequestEvent> {
  return new RequestContext<StatusRequestEvent>()
}

/**
 * Create a RequestContext for getVerificationsWithStatus server action
 */
export function createGetVerificationsContext(): RequestContext<GetVerificationsEvent> {
  return new RequestContext<GetVerificationsEvent>()
}

/**
 * Create a RequestContext for checkIsVerified server action
 */
export function createCheckIsVerifiedContext(): RequestContext<CheckIsVerifiedEvent> {
  return new RequestContext<CheckIsVerifiedEvent>()
}

// Type alias for verify context (used in backend-key-pool.ts)
export type VerifyContext = RequestContext<VerifyRequestEvent>
