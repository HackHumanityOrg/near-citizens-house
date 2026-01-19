/**
 * Next.js Instrumentation
 *
 * This file is used for server-side initialization.
 * Environment validation is handled by T3 Env in next.config.ts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializePostHogLogs } from "@/lib/logger/posthog-logs"

export async function register() {
  initializePostHogLogs()

  // Register backend key pool on-chain (only on Node.js runtime, not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run async without blocking server startup
    import("@/lib/backend-key-registration")
      .then(({ ensureBackendKeysRegistered }) => ensureBackendKeysRegistered())
      .catch((err) => console.error("[Instrumentation] Failed to load backend-key-registration:", err))
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
export const onRequestError = async (
  err: Error,
  request: { headers: { cookie?: string; get?: (name: string) => string | null } },
  _context: { routerKind: string; routePath: string; routeType: string; revalidateReason?: string },
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic import to avoid loading server-only module in edge runtime
    const { captureServerError } = await import("@/lib/analytics-server")

    let distinctId: string | null = null
    let sessionId: string | null = null

    // Extract cookie string from headers (handle both formats)
    let cookieString: string | null = null
    if (typeof request.headers.get === "function") {
      cookieString = request.headers.get("cookie")
    } else if (typeof request.headers.cookie === "string") {
      cookieString = request.headers.cookie
    } else if (Array.isArray(request.headers.cookie)) {
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
    if (!sessionId && typeof request.headers.get === "function") {
      sessionId = request.headers.get("X-POSTHOG-SESSION-ID")
    }
    if (!distinctId && typeof request.headers.get === "function") {
      distinctId = request.headers.get("X-POSTHOG-DISTINCT-ID")
    }

    await captureServerError(err, distinctId || undefined, {
      stage: "server_handler",
      sessionId: sessionId || undefined,
    })
  }
}
