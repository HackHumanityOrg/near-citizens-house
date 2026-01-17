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
 * trackEvent({ domain: "wallet", action: "connected", accountId: "alice.near" })
 *
 * // ❌ TypeScript error: action "started" doesn't exist on domain "wallet"
 * trackEvent({ domain: "wallet", action: "started", accountId: "alice.near" })
 *
 * // ❌ TypeScript error: 'randomField' does not exist
 * trackEvent({ domain: "wallet", action: "connected", accountId: "x", randomField: "y" })
 * ```
 */
import posthog from "posthog-js"
import type { AnalyticsEvent } from "./schemas/analytics"

export type { AnalyticsEvent, WalletEvent, VerificationEvent, EventDomain } from "./schemas/analytics"
export { analyticsEventSchema, walletEventSchema, verificationEventSchema } from "./schemas/analytics"

/**
 * Track a strongly-typed analytics event.
 *
 * Event name is formatted as "domain:action" (e.g., "wallet:connected").
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
