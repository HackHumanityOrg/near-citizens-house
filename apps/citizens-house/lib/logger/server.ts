import "server-only"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"
import type { LogEvent, LogLevel } from "../schemas/logger"

const severityMap: Record<LogLevel, SeverityNumber> = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

type LogAttributes = Record<string, string | number | boolean | null | unknown>

function log(level: LogLevel, message: string, attributes?: LogAttributes): void {
  // Console output (structured JSON, silent fail)
  try {
    const logData = {
      level,
      msg: message,
      ...attributes,
      ts: new Date().toISOString(),
    }
    if (level === "error") {
      console.error(JSON.stringify(logData))
    } else {
      console.log(JSON.stringify(logData))
    }
  } catch {
    // Silent fail - logging should never break the request
  }

  // PostHog via OpenTelemetry (silent fail)
  try {
    const otelLogger = logs.getLogger("citizens-house")

    // Filter out null values for OTEL attributes
    const otelAttributes: Record<string, string | number | boolean> = {}
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value !== null && value !== undefined) {
          // Convert unknown types to string for OTEL
          if (typeof value === "object") {
            otelAttributes[key] = JSON.stringify(value)
          } else {
            otelAttributes[key] = value as string | number | boolean
          }
        }
      }
    }

    otelLogger.emit({
      severityNumber: severityMap[level],
      severityText: level.toUpperCase(),
      body: message,
      attributes: otelAttributes,
    })
  } catch {
    // Silent fail - logging should never break the request
  }
}

/**
 * Type-safe logging function using discriminated union events.
 *
 * @example
 * ```ts
 * logEvent({
 *   event: "sumsub_token_generated",
 *   level: "info",
 *   externalUserId: "alice.near",
 *   applicantId: "123",
 * })
 * ```
 */
export function logEvent<T extends LogEvent>(eventData: T): void {
  const { event: eventName, level, ...attributes } = eventData
  log(level, eventName, attributes)
}
