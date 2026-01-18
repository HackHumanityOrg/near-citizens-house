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

export type { AnalyticsEvent, VerificationEvent, CitizensEvent, ConsentEvent, EventDomain } from "./schemas/analytics"
export {
  analyticsEventSchema,
  verificationEventSchema,
  citizensEventSchema,
  consentEventSchema,
} from "./schemas/analytics"

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
