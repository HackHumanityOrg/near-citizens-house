import "server-only"
import { type NextRequest } from "next/server"

/**
 * PostHog context extracted from request headers.
 * These headers are automatically added by posthog-js when __add_tracing_headers is enabled.
 */
export interface PostHogRequestContext {
  sessionId?: string
  distinctId?: string
}

/**
 * Extract PostHog tracing context from request headers.
 * Use this in API routes to get session/distinct IDs for server-side event tracking.
 */
export function extractPostHogContext(request: NextRequest): PostHogRequestContext {
  return {
    sessionId: request.headers.get("X-POSTHOG-SESSION-ID") ?? undefined,
    distinctId: request.headers.get("X-POSTHOG-DISTINCT-ID") ?? undefined,
  }
}
