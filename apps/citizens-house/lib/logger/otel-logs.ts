import "server-only"

import { logs } from "@opentelemetry/api-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"

const globalKey = "__citizensHouseOtelLogsInitialized"

type HeaderMap = Record<string, string>

function parseHeaders(value: string | undefined): HeaderMap | undefined {
  if (!value) return undefined

  const headers: HeaderMap = {}
  for (const entry of value.split(",")) {
    const trimmed = entry.trim()
    if (!trimmed) continue
    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const headerValue = trimmed.slice(separatorIndex + 1).trim()
    if (key && headerValue) {
      headers[key] = headerValue
    }
  }

  return Object.keys(headers).length ? headers : undefined
}

export function initializeOtelLogs(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const endpoint = process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  if (!endpoint) return

  const globalState = globalThis as typeof globalThis & { [globalKey]?: boolean }
  if (globalState[globalKey]) return
  globalState[globalKey] = true

  const headers = parseHeaders(process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS)

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "citizens-house",
      "deployment.environment": process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "unknown",
    }),
    processors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: endpoint, headers }))],
  })

  logs.setGlobalLoggerProvider(provider)
}
