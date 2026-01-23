/**
 * RequestContext - Builder pattern for wide event logging
 *
 * A single RequestContext accumulates structured data throughout a request lifecycle,
 * then emits one comprehensive log event with all context, timings, and PostHog correlation.
 *
 * Usage:
 * ```typescript
 * const ctx = createVerifyContext()
 * ctx.set("route", "/api/verification/verify")
 * ctx.set("method", "POST")
 * ctx.setNested("error.code", "VALIDATION_ERROR")
 * ctx.startTimer("sumsubVerify")
 * // ... perform verification
 * ctx.endTimer("sumsubVerify")
 * ctx.set("outcome", "success")
 * ctx.emit("info")
 * ```
 *
 * Type Safety:
 * - Each factory function returns a context typed for its event
 * - Top-level fields have full type safety via keyof E
 * - Nested paths use setNested() for dot-notation access
 * - Timer names are compile-time validated
 */

import { logger } from "./server"
import { setNestedProperty, getNestedProperty } from "./helpers"
import type {
  LogLevel,
  WideEvent,
  SumSubWebhookEvent,
  GetVerificationsEvent,
  CheckIsVerifiedEvent,
  EventTimers,
} from "./types"

/**
 * Strongly-typed RequestContext for wide event logging.
 *
 * Generic over the event type E to provide compile-time safety for:
 * - Top-level field names and values (set)
 * - Nested paths (setNested)
 * - Timer names (startTimer/endTimer)
 */
export class RequestContext<E extends WideEvent> {
  private data: Partial<E> = {}
  private timers: Map<string, number> = new Map()
  private readonly startTime: number
  readonly requestId: string

  constructor() {
    this.startTime = performance.now()
    this.requestId = crypto.randomUUID()
    ;(this.data as Record<string, unknown>).requestId = this.requestId
  }

  /**
   * Set a top-level field on the event
   *
   * Type-safe: only valid top-level keys and value types are accepted.
   *
   * @example
   * ctx.set("outcome", "success")
   * ctx.set("statusCode", 200)
   */
  set<K extends keyof E>(key: K, value: E[K]): this {
    this.data[key] = value
    return this
  }

  /**
   * Set a nested field using dot notation
   *
   * Use this for nested paths like "error.code", "stageReached.parsed", etc.
   *
   * @example
   * ctx.setNested("error.code", "VALIDATION_ERROR")
   * ctx.setNested("stageReached.parsed", true)
   */
  setNested(path: string, value: unknown): this {
    setNestedProperty(this.data as Record<string, unknown>, path, value)
    return this
  }

  /**
   * Set multiple top-level fields at once
   *
   * @example
   * ctx.setMany({ route: "/api/verify", method: "POST", distinctId })
   */
  setMany(values: Partial<E>): this {
    for (const [key, value] of Object.entries(values)) {
      ;(this.data as Record<string, unknown>)[key] = value
    }
    return this
  }

  /**
   * Get a top-level field value
   */
  get<K extends keyof E>(key: K): E[K] | undefined {
    return this.data[key]
  }

  /**
   * Get a nested field value using dot notation
   */
  getNested(path: string): unknown {
    return getNestedProperty(this.data as Record<string, unknown>, path)
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
      setNestedProperty(this.data as Record<string, unknown>, `timings.${name as string}`, duration)
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
      setNestedProperty(this.data as Record<string, unknown>, "timings.total", totalMs)

      // Add timestamp
      ;(this.data as Record<string, unknown>).timestamp = Date.now()

      // Build the log attributes, flattening nested objects for PostHog
      const attributes = this.flattenForLogging(this.data as Record<string, unknown>)

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
 * Create a RequestContext for /api/verification/sumsub/webhook
 */
export function createSumSubWebhookContext(): RequestContext<SumSubWebhookEvent> {
  return new RequestContext<SumSubWebhookEvent>()
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

// Type alias for webhook context (used in backend-key-pool.ts)
export type SumSubWebhookContext = RequestContext<SumSubWebhookEvent>
