/**
 * Server-Side Logger
 *
 * Pino logger with OpenTelemetry transport for PostHog logs integration.
 * Uses type-safe structured logging with Zod schema validation.
 *
 * @example
 * ```ts
 * import { logger } from "@/lib/logger"
 *
 * logger.info("verification", "completed", {
 *   accountId: "alice.near",
 *   attestationId: 1,
 *   durationMs: 1500,
 * }, "Verification successful")
 * ```
 */
import "server-only"
import pino from "pino"
import {
  logEventSchema,
  serializeError,
  type LogLevel,
  type LogDomain,
  type LogActionForDomain,
  type LogEventForAction,
} from "@/lib/schemas/log"
import { getRequestContext } from "./context"

const isDev = process.env.NODE_ENV === "development"

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

// Build transport configuration
function buildTransportConfig(): pino.TransportMultiOptions {
  const targets: pino.TransportTargetOptions[] = []

  // Always add pretty console output in development
  if (isDev) {
    targets.push({
      target: "pino-pretty",
      options: { colorize: true },
      level: "debug",
    })
  }

  // Add OTEL transport if endpoint is configured
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  if (otelEndpoint) {
    targets.push({
      target: "pino-opentelemetry-transport",
      options: {
        resourceAttributes: {
          "service.name": "citizens-house",
          "deployment.environment": process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "unknown",
        },
      },
      level: "debug",
    })
  }

  // Fallback to stdout if no transports configured
  if (targets.length === 0) {
    targets.push({
      target: "pino/file",
      options: { destination: 1 }, // stdout
      level: "debug",
    })
  }

  return { targets }
}

const transport = pino.transport(buildTransportConfig())

const pinoLogger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
  },
  transport,
)

/**
 * Type-safe + runtime validated structured logging.
 *
 * - Compile-time: TypeScript enforces exact fields for domain+action
 * - Runtime: Zod validates the log event (dev mode only for perf)
 * - No random fields allowed - schema is exhaustive
 */
function log<D extends LogDomain, A extends LogActionForDomain<D>>(
  level: LogLevel,
  domain: D,
  action: A,
  data: Omit<LogEventForAction<D, A>, BaseFieldsToOmit>,
  message: string,
): void {
  const ctx = getRequestContext()

  const event = {
    level,
    domain,
    action,
    message,
    timestamp: Date.now(),
    ...data,
    // Auto-populated context
    ...(ctx?.requestId && { requestId: ctx.requestId }),
    ...(ctx?.traceId && { traceId: ctx.traceId }),
    ...(ctx?.spanId && { spanId: ctx.spanId }),
    ...(ctx?.distinctId && { distinctId: ctx.distinctId }),
  }

  // Runtime validation in development (catches schema drift)
  if (isDev) {
    const result = logEventSchema.safeParse(event)
    if (!result.success) {
      pinoLogger.error({ validationError: result.error.format() }, "Invalid log event")
      throw new Error(`Invalid log event: ${result.error.message}`)
    }
  }

  // Use type assertion - our schema validation ensures correctness
  // Pino's generic types are too strict for our discriminated union approach
  ;(pinoLogger[level] as (obj: object, msg: string) => void)(event, message)
}

/**
 * Strongly-typed logger with level-specific methods.
 *
 * @example
 * ```ts
 * // Info level
 * logger.info("verification", "completed", {
 *   accountId: "alice.near",
 *   attestationId: 1,
 *   durationMs: 1500,
 * }, "Verification successful")
 *
 * // Error level with error serialization
 * logger.error("verification", "failed", {
 *   accountId: "alice.near",
 *   errorCode: "VERIFICATION_FAILED",
 *   error: serializeError(err),
 *   durationMs: 500,
 * }, "Verification failed")
 * ```
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
