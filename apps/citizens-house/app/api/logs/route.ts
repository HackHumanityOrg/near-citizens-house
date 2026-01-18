/**
 * Frontend Log Receiver API Route
 *
 * Receives logs from browser clients via sendBeacon and forwards them to OTEL.
 * This bridges client-side logging to the server-side OTEL pipeline.
 */
import { type NextRequest, NextResponse } from "next/server"
import { logs, SeverityNumber, type AnyValue } from "@opentelemetry/api-logs"
import { z } from "zod"

// Schema for incoming browser log events
const browserLogPayloadSchema = z.object({
  level: z.string(),
  messages: z.array(z.unknown()),
  bindings: z.array(z.record(z.string(), z.unknown())).optional(),
  ts: z.number(),
  distinctId: z.string().optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
})

// Map Pino levels to OTEL severity
function levelToSeverity(level: string): SeverityNumber {
  switch (level) {
    case "debug":
    case "trace":
      return SeverityNumber.DEBUG
    case "info":
      return SeverityNumber.INFO
    case "warn":
      return SeverityNumber.WARN
    case "error":
    case "fatal":
      return SeverityNumber.ERROR
    default:
      return SeverityNumber.UNSPECIFIED
  }
}

// Convert unknown value to OTEL AnyValue (primitives only - no nested objects)
function toAnyValue(value: unknown): AnyValue | undefined {
  if (value === null || value === undefined) return undefined
  if (typeof value === "string") return value
  if (typeof value === "number") return value
  if (typeof value === "boolean") return value
  // For complex types, stringify
  return JSON.stringify(value)
}

// Flatten bindings array into a single object of OTEL-compatible attributes
function flattenBindings(bindings: Array<Record<string, unknown>> | undefined): Record<string, AnyValue> {
  if (!bindings || bindings.length === 0) return {}

  const result: Record<string, AnyValue> = {}
  for (const binding of bindings) {
    for (const [key, value] of Object.entries(binding)) {
      const anyValue = toAnyValue(value)
      if (anyValue !== undefined) {
        result[key] = anyValue
      }
    }
  }
  return result
}

// Convert an object to OTEL-compatible attributes
function toOtelAttributes(obj: Record<string, unknown>): Record<string, AnyValue> {
  const result: Record<string, AnyValue> = {}
  for (const [key, value] of Object.entries(obj)) {
    const anyValue = toAnyValue(value)
    if (anyValue !== undefined) {
      result[key] = anyValue
    }
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const parsed = browserLogPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid log payload" }, { status: 400 })
    }

    const { level, messages, bindings, ts, distinctId, url, userAgent } = parsed.data

    // Get OTEL logger
    const otelLogger = logs.getLogger("citizens-house-browser")

    // Extract the first message (typically the log object from Pino)
    const firstMessage = messages[0]
    const logBody = typeof firstMessage === "object" && firstMessage !== null ? firstMessage : undefined
    const fallbackBinding = bindings?.[bindings.length - 1]
    const logBodyMessage = logBody && "message" in logBody ? (logBody as { message?: unknown }).message : undefined
    const fallbackMessage =
      fallbackBinding && "message" in fallbackBinding ? (fallbackBinding as { message?: unknown }).message : undefined
    const bodyCandidate =
      logBodyMessage ??
      (typeof firstMessage === "string" || typeof firstMessage === "number" || typeof firstMessage === "boolean"
        ? firstMessage
        : undefined) ??
      fallbackMessage
    const body = bodyCandidate !== undefined && bodyCandidate !== null ? String(bodyCandidate) : undefined

    // Build attributes from bindings and metadata
    const attributes: Record<string, AnyValue> = {
      "log.source": "browser",
      ...flattenBindings(bindings),
      ...(distinctId && { "user.distinctId": distinctId }),
      ...(url && { "browser.url": url }),
      ...(userAgent && { "browser.userAgent": userAgent }),
      // Include all properties from the log object as attributes
      ...(logBody ? toOtelAttributes(logBody as Record<string, unknown>) : {}),
    }

    // Emit to OTEL
    otelLogger.emit({
      severityNumber: levelToSeverity(level),
      severityText: level.toUpperCase(),
      ...(body !== undefined && { body }),
      timestamp: ts,
      attributes,
    })

    return NextResponse.json({ ok: true })
  } catch {
    // Silently accept failures - we don't want logging failures to affect the client
    return NextResponse.json({ ok: true })
  }
}
