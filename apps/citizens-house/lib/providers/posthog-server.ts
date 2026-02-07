/**
 * Server-side PostHog Client
 *
 * For use in Server Components, API Routes, and Server Actions.
 */
import "server-only"

import * as Sentry from "@sentry/nextjs"
import { PostHog } from "posthog-node"
import { env } from "../schemas/env"

let posthogClient: PostHog | null = null
let hasLoggedMissingPostHogKey = false

/**
 * Get or create a PostHog client for server-side analytics and feature flags.
 *
 * Uses the direct PostHog host (not the proxy) since server-side requests
 * don't need ad-blocker bypass and this avoids unnecessary latency.
 *
 * Use `captureImmediate()` for guaranteed delivery in serverless environments.
 */
export function getPostHogServer(): PostHog | null {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) {
    if (!hasLoggedMissingPostHogKey) {
      hasLoggedMissingPostHogKey = true
      Sentry.logger.warn("posthog_server_disabled_missing_key")
    }
    return null
  }

  if (!posthogClient) {
    try {
      posthogClient = new PostHog(apiKey, {
        host: "https://us.i.posthog.com",
        flushAt: 1,
        flushInterval: 0,
      })
      Sentry.logger.info("posthog_server_client_initialized")
    } catch (error) {
      Sentry.captureException(error, {
        tags: { area: "posthog-server-init" },
      })
      Sentry.logger.error("posthog_server_client_init_failed", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      return null
    }
  }

  return posthogClient
}

export function isPostHogServerEnabled(): boolean {
  return !!env.NEXT_PUBLIC_POSTHOG_KEY
}
