/**
 * Next.js Instrumentation for Server-Side Logging and Error Tracking
 *
 * This file:
 * 1. Initializes OpenTelemetry logging to send structured logs to PostHog
 * 2. Captures server-side errors via the onRequestError hook
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see https://posthog.com/docs/logs
 * @see https://posthog.com/docs/error-tracking/installation/nextjs
 */

export async function register() {
  // Only initialize OpenTelemetry in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initOtelLogging } = await import("./instrumentation.node")
    initOtelLogging()
  }
}

export const onRequestError = async (
  err: Error & { digest?: string },
  request: {
    path: string
    method: string
    headers: { cookie?: string | string[] }
  },
  context: {
    routerKind: "Pages Router" | "App Router"
    routePath: string
    routeType: "render" | "route" | "action" | "middleware"
    renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering"
    revalidateReason?: "on-demand" | "stale" | undefined
    renderType?: "dynamic" | "dynamic-resume"
  },
) => {
  // Only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getPostHogServer } = await import("./lib/analytics-server")
    const posthog = getPostHogServer()

    if (!posthog) return

    // Try to extract distinct_id from PostHog cookie
    let distinctId: string | undefined

    if (request.headers.cookie) {
      // Normalize multiple cookie arrays to string
      const cookieString = Array.isArray(request.headers.cookie)
        ? request.headers.cookie.join("; ")
        : request.headers.cookie

      // Match PostHog cookie pattern: ph_phc_<project_key>_posthog
      const postHogCookieMatch = cookieString.match(/ph_phc_[^_]+_posthog=([^;]+)/)

      if (postHogCookieMatch?.[1]) {
        try {
          const decodedCookie = decodeURIComponent(postHogCookieMatch[1])
          const postHogData = JSON.parse(decodedCookie)
          distinctId = postHogData.distinct_id
        } catch {
          // Failed to parse PostHog cookie - continue without distinct_id
        }
      }
    }

    // Capture the exception with context
    await posthog.captureException(err, distinctId, {
      // Request context
      $current_url: request.path,
      request_method: request.method,
      // Next.js routing context
      router_kind: context.routerKind,
      route_path: context.routePath,
      route_type: context.routeType,
      render_source: context.renderSource,
      revalidate_reason: context.revalidateReason,
      render_type: context.renderType,
      // Error metadata
      error_digest: err.digest,
      tracking_source: "server",
    })
  }
}
