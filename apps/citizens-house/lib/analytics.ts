/**
 * Analytics Module
 *
 * Type-safe event tracking for PostHog using Zod schemas.
 *
 * @example
 * ```ts
 * import { trackEvent } from "@/lib/analytics"
 *
 * // ✅ Type-safe: domain+action enforced together
 * trackEvent({ domain: "verification", action: "flow_started", platform: "desktop" })
 *
 * // ❌ TypeScript error: action "unknown" doesn't exist on domain "verification"
 * trackEvent({ domain: "verification", action: "unknown", platform: "desktop" })
 *
 * // ❌ TypeScript error: 'randomField' does not exist
 * trackEvent({ domain: "verification", action: "flow_started", platform: "desktop", randomField: "y" })
 * ```
 */
import posthog from "posthog-js"
import type { AnalyticsEvent } from "./schemas/analytics"

export type { AnalyticsEvent } from "./schemas/analytics"

/**
 * Track a strongly-typed analytics event.
 *
 * Event name is formatted as "domain:action" (e.g., "verification:flow_started").
 * Properties (excluding domain/action) are sent as event properties.
 */
export function trackEvent<T extends AnalyticsEvent>(event: T): void {
  const { domain, action, ...properties } = event
  const eventName = `${domain}:${action}`
  posthog.capture(eventName, properties)
}

/**
 * Check if analytics is enabled (PostHog initialized and consent granted)
 */
export function isAnalyticsEnabled(): boolean {
  return typeof window !== "undefined" && posthog.__loaded && !posthog.has_opted_out_capturing()
}

/**
 * Capture an error with typed analytics and PostHog exception tracking.
 *
 * Sends both a typed analytics event and PostHog's native exception capture
 * for full stack trace visibility.
 *
 * @param error - The error to capture
 * @param context - Error context including stage and optional component stack
 */
export function captureError(
  error: Error,
  context: { stage: "client_render" | "global_error"; componentStack?: string },
): void {
  trackEvent({
    domain: "errors",
    action: "exception_captured",
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    stage: context.stage,
    componentStack: context.componentStack,
  })

  // Also send to PostHog's exception tracking for stack traces
  posthog.captureException(error)
}

/**
 * Identify a verified user with user properties for segmentation.
 *
 * Sets both persistent ($set) and once-only ($set_once) properties
 * for verified user cohort analysis.
 *
 * @param accountId - The NEAR account ID of the verified user
 * @param data - Verification details including attestation type and platform
 */
export function identifyVerifiedUser(
  accountId: string,
  data: {
    attestationType?: string
    platform: "desktop" | "mobile"
  },
): void {
  const now = new Date().toISOString()

  posthog.identify(accountId, {
    verification_status: "verified",
    verification_date: now,
    attestation_type: data.attestationType ?? "unknown",
    verification_platform: data.platform,
  })

  // Set once-only properties (won't overwrite existing values)
  posthog.capture("$set", {
    $set_once: {
      first_verification_date: now,
      first_verification_platform: data.platform,
    },
  })
}

/**
 * Get the current platform based on viewport width.
 * Returns "mobile" for viewports <= 767px, "desktop" otherwise.
 */
export function getPlatform(): "desktop" | "mobile" {
  if (typeof window === "undefined") return "desktop"
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop"
}
