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

  await client.captureImmediate({
    distinctId,
    event: eventName,
    properties: {
      ...properties,
      // Include session ID if provided (links event to session replay)
      ...(options?.sessionId && { $session_id: options.sessionId }),
    },
  })
}

/**
 * Capture a server-side error with typed analytics and PostHog exception tracking.
 *
 * Sends both a typed analytics event and PostHog's native exception capture
 * for full stack trace visibility.
 *
 * @param error - The error to capture
 * @param distinctId - User identifier (or undefined for anonymous)
 * @param context - Error context including stage and optional session ID
 */
export async function captureServerError(
  error: Error,
  distinctId: string | undefined,
  context: { stage: "server_handler" | "api_route"; sessionId?: string },
): Promise<void> {
  const effectiveDistinctId = distinctId || "anonymous"

  await trackServerEvent(effectiveDistinctId, {
    domain: "errors",
    action: "exception_captured",
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    stage: context.stage,
  })

  // Also send to PostHog's exception tracking
  const client = getPostHogServer()
  if (client) {
    await client.captureException(error, effectiveDistinctId, {
      $session_id: context.sessionId,
    })
  }
}
