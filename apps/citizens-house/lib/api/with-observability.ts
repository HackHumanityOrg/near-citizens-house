import * as Sentry from "@sentry/nextjs"
import { type NextRequest } from "next/server"

type LogValue = string | number | boolean
type OptionalLogValue = LogValue | null | undefined
type LogAttributes = Record<string, LogValue>

const LOG_EVENT_NAME = "api.request"
const KEY_PATTERN = /^[a-z0-9_]+$/
const MAX_STRING_LENGTH = 1024

export type RequestLog = {
  set(key: string, value: LogValue): void
  setAll(attrs: Record<string, OptionalLogValue>): void
}

function normalizeKey(key: string): string | null {
  const normalized = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
  if (!normalized || !KEY_PATTERN.test(normalized)) return null
  return normalized
}

function normalizeValue(value: LogValue): LogValue {
  if (typeof value !== "string") return value
  if (value.length <= MAX_STRING_LENGTH) return value
  return `${value.slice(0, MAX_STRING_LENGTH)}...`
}

function setAttr(attrs: LogAttributes, key: string, value: LogValue): void {
  const normalizedKey = normalizeKey(key)
  if (!normalizedKey) return
  attrs[normalizedKey] = normalizeValue(value)
}

function getRequestId(request: NextRequest): string {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  )
}

function getStatusClass(status: number): string {
  return `${Math.floor(status / 100)}xx`
}

function getTraceAttributes(): Record<string, string> {
  const activeSpan = Sentry.getActiveSpan()
  if (!activeSpan) return {}

  const activeSpanData = Sentry.spanToJSON(activeSpan)
  const rootSpan = Sentry.getRootSpan(activeSpan)
  const rootSpanData = rootSpan ? Sentry.spanToJSON(rootSpan) : undefined

  const traceId = activeSpanData.trace_id ?? rootSpanData?.trace_id
  const spanId = activeSpanData.span_id

  return {
    ...(traceId ? { trace_id: traceId } : {}),
    ...(spanId ? { span_id: spanId } : {}),
  }
}

function emitWideEvent(level: "info" | "error", attrs: LogAttributes): void {
  if (level === "error") {
    Sentry.logger.error(LOG_EVENT_NAME, attrs)
    return
  }
  Sentry.logger.info(LOG_EVENT_NAME, attrs)
}

export function withObservability(
  options: { route: string; operation?: string },
  handler: (request: NextRequest, log: RequestLog) => Promise<Response>,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const start = Date.now()
    const requestId = getRequestId(request)

    const attrs: LogAttributes = {
      route: options.route,
      request_id: requestId,
      method: request.method,
      url_path: request.nextUrl.pathname,
      host: request.nextUrl.host,
      runtime: process.env.NEXT_RUNTIME ?? "nodejs",
      node_env: process.env.NODE_ENV ?? "unknown",
      deploy_env: process.env.VERCEL_ENV ?? "unknown",
      ...getTraceAttributes(),
    }

    if (process.env.SENTRY_RELEASE) {
      attrs.release = process.env.SENTRY_RELEASE
    }
    if (process.env.VERCEL_REGION) {
      attrs.region = process.env.VERCEL_REGION
    }
    if (process.env.VERCEL_GIT_COMMIT_SHA) {
      attrs.commit_sha = process.env.VERCEL_GIT_COMMIT_SHA
    }

    const query = request.nextUrl.search
    if (query) {
      attrs.url_query = normalizeValue(query)
    }

    const userAgent = request.headers.get("user-agent")
    if (userAgent) {
      attrs.user_agent = normalizeValue(userAgent)
    }

    const referer = request.headers.get("referer")
    if (referer) {
      attrs.referer = normalizeValue(referer)
    }

    const log: RequestLog = {
      set(key, value) {
        setAttr(attrs, key, value)
      },
      setAll(entries) {
        for (const [key, value] of Object.entries(entries)) {
          if (value == null) continue
          setAttr(attrs, key, value)
        }
      },
    }

    return Sentry.startSpan(
      {
        name: options.operation ?? options.route,
        op: "http.server",
        attributes: {
          route: options.route,
          method: request.method,
          request_id: requestId,
        },
      },
      async () => {
        let response: Response

        try {
          response = await handler(request, log)
        } catch (error) {
          attrs.duration_ms = Date.now() - start
          attrs.outcome = "error"
          attrs.http_status = 500
          attrs.http_status_class = "5xx"
          if (error instanceof Error) {
            attrs.error_type = error.name
            attrs.error_message = normalizeValue(error.message)
          }

          Sentry.captureException(error, {
            tags: { route: options.route },
            extra: { request_id: requestId },
          })
          emitWideEvent("error", attrs)
          throw error
        }

        attrs.http_status = response.status
        attrs.http_status_class = getStatusClass(response.status)
        attrs.duration_ms = Date.now() - start
        attrs.outcome = response.status >= 400 ? "error" : "success"

        const responseContentLength = response.headers.get("content-length")
        if (responseContentLength) {
          const parsed = Number.parseInt(responseContentLength, 10)
          if (Number.isFinite(parsed)) {
            attrs.response_size_bytes = parsed
          }
        }

        emitWideEvent(attrs.outcome === "error" ? "error" : "info", attrs)
        return response
      },
    )
  }
}
