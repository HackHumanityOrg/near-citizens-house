/**
 * OpenTelemetry Node.js Instrumentation
 *
 * Configures OpenTelemetry SDK to send logs to PostHog via OTLP HTTP.
 * This file is only imported in Node.js runtime (not Edge).
 *
 * @see https://posthog.com/docs/logs/installation/nodejs
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/open-telemetry
 */

import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { BatchLogRecordProcessor, LoggerProvider, ConsoleLogRecordExporter } from "@opentelemetry/sdk-logs"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions"
import { logs } from "@opentelemetry/api-logs"
import { logger, LogScope, Op } from "@/lib/logger"

// PostHog configuration
const POSTHOG_LOGS_ENDPOINT = "https://us.i.posthog.com/i/v1/logs"
const POSTHOG_PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_KEY

// Service metadata
const SERVICE_NAME = "citizens-house"
const SERVICE_VERSION = process.env.npm_package_version || "0.1.0"
const DEPLOYMENT_ENV = process.env.VERCEL_ENV || process.env.NODE_ENV || "development"

/**
 * Initialize OpenTelemetry logging
 */
export function initOtelLogging(): void {
  // Create resource with service metadata
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    "deployment.environment": DEPLOYMENT_ENV,
  })

  // Create log processors array
  const logProcessors: BatchLogRecordProcessor[] = []

  // Add PostHog exporter if we have a token
  if (POSTHOG_PROJECT_TOKEN) {
    const posthogExporter = new OTLPLogExporter({
      url: POSTHOG_LOGS_ENDPOINT,
      headers: {
        Authorization: `Bearer ${POSTHOG_PROJECT_TOKEN}`,
      },
    })

    logProcessors.push(
      new BatchLogRecordProcessor(posthogExporter, {
        // Batch settings optimized for serverless
        maxQueueSize: 100,
        maxExportBatchSize: 50,
        scheduledDelayMillis: 1000,
        exportTimeoutMillis: 30000,
      }),
    )
  }

  // Add console exporter in development for debugging
  if (DEPLOYMENT_ENV === "development") {
    logProcessors.push(new BatchLogRecordProcessor(new ConsoleLogRecordExporter()))
  }

  // If no processors, add a console one as fallback
  if (logProcessors.length === 0) {
    logProcessors.push(new BatchLogRecordProcessor(new ConsoleLogRecordExporter()))
  }

  // Create LoggerProvider with processors in config
  const loggerProvider = new LoggerProvider({
    resource,
    processors: logProcessors,
  })

  // Register the logger provider globally
  logs.setGlobalLoggerProvider(loggerProvider)

  // Initialize NodeSDK for any additional instrumentation
  const sdk = new NodeSDK({
    resource,
    // Note: We're manually setting up LoggerProvider above
    // NodeSDK will handle any automatic instrumentation
  })

  sdk.start()

  // Ensure proper shutdown on process exit
  const shutdown = async () => {
    await sdk.shutdown()
    await loggerProvider.shutdown()
  }

  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)

  // Log that OpenTelemetry is initialized
  if (DEPLOYMENT_ENV === "development") {
    logger.info("OpenTelemetry logging initialized", {
      scope: LogScope.INSTRUMENTATION,
      operation: Op.INSTRUMENTATION.INIT,
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      env: DEPLOYMENT_ENV,
      posthog_enabled: !!POSTHOG_PROJECT_TOKEN,
    })
  }
}
