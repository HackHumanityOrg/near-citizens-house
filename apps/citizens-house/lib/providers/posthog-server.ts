/**
 * Server-side PostHog Client
 *
 * For use in Server Components, API Routes, and Server Actions.
 */
import "server-only"

import { PostHog } from "posthog-node"
import { env } from "../schemas/env"

let posthogClient: PostHog | null = null

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
  if (!apiKey) return null

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host: "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    })
  }

  return posthogClient
}

export function isPostHogServerEnabled(): boolean {
  return !!env.NEXT_PUBLIC_POSTHOG_KEY
}
