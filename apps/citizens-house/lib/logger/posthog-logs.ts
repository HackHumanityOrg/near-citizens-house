import "server-only"
import { logs } from "@opentelemetry/api-logs"
import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { env } from "@/lib/schemas/env"

const POSTHOG_LOGS_ENDPOINT = "https://us.i.posthog.com/i/v1/logs"

export function initializePostHogLogs(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (!env.NEXT_PUBLIC_POSTHOG_KEY) return

  // Prevent double initialization
  const globalKey = "__posthogLogsInitialized"
  const globalState = globalThis as typeof globalThis & { [globalKey]?: boolean }
  if (globalState[globalKey]) return
  globalState[globalKey] = true

  const exporter = new OTLPLogExporter({
    url: POSTHOG_LOGS_ENDPOINT,
    headers: {
      Authorization: `Bearer ${env.NEXT_PUBLIC_POSTHOG_KEY}`,
    },
  })

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      "service.name": "citizens-house",
    }),
    processors: [new BatchLogRecordProcessor(exporter)],
  })

  logs.setGlobalLoggerProvider(provider)

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    await provider.shutdown()
  })
}
