import "server-only"
import type { LogEvent, LogLevel } from "../schemas/logger"

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
