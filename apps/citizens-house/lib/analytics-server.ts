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
 *   action: "onchain_store_success",
 *   accountId: "alice.near",
 * })
 * ```
 */
import "server-only"

import * as Sentry from "@sentry/nextjs"
import { getPostHogServer } from "./providers/posthog-server"
import type { AnalyticsEvent } from "./schemas/analytics"

/**
 * Options for server-side event tracking.
 */
export interface TrackServerEventOptions {
  /** Session ID for linking event to session replay */
  sessionId?: string
}

/**
 * Track an analytics event from server-side code.
 *
 * @param distinctId - User identifier (NEAR account ID or anonymous ID)
 * @param event - Strongly-typed analytics event
 * @param options - Optional tracking context (session ID for replay linkage)
 */
export async function trackServerEvent<T extends AnalyticsEvent>(
  distinctId: string,
  event: T,
  options?: TrackServerEventOptions,
): Promise<void> {
  const client = getPostHogServer()
  if (!client) return

  const { domain, action, ...properties } = event
  const eventName = `${domain}:${action}`

  try {
    await Sentry.startSpan(
      {
        name: "posthog.captureImmediate",
        op: "analytics.posthog",
        attributes: {
          event_name: eventName,
          distinct_id: distinctId,
          has_session_id: Boolean(options?.sessionId),
        },
      },
      () =>
        client.captureImmediate({
          distinctId,
          event: eventName,
          properties: {
            ...properties,
            // Include session ID if provided (links event to session replay)
            ...(options?.sessionId && { $session_id: options.sessionId }),
          },
        }),
    )
  } catch (error) {
    // Analytics failures should not break request flow.
    Sentry.captureException(error, {
      level: "warning",
      tags: { area: "posthog-server-capture" },
      extra: {
        distinctId,
        eventName,
      },
    })
    Sentry.logger.error("posthog_capture_failed", {
      distinct_id: distinctId,
      event_name: eventName,
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
