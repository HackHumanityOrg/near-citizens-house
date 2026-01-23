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
      trackEvent({ domain: "verification", action: "flow_started", platform: "desktop" })
      trackEvent({ domain: "verification", action: "polling_started", accountId: "alice.near" })
      trackEvent({ domain: "verification", action: "polling_timeout", accountId: "alice.near", pollCount: 5 })
      trackEvent({ domain: "verification", action: "error_shown", errorCode: "E001", stage: "wallet_connect" })
      trackEvent({ domain: "verification", action: "error_retry_clicked", errorCode: "E001" })
      trackEvent({ domain: "verification", action: "error_abandoned", errorCode: "E001" })
      trackEvent({ domain: "verification", action: "proof_submitted", accountId: "alice.near" })
      trackEvent({ domain: "verification", action: "proof_validated", accountId: "alice.near" })
      trackEvent({
        domain: "verification",
        action: "stored_onchain",
        accountId: "alice.near",
        attestationType: "passport",
      })
      trackEvent({ domain: "verification", action: "rejected", reason: "invalid", errorCode: "E002" })
      expect(true).toBe(true)
    })

    it("accepts valid citizens events", () => {
      trackEvent({ domain: "citizens", action: "details_viewed", viewedAccountId: "alice.near" })
      trackEvent({ domain: "citizens", action: "signature_verify_opened", viewedAccountId: "alice.near" })
      trackEvent({ domain: "citizens", action: "proof_verify_opened", viewedAccountId: "alice.near" })
      trackEvent({ domain: "citizens", action: "copied_to_clipboard", viewedAccountId: "bob.near", field: "hash" })
      trackEvent({ domain: "citizens", action: "file_downloaded", viewedAccountId: "bob.near", fileType: "proof" })
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

    it("accepts valid error events", () => {
      trackEvent({
        domain: "errors",
        action: "exception_captured",
        errorName: "Error",
        errorMessage: "test",
        stage: "client_render",
      })
      trackEvent({
        domain: "errors",
        action: "exception_captured",
        errorName: "Error",
        errorMessage: "test",
        stage: "global_error",
      })
      trackEvent({
        domain: "errors",
        action: "exception_captured",
        errorName: "Error",
        errorMessage: "test",
        stage: "server_handler",
      })
      trackEvent({
        domain: "errors",
        action: "exception_captured",
        errorName: "Error",
        errorMessage: "test",
        stage: "api_route",
      })
      trackEvent({
        domain: "errors",
        action: "exception_captured",
        errorName: "Error",
        errorMessage: "test",
        stage: "client_render",
        errorStack: "stack",
        componentStack: "component",
      })
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
      trackEvent({ domain: "verification", action: "flow_started" })
      expect(true).toBe(true)
    })

    it("rejects extra properties (strict mode)", () => {
      // @ts-expect-error - extraField is not allowed
      trackEvent({ domain: "verification", action: "flow_started", platform: "desktop", extraField: "bad" })
      expect(true).toBe(true)
    })

    it("rejects invalid enum values", () => {
      // @ts-expect-error - tablet is not a valid platform
      trackEvent({ domain: "verification", action: "flow_started", platform: "tablet" })
      expect(true).toBe(true)
    })

    it("rejects invalid domain", () => {
      // @ts-expect-error - invalid is not a valid domain
      trackEvent({ domain: "invalid", action: "flow_started", platform: "desktop" })
      expect(true).toBe(true)
    })

    it("rejects errors event without required stage", () => {
      // @ts-expect-error - missing required 'stage' property
      trackEvent({ domain: "errors", action: "exception_captured", errorName: "Error", errorMessage: "test" })
      expect(true).toBe(true)
    })

    it("rejects invalid stage value for errors", () => {
      // @ts-expect-error - invalid_stage is not a valid stage
      trackEvent({
        domain: "errors",
        action: "exception_captured",
        errorName: "Error",
        errorMessage: "test",
        stage: "invalid_stage",
      })
      expect(true).toBe(true)
    })
  })
})
