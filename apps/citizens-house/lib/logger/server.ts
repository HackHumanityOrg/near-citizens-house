import "server-only"
import { logs, SeverityNumber } from "@opentelemetry/api-logs"

type LogLevel = "debug" | "info" | "warn" | "error"

const severityMap: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

function log(level: LogLevel, message: string, attributes?: Record<string, string | number | boolean>): void {
  const logger = logs.getLogger("citizens-house")

  logger.emit({
    severityNumber: severityMap[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes: attributes ?? {},
  })
}

export const logger = {
  debug: (message: string, attributes?: Record<string, string | number | boolean>) => log("debug", message, attributes),
  info: (message: string, attributes?: Record<string, string | number | boolean>) => log("info", message, attributes),
  warn: (message: string, attributes?: Record<string, string | number | boolean>) => log("warn", message, attributes),
  error: (message: string, attributes?: Record<string, string | number | boolean>) => log("error", message, attributes),
}
