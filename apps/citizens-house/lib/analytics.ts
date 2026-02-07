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
 * trackEvent({ domain: "verification", action: "flow_start", platform: "desktop" })
 *
 * // ❌ TypeScript error: action "unknown" doesn't exist on domain "verification"
 * trackEvent({ domain: "verification", action: "unknown", platform: "desktop" })
 *
 * // ❌ TypeScript error: 'randomField' does not exist
 * trackEvent({ domain: "verification", action: "flow_start", platform: "desktop", randomField: "y" })
 * ```
 */
import posthog from "posthog-js"
import type { AnalyticsEvent } from "./schemas/analytics"

export type { AnalyticsEvent } from "./schemas/analytics"

/**
 * Track a strongly-typed analytics event.
 *
 * Event name is formatted as "domain:action" (e.g., "verification:flow_start").
 * Properties (excluding domain/action) are sent as event properties.
 */
export function trackEvent<T extends AnalyticsEvent>(event: T): void {
  const { domain, action, ...properties } = event
  const eventName = `${domain}:${action}`
  posthog.capture(eventName, properties)
}

/**
 * Identify a verified user with user properties for segmentation.
 *
 * Sets both persistent ($set) and once-only ($set_once) properties
 * for verified user cohort analysis.
 *
 * The user should already be identified via wallet connection.
 * This call enriches their profile with verification-specific properties.
 *
 * @param accountId - The NEAR account ID of the verified user
 * @param data - Verification details including platform
 */
export function identifyVerifiedUser(
  accountId: string,
  data: {
    platform: "desktop" | "mobile"
  },
): void {
  const now = new Date().toISOString()

  // PostHog identify() signature: identify(distinctId, $set, $set_once)
  // - Second param ($set): Properties that update on each call
  // - Third param ($set_once): Properties set only if not already set
  posthog.identify(
    accountId,
    {
      verification_status: "verified",
      verification_date: now,
      verification_platform: data.platform,
    },
    {
      first_verification_date: now,
      first_verification_platform: data.platform,
    },
  )
}

/**
 * Get the current platform based on viewport width.
 * Returns "mobile" for viewports <= 767px, "desktop" otherwise.
 */
export function getPlatform(): "desktop" | "mobile" {
  if (typeof window === "undefined") return "desktop"
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop"
}
