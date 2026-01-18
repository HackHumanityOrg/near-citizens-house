import "server-only"

import { logs } from "@opentelemetry/api-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"
import { env } from "@/lib/schemas/env"

const globalKey = "__citizensHouseOtelLogsInitialized"
const posthogLogsEndpoint = "https://us.i.posthog.com/i/v1/logs"

export function initializeOtelLogs(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return

  const globalState = globalThis as typeof globalThis & { [globalKey]?: boolean }
  if (globalState[globalKey]) return
  globalState[globalKey] = true

  const headers = { Authorization: `Bearer ${env.NEXT_PUBLIC_POSTHOG_KEY}` }

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "citizens-house",
      "deployment.environment": env.NEXT_PUBLIC_NEAR_NETWORK ?? "unknown",
    }),
    processors: [new BatchLogRecordProcessor(new OTLPLogExporter({ url: posthogLogsEndpoint, headers }))],
  })

  logs.setGlobalLoggerProvider(provider)
}
