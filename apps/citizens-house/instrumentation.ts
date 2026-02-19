/**
 * Next.js Instrumentation
 *
 * This file is used for server-side initialization.
 * Environment validation is handled by T3 Env in next.config.ts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import * as Sentry from "@sentry/nextjs"
import { initializePostHogLogs } from "@/lib/logger/posthog-logs"

type RequestHeaders = {
  cookie?: string | string[]
  get?: (name: string) => string | null
}

type RequestWithHeaders = {
  headers: RequestHeaders
}

export async function register() {
  initializePostHogLogs()

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }

  // Register backend key pool on-chain (only on Node.js runtime, not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run async without blocking server startup
    import("@/lib/backend-key-registration")
      .then(({ ensureBackendKeysRegistered }) => ensureBackendKeysRegistered())
      .catch((err) =>
        Sentry.logger.error("instrumentation_backend_key_registration_load_failed", {
          error_message: err instanceof Error ? err.message : String(err),
        }),
      )
  }
}

/**
 * Server-side error handler for Next.js
 *
 * Captures unhandled errors from API routes, Server Components, and middleware.
 * Extracts distinctId from PostHog cookie for user association.
 *
 * @see https://posthog.com/docs/error-tracking/installation/nextjs
 */
export const onRequestError = async (...args: Parameters<typeof Sentry.captureRequestError>) => {
  Sentry.captureRequestError(...args)
  const [rawError, rawRequest] = args
  const err = rawError instanceof Error ? rawError : new Error(String(rawError))
  const request = rawRequest as RequestWithHeaders

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid loading server-only module in edge runtime
    const { captureServerError } = await import("@/lib/analytics-server")

    let distinctId: string | null = null
    let sessionId: string | null = null

    // Extract cookie string from headers (handle both formats)
    let cookieString: string | null = null
    if (typeof request?.headers?.get === "function") {
      cookieString = request.headers.get("cookie")
    } else if (typeof request?.headers?.cookie === "string") {
      cookieString = request.headers.cookie
    } else if (Array.isArray(request?.headers?.cookie)) {
      cookieString = (request.headers.cookie as string[]).join("; ")
    }

    if (cookieString) {
      // Extract distinctId from PostHog cookie
      const postHogCookieMatch = cookieString.match(/ph_phc_.*?_posthog=([^;]+)/)
      if (postHogCookieMatch?.[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1])
          const postHogData = JSON.parse(decodedCookie)
          distinctId = postHogData.distinct_id
          sessionId = postHogData.$sesid?.[1] // Session ID is stored in $sesid array
        } catch {
          // Silently ignore parsing errors
        }
      }
    }

    // Also check for session ID header (set by client middleware)
    if (!sessionId && typeof request?.headers?.get === "function") {
      sessionId = request.headers.get("X-POSTHOG-SESSION-ID")
    }
    if (!distinctId && typeof request?.headers?.get === "function") {
      distinctId = request.headers.get("X-POSTHOG-DISTINCT-ID")
    }

    await captureServerError(err, distinctId || undefined, {
      stage: "server_handler",
      sessionId: sessionId || undefined,
    })
  }
}
