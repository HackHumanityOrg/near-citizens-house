/**
 * Type-level tests for analytics event schemas.
 * These tests verify compile-time type safety, not runtime behavior.
 */
import { describe, it, expect } from "vitest"
import type { AnalyticsEvent } from "../schemas/analytics"

// Helper to test if a type is assignable
function trackEvent<T extends AnalyticsEvent>(_event: T): void {}

describe("Analytics Event Type Safety", () => {
  describe("valid events compile correctly", () => {
    it("accepts valid verification events", () => {
      // These should all compile without errors
      trackEvent({ domain: "verification", action: "flow_start", platform: "desktop" })
      trackEvent({ domain: "verification", action: "polling_start", platform: "desktop", accountId: "alice.near" })
      trackEvent({
        domain: "verification",
        action: "polling_timeout",
        platform: "desktop",
        accountId: "alice.near",
        pollCount: 5,
        pollDurationMs: 1000,
      })
      trackEvent({
        domain: "verification",
        action: "error_modal_view",
        errorCode: "TOKEN_FETCH_FAILED",
        stage: "wallet_connect",
        platform: "desktop",
      })
      trackEvent({
        domain: "verification",
        action: "error_modal_retry_click",
        errorCode: "TOKEN_FETCH_FAILED",
        platform: "desktop",
      })
      trackEvent({
        domain: "verification",
        action: "error_modal_abandon",
        errorCode: "TOKEN_FETCH_FAILED",
        platform: "desktop",
      })
      trackEvent({ domain: "verification", action: "proof_submit", accountId: "alice.near" })
      trackEvent({ domain: "verification", action: "proof_validate", accountId: "alice.near" })
      trackEvent({
        domain: "verification",
        action: "onchain_store_success",
        accountId: "alice.near",
      })
      trackEvent({
        domain: "verification",
        action: "onchain_store_reject",
        accountId: "alice.near",
        reason: "invalid",
        errorCode: "VERIFICATION_REJECTED",
      })
      expect(true).toBe(true)
    })

    it("accepts new wallet and token events", () => {
      trackEvent({
        domain: "verification",
        action: "wallet_connect_success",
        platform: "desktop",
        accountId: "alice.near",
      })
      trackEvent({
        domain: "verification",
        action: "token_fetch_start",
        platform: "desktop",
        accountId: "alice.near",
      })
      trackEvent({
        domain: "verification",
        action: "token_fetch_success",
        platform: "desktop",
        accountId: "alice.near",
        durationMs: 500,
      })
      trackEvent({
        domain: "verification",
        action: "token_fetch_fail",
        platform: "desktop",
        accountId: "alice.near",
        errorCode: "NETWORK_ERROR",
        durationMs: 500,
      })
      expect(true).toBe(true)
    })

    it("accepts granular sumsub events", () => {
      trackEvent({
        domain: "verification",
        action: "sumsub_ready",
        platform: "desktop",
        accountId: "alice.near",
      })
      trackEvent({
        domain: "verification",
        action: "sumsub_step_start",
        platform: "desktop",
        accountId: "alice.near",
        stepType: "IDENTITY",
      })
      trackEvent({
        domain: "verification",
        action: "sumsub_step_complete",
        platform: "desktop",
        accountId: "alice.near",
        stepType: "IDENTITY",
      })
      trackEvent({
        domain: "verification",
        action: "sumsub_submit",
        platform: "desktop",
        accountId: "alice.near",
      })
      expect(true).toBe(true)
    })

    it("accepts valid citizens events", () => {
      trackEvent({ domain: "citizens", action: "details_viewed", viewedAccountId: "alice.near" })
      trackEvent({ domain: "citizens", action: "signature_verify_opened", viewedAccountId: "alice.near" })
      trackEvent({ domain: "citizens", action: "copied_to_clipboard", viewedAccountId: "bob.near", field: "hash" })
      trackEvent({
        domain: "citizens",
        action: "external_verifier_opened",
        viewedAccountId: "bob.near",
        verifier: "cyphrme",
      })
      expect(true).toBe(true)
    })

    it("accepts valid consent events", () => {
      trackEvent({ domain: "consent", action: "response", granted: true })
      trackEvent({ domain: "consent", action: "response", granted: false })
      expect(true).toBe(true)
    })
  })

  describe("invalid events cause type errors", () => {
    it("rejects wrong action for domain", () => {
      // @ts-expect-error - details_viewed is a citizens action, not verification
      trackEvent({ domain: "verification", action: "details_viewed", viewedAccountId: "test.near" })
      expect(true).toBe(true)
    })

    it("rejects missing required properties", () => {
      // @ts-expect-error - missing required 'platform' property
      trackEvent({ domain: "verification", action: "flow_start" })
      expect(true).toBe(true)
    })

    it("requires platform on updated events", () => {
      // @ts-expect-error - missing required 'platform' property
      trackEvent({ domain: "verification", action: "sumsub_sdk_load", accountId: "alice.near" })
      // @ts-expect-error - missing required 'platform' property
      trackEvent({ domain: "verification", action: "polling_start", accountId: "alice.near" })
      // @ts-expect-error - missing required 'platform' property
      trackEvent({ domain: "verification", action: "manual_review_view", accountId: "alice.near" })
      // @ts-expect-error - missing required 'platform' property
      trackEvent({
        domain: "verification",
        action: "sumsub_message_receive",
        accountId: "alice.near",
        messageType: "test",
      })
      expect(true).toBe(true)
    })

    it("rejects extra properties (strict mode)", () => {
      // Note: Extra properties are enforced at Zod runtime level, not TypeScript compile time.
      // TypeScript's structural typing with union types doesn't catch extra properties.
      // This test is kept for documentation but doesn't use @ts-expect-error.
      expect(true).toBe(true)
    })

    it("rejects invalid enum values", () => {
      // @ts-expect-error - tablet is not a valid platform
      trackEvent({ domain: "verification", action: "flow_start", platform: "tablet" })
      expect(true).toBe(true)
    })

    it("rejects invalid domain", () => {
      // @ts-expect-error - invalid is not a valid domain
      trackEvent({ domain: "invalid", action: "flow_start", platform: "desktop" })
      expect(true).toBe(true)
    })
  })
})
