/**
 * Wide Event Logging Wrapper for API Routes
 *
 * Implements the wide events pattern: one rich log per API request
 * with all decision-point attributes collected via `log.set()`.
 */
import * as Sentry from "@sentry/nextjs"
import { type NextRequest } from "next/server"

export type RequestLog = {
  set(key: string, value: string | number | boolean): void
  setAll(attrs: Record<string, string | number | boolean | undefined | null>): void
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
  if (!activeSpan) {
    return {}
  }

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

/**
 * Wrap an API route handler with wide event logging.
 *
 * The handler receives a mutable `RequestLog` to populate at decision points.
 * On completion, ONE structured log is emitted with all collected attributes.
 */
export function withLogging(
  options: { route: string },
  handler: (request: NextRequest, log: RequestLog) => Promise<Response>,
): (request: NextRequest) => Promise<Response> {
  return async (request: NextRequest) => {
    const start = Date.now()
    const requestId = getRequestId(request)
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()

    const attrs: Record<string, string | number | boolean> = {
      route: options.route,
      request_id: requestId,
      method: request.method,
      url_path: request.nextUrl.pathname,
      host: request.nextUrl.host,
      runtime: process.env.NEXT_RUNTIME ?? "nodejs",
      node_env: process.env.NODE_ENV ?? "unknown",
      deploy_env: process.env.VERCEL_ENV ?? "unknown",
      ...(process.env.SENTRY_RELEASE ? { release: process.env.SENTRY_RELEASE } : {}),
      ...(request.nextUrl.search ? { url_query: request.nextUrl.search } : {}),
      ...(request.headers.get("user-agent") ? { user_agent: request.headers.get("user-agent") as string } : {}),
      ...(request.headers.get("referer") ? { referer: request.headers.get("referer") as string } : {}),
      ...(clientIp ? { client_ip: clientIp } : {}),
      ...getTraceAttributes(),
    }

    const log: RequestLog = {
      set(key, value) {
        attrs[key] = value
      },
      setAll(entries) {
        for (const [key, value] of Object.entries(entries)) {
          if (value != null) {
            attrs[key] = value
          }
        }
      },
    }

    let response: Response
    try {
      response = await handler(request, log)
      attrs.http_status = response.status
      attrs.http_status_class = getStatusClass(response.status)
      const responseContentLength = response.headers.get("content-length")
      if (responseContentLength) {
        const parsed = Number.parseInt(responseContentLength, 10)
        if (Number.isFinite(parsed)) {
          attrs.response_size_bytes = parsed
        }
      }
      attrs.duration_ms = Date.now() - start
      attrs.outcome = response.status >= 400 ? "error" : "success"
    } catch (error) {
      attrs.duration_ms = Date.now() - start
      attrs.outcome = "error"
      if (error instanceof Error) {
        attrs.error_message = error.message
        attrs.error_type = error.name
      }

      Sentry.logger.error("api.request", attrs)
      throw error
    }

    if (attrs.outcome === "error") {
      Sentry.logger.error("api.request", attrs)
    } else {
      Sentry.logger.info("api.request", attrs)
    }

    return response
  }
}
