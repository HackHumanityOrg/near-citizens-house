/**
 * Server-Side Analytics
 *
 * Type-safe event tracking for server components and API routes.
 * Uses PostHog's Node.js client for reliable server-side event capture.
 *
 * @example
 * ```ts
 * import { trackServerEvent } from "@/lib/analytics-server"
 *
 * await trackServerEvent("alice.near", {
 *   domain: "verification",
 *   action: "stored_onchain",
 *   accountId: "alice.near",
 *   attestationType: "passport",
 * })
 * ```
 */
import "server-only"

import { createPostHogServerClient } from "./providers/posthog-server"
import type { AnalyticsEvent } from "./schemas/analytics"

/**
 * Track an analytics event from server-side code.
 *
 * @param distinctId - User identifier (NEAR account ID or anonymous ID)
 * @param event - Strongly-typed analytics event
 */
export async function trackServerEvent<T extends AnalyticsEvent>(distinctId: string, event: T): Promise<void> {
  const client = createPostHogServerClient()
  if (!client) return

  const { domain, action, ...properties } = event
  const eventName = `${domain}:${action}`

  await client.captureImmediate({
    distinctId,
    event: eventName,
    properties,
  })
}
