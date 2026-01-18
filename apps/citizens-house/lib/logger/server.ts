import "server-only"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"

type LogLevel = "debug" | "info" | "warn" | "error"

const severityMap: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

function log(level: LogLevel, message: string, attributes?: Record<string, string | number | boolean | null>): void {
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
        if (value !== null) {
          otelAttributes[key] = value
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

export const logger = {
  debug: (message: string, attributes?: Record<string, string | number | boolean | null>) =>
    log("debug", message, attributes),
  info: (message: string, attributes?: Record<string, string | number | boolean | null>) =>
    log("info", message, attributes),
  warn: (message: string, attributes?: Record<string, string | number | boolean | null>) =>
    log("warn", message, attributes),
  error: (message: string, attributes?: Record<string, string | number | boolean | null>) =>
    log("error", message, attributes),
}
