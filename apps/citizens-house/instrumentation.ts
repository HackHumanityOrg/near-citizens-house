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
    const { extractPostHogDistinctIdFromCookies, getPostHogServer } = await import("./lib/analytics-server")
    const { AnalyticsProperties } = await import("./lib/analytics-schema")
    const posthog = getPostHogServer()

    if (!posthog) return

    // Try to extract distinct_id from PostHog cookie
    const distinctId = extractPostHogDistinctIdFromCookies(request.headers.cookie)

    // Capture the exception with context
    await posthog.captureException(err, distinctId, {
      // Request context
      [AnalyticsProperties.currentUrl]: request.path,
      [AnalyticsProperties.requestMethod]: request.method,
      // Next.js routing context
      [AnalyticsProperties.routerKind]: context.routerKind,
      [AnalyticsProperties.routePath]: context.routePath,
      [AnalyticsProperties.routeType]: context.routeType,
      [AnalyticsProperties.renderSource]: context.renderSource,
      [AnalyticsProperties.revalidateReason]: context.revalidateReason,
      [AnalyticsProperties.renderType]: context.renderType,
      // Error metadata
      [AnalyticsProperties.errorDigest]: err.digest,
      [AnalyticsProperties.trackingSource]: "server",
    })
  }
}
