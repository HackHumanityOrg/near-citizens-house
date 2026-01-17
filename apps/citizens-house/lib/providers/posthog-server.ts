/**
 * Server-side PostHog Client
 *
 * For use in Server Components, API Routes, and Server Actions.
 */
import "server-only"

import { PostHog } from "posthog-node"
import { env } from "../schemas/env"

/**
 * Create a PostHog client for server-side analytics and feature flags.
 *
 * Uses the direct PostHog host (not the proxy) since server-side requests
 * don't need ad-blocker bypass and this avoids unnecessary latency.
 *
 * IMPORTANT: Always call `await client.shutdown()` after use to flush events.
 */
export function createPostHogServerClient(): PostHog | null {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey) return null

  return new PostHog(apiKey, {
    host: "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  })
}

export function isPostHogServerEnabled(): boolean {
  return !!env.NEXT_PUBLIC_POSTHOG_KEY
}
