/**
 * Wide Event Logger for PostHog via OpenTelemetry
 *
 * Implements the "wide event" pattern from https://loggingsucks.com
 * - One comprehensive log per request with all context
 * - High cardinality, high dimensionality data
 * - Structured JSON logs sent to PostHog via OTLP
 * - Tail sampling: always keep errors and slow requests
 *
 * @see https://posthog.com/docs/logs
 */

import { logs, SeverityNumber } from "@opentelemetry/api-logs"

// Service metadata
const SERVICE_NAME = "citizens-house"
const SERVICE_VERSION = process.env.npm_package_version || "0.1.0"
const DEPLOYMENT_ENV = process.env.VERCEL_ENV || process.env.NODE_ENV || "development"
const REGION = process.env.VERCEL_REGION || "local"

// Log levels mapped to OpenTelemetry severity
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal"

const SEVERITY_MAP: Record<LogLevel, { text: string; number: SeverityNumber }> = {
  trace: { text: "TRACE", number: SeverityNumber.TRACE },
  debug: { text: "DEBUG", number: SeverityNumber.DEBUG },
  info: { text: "INFO", number: SeverityNumber.INFO },
  warn: { text: "WARN", number: SeverityNumber.WARN },
  error: { text: "ERROR", number: SeverityNumber.ERROR },
  fatal: { text: "FATAL", number: SeverityNumber.FATAL },
}

// Sampling configuration for tail sampling
const SAMPLE_RATE_SUCCESS = 0.1 // Keep 10% of successful requests
const SLOW_REQUEST_THRESHOLD_MS = 2000 // Always keep requests slower than 2s

// =============================================================================
// Operation Constants
// =============================================================================
// Use these constants for consistent operation naming across the codebase.
// Format: MODULE.OPERATION where MODULE is the domain and OPERATION is the action.
//
// Usage:
//   import { Op } from "@/lib/logger"
//   logger.info("Message", { operation: Op.VERIFICATION.VERIFY_ACCOUNT, ... })
// =============================================================================

/** Redis connection and operations */
export const OpRedis = {
  /** Redis client connection lifecycle */
  CONNECT: "redis.connect",
} as const

/** Verification API operations */
export const OpVerification = {
  /** Full-access key validation */
  ACCESS_KEY_CHECK: "verification.access_key_check",
  /** Signature nonce validation */
  NONCE_CHECK: "verification.nonce_check",
  /** Session state updates */
  SESSION_UPDATE: "verification.session_update",
  /** Analytics event tracking */
  ANALYTICS: "verification.analytics",
  /** ZK proof re-verification */
  ZK_VERIFY: "verification.zk_verify",
  /** Full account verification */
  VERIFY_ACCOUNT: "verification.verify_account",
} as const

/** Namespace for all operation constants */
export const Op = {
  REDIS: OpRedis,
  VERIFICATION: OpVerification,
} as const

/**
 * Base attributes included in every log
 */
interface BaseAttributes {
  // Service context
  "service.name": string
  "service.version": string
  "deployment.environment": string
  "deployment.region": string

  // Timestamp
  timestamp: string
  timestamp_ms: number
}

/**
 * Request context for API routes
 */
export interface RequestContext {
  request_id?: string
  method?: string
  path?: string
  route?: string
  status_code?: number
  duration_ms?: number
  ip?: string
  user_agent?: string
}

/**
 * User context
 */
export interface UserContext {
  account_id?: string
  session_id?: string
  distinct_id?: string
}

/**
 * Verification context for the verification flow
 */
export interface VerificationContext {
  attestation_id?: string
  nullifier?: string
  nationality?: string
  self_network?: string
  ofac_enabled?: boolean
  is_valid?: boolean
  is_ofac_valid?: boolean
  stage?: string
}

/**
 * Error context
 */
export interface ErrorContext {
  error_type?: string
  error_code?: string
  error_message?: string
  error_stack?: string
  error_retriable?: boolean
}

/**
 * Wide event attributes - all context combined
 */
export interface WideEventAttributes extends Partial<RequestContext>, Partial<UserContext>, Partial<ErrorContext> {
  // Operation name (like a span name)
  operation?: string

  // Custom attributes
  [key: string]: unknown
}

