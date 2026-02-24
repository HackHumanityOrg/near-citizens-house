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
    void client
      .captureImmediate({
        distinctId,
        event: eventName,
        properties: {
          ...properties,
          // Include session ID if provided (links event to session replay)
          ...(options?.sessionId && { $session_id: options.sessionId }),
        },
      })
      .catch((error) => {
        Sentry.captureException(error, {
          level: "warning",
          tags: { area: "posthog_server_capture" },
          extra: { distinctId, eventName },
        })
        Sentry.logger.error("posthog_capture_failed", {
          distinct_id: distinctId,
          event_name: eventName,
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
      })
  } catch (error) {
    // Analytics delivery should never break request flow.
    Sentry.captureException(error, {
      level: "warning",
      tags: { area: "posthog_server_capture" },
      extra: { distinctId, eventName },
    })
    Sentry.logger.error("posthog_capture_failed", {
      distinct_id: distinctId,
      event_name: eventName,
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

/**
 * Capture a server-side error with typed analytics.
 *
 * Keeps stack traces and exception reporting in Sentry for consistency with client-side telemetry.
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

  try {
    await trackServerEvent(effectiveDistinctId, {
      domain: "errors",
      action: "exception_captured",
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      stage: context.stage,
    })
  } catch {
    // trackServerEvent already captures Sentry diagnostics and should not throw,
    // but keep this boundary to prevent cascading failures.
  }
}