/**
 * Check if we should sample this log (tail sampling)
 */
function shouldSample(level: LogLevel, attributes: WideEventAttributes): boolean {
  // Always keep errors and warnings
  if (level === "error" || level === "fatal" || level === "warn") {
    return true
  }

  // Always keep slow requests
  if (attributes.duration_ms && attributes.duration_ms > SLOW_REQUEST_THRESHOLD_MS) {
    return true
  }

  // Always keep verification events
  if (attributes.operation?.startsWith("verification")) {
    return true
  }

  // Always keep requests with errors
  if (attributes.error_code || attributes.error_type) {
    return true
  }

  // Always keep non-2xx status codes
  if (attributes.status_code && (attributes.status_code < 200 || attributes.status_code >= 300)) {
    return true
  }

  // Random sample the rest
  return Math.random() < SAMPLE_RATE_SUCCESS
}

/**
 * Build base attributes for every log
 */
function buildBaseAttributes(): BaseAttributes {
  const now = Date.now()
  return {
    "service.name": SERVICE_NAME,
    "service.version": SERVICE_VERSION,
    "deployment.environment": DEPLOYMENT_ENV,
    "deployment.region": REGION,
    timestamp: new Date(now).toISOString(),
    timestamp_ms: now,
  }
}

/**
 * Flatten nested objects for OpenTelemetry attributes
 * OpenTelemetry attributes must be primitive values
 */
function flattenAttributes(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string | number | boolean | string[] | number[] | boolean[]> {
  const result: Record<string, string | number | boolean | string[] | number[] | boolean[]> = {}

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key

    if (value === null || value === undefined) {
      continue
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      result[newKey] = value
    } else if (Array.isArray(value)) {
      // OpenTelemetry supports arrays of primitives
      if (value.every((v) => typeof v === "string")) {
        result[newKey] = value as string[]
      } else if (value.every((v) => typeof v === "number")) {
        result[newKey] = value as number[]
      } else if (value.every((v) => typeof v === "boolean")) {
        result[newKey] = value as boolean[]
      } else {
        // Convert mixed arrays to JSON string
        result[newKey] = JSON.stringify(value)
      }
    } else if (typeof value === "object") {
      // Recursively flatten nested objects
      Object.assign(result, flattenAttributes(value as Record<string, unknown>, newKey))
    } else {
      // Convert other types to string
      result[newKey] = String(value)
    }
  }

  return result
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, attributes: WideEventAttributes = {}): void {
  // Apply tail sampling
  if (!shouldSample(level, attributes)) {
    return
  }

  const severity = SEVERITY_MAP[level]
  const baseAttrs = buildBaseAttributes()

  // Combine all attributes
  const allAttributes = {
    ...baseAttrs,
    ...attributes,
  }

  // Flatten for OpenTelemetry
  const flatAttrs = flattenAttributes(allAttributes)

  // Get the OpenTelemetry logger
  const otelLogger = logs.getLogger(SERVICE_NAME)

  // Emit the log record
  otelLogger.emit({
    severityNumber: severity.number,
    severityText: severity.text,
    body: message,
    attributes: flatAttrs,
  })

  // Also log to console in development for debugging
  if (DEPLOYMENT_ENV === "development") {
    const consoleMethod = level === "error" || level === "fatal" ? "error" : level === "warn" ? "warn" : "log"

    console[consoleMethod](`[${severity.text}] ${message}`, flatAttrs)
  }
}

/**
 * Logger instance with convenience methods
 */
export const logger = {
  trace: (message: string, attributes?: WideEventAttributes) => log("trace", message, attributes),
  debug: (message: string, attributes?: WideEventAttributes) => log("debug", message, attributes),
  info: (message: string, attributes?: WideEventAttributes) => log("info", message, attributes),
  warn: (message: string, attributes?: WideEventAttributes) => log("warn", message, attributes),
  error: (message: string, attributes?: WideEventAttributes) => log("error", message, attributes),
  fatal: (message: string, attributes?: WideEventAttributes) => log("fatal", message, attributes),

  /**
   * Log an error with full context extraction
   */
  exception: (error: Error, attributes?: WideEventAttributes) => {
    log("error", error.message, {
      ...attributes,
      error_type: error.name,
      error_message: error.message,
      error_stack: error.stack,
    })
  },
}

/**
 * Wide event builder for accumulating context throughout a request
 *
 * Usage:
 * ```ts
 * const event = createWideEvent("api.verification.verify")
 * event.setRequest({ method: "POST", path: "/api/verify" })
 * event.setUser({ account_id: "alice.near" })
 * // ... do work ...
 * event.emit("info", "Verification completed")
 * ```
 */
export class WideEvent {
  private operation: string
  private attributes: WideEventAttributes = {}
  private startTime: number

  constructor(operation: string) {
    this.operation = operation
    this.startTime = Date.now()
    this.attributes.operation = operation
  }

  /**
   * Set request context
   */
  setRequest(ctx: RequestContext): this {
    Object.assign(this.attributes, ctx)
    return this
  }

  /**
   * Set user context
   */
  setUser(ctx: UserContext): this {
    Object.assign(this.attributes, ctx)
    return this
  }

  /**
   * Set verification context
   */
  setVerification(ctx: VerificationContext): this {
    // Prefix verification attributes
    for (const [key, value] of Object.entries(ctx)) {
      if (value !== undefined) {
        this.attributes[`verification.${key}`] = value
      }
    }
    return this
  }

  /**
   * Set error context
   */
  setError(error: Error | { code?: string; message?: string; retriable?: boolean }): this {
    if (error instanceof Error) {
      this.attributes.error_type = error.name
      this.attributes.error_message = error.message
      this.attributes.error_stack = error.stack
    } else {
      if (error.code) this.attributes.error_code = error.code
      if (error.message) this.attributes.error_message = error.message
      if (error.retriable !== undefined) this.attributes.error_retriable = error.retriable
    }
    return this
  }

  /**
   * Set custom attribute
   */
  set(key: string, value: unknown): this {
    this.attributes[key] = value
    return this
  }

  /**
   * Set multiple attributes at once
   */
  setAll(attrs: Record<string, unknown>): this {
    Object.assign(this.attributes, attrs)
    return this
  }

  /**
   * Set the final status code
   */
  setStatus(code: number): this {
    this.attributes.status_code = code
    return this
  }

  /**
   * Calculate and set duration
   */
  private finalizeDuration(): void {
    if (!this.attributes.duration_ms) {
      this.attributes.duration_ms = Date.now() - this.startTime
    }
  }

  /**
   * Emit the wide event log
   */
  emit(level: LogLevel, message: string): void {
    this.finalizeDuration()
    log(level, message, this.attributes)
  }

  /**
   * Emit as info level
   */
  info(message: string): void {
    this.emit("info", message)
  }

  /**
   * Emit as error level
   */
  error(message: string): void {
    this.emit("error", message)
  }

  /**
   * Emit as warning level
   */
  warn(message: string): void {
    this.emit("warn", message)
  }

  /**
   * Get current attributes (for inspection)
   */
  getAttributes(): WideEventAttributes {
    return { ...this.attributes }
  }
}

/**
 * Create a new wide event builder
 */
export function createWideEvent(operation: string): WideEvent {
  return new WideEvent(operation)
}

/**
 * Server action logger - creates a wide event for server actions
 */
export function createServerActionEvent(actionName: string): WideEvent {
  return createWideEvent(`server_action.${actionName}`)
}

/**
 * API route logger - creates a wide event for API routes
 */
export function createApiRouteEvent(routeName: string): WideEvent {
  return createWideEvent(`api.${routeName}`)
}

/**
 * Extract request context from NextRequest
 * Use this in API routes to populate wide event with request details
 */
export function extractRequestContext(request: Request, route?: string): RequestContext {
  const url = new URL(request.url)

  // Generate a request ID if not present
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-vercel-id") ||
    `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`

  return {
    request_id: requestId,
    method: request.method,
    path: url.pathname,
    route: route || url.pathname,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined,
    user_agent: request.headers.get("user-agent") || undefined,
  }
}

/**
 * Create a wide event for an API route with request context already populated
 */
export function createApiEvent(routeName: string, request: Request): WideEvent {
  const event = createApiRouteEvent(routeName)
  event.setRequest(extractRequestContext(request, `/api/${routeName.replace(/\./g, "/")}`))
  return event
}
