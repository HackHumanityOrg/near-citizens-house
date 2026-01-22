/**
 * Type-level tests for logger RequestContext.
 * These tests verify compile-time type safety for field names, timer names, and value types.
 */
import { describe, it, expect } from "vitest"
import {
  createSumSubWebhookContext,
  createStatusContext,
  createGetVerificationsContext,
  createCheckIsVerifiedContext,
} from "../logger/request-context"

describe("Logger RequestContext Type Safety", () => {
  describe("SumSubWebhookContext - valid operations compile correctly", () => {
    it("accepts valid top-level fields", () => {
      const ctx = createSumSubWebhookContext()
      ctx.set("route", "/api/verification/sumsub/webhook")
      ctx.set("method", "POST")
      ctx.set("nearAccountId", "alice.near")
      ctx.set("sumsubApplicantId", "applicant-123")
      ctx.set("webhookType", "applicantReviewed")
      ctx.set("reviewResult", "GREEN")
      ctx.set("outcome", "success")
      ctx.set("statusCode", 200)
      ctx.set("signaturePresent", true)
      expect(true).toBe(true)
    })

    it("accepts valid nested paths via setNested", () => {
      const ctx = createSumSubWebhookContext()
      ctx.setNested("stageReached.parsed", true)
      ctx.setNested("stageReached.signatureValidated", true)
      ctx.setNested("stageReached.storedOnChain", false)
      ctx.setNested("externalCalls.sumsubCalled", true)
      ctx.setNested("externalCalls.sumsubSuccess", true)
      ctx.setNested("error.code", "VALIDATION_ERROR")
      ctx.setNested("error.message", "Invalid signature")
      ctx.setNested("error.stage", "signature_validate")
      ctx.setNested("contract.contractId", "verify.near")
      ctx.setNested("keyPool.index", 0)
      expect(true).toBe(true)
    })

    it("accepts valid timer names", () => {
      const ctx = createSumSubWebhookContext()
      ctx.startTimer("parseBody")
      ctx.endTimer("parseBody")
      ctx.startTimer("sumsubVerify")
      ctx.endTimer("sumsubVerify")
      ctx.startTimer("signatureValidation")
      ctx.endTimer("signatureValidation")
      ctx.startTimer("contractStorage")
      ctx.endTimer("contractStorage")
      expect(true).toBe(true)
    })

    it("accepts valid outcome values", () => {
      const ctx = createSumSubWebhookContext()
      ctx.set("outcome", "success")
      ctx.set("outcome", "validation_error")
      ctx.set("outcome", "signature_error")
      ctx.set("outcome", "proof_error")
      ctx.set("outcome", "storage_error")
      ctx.set("outcome", "internal_error")
      expect(true).toBe(true)
    })
  })

  describe("SumSubWebhookContext - invalid operations cause type errors", () => {
    it("rejects invalid field names", () => {
      const ctx = createSumSubWebhookContext()
      // @ts-expect-error - invalidField is not a valid key on SumSubWebhookEvent
      ctx.set("invalidField", "value")
      expect(true).toBe(true)
    })

    it("rejects invalid timer names", () => {
      const ctx = createSumSubWebhookContext()
      // @ts-expect-error - invalidTimer is not a valid timer name
      ctx.startTimer("invalidTimer")
      expect(true).toBe(true)
    })

    it("rejects StatusContext timer names on SumSubWebhookContext", () => {
      const ctx = createSumSubWebhookContext()
      // @ts-expect-error - redisLookup is a StatusTimers, not SumSubWebhookTimers
      ctx.startTimer("redisLookup")
      expect(true).toBe(true)
    })

    it("rejects invalid outcome values", () => {
      const ctx = createSumSubWebhookContext()
      // @ts-expect-error - invalid_outcome is not a valid Outcome
      ctx.set("outcome", "invalid_outcome")
      expect(true).toBe(true)
    })

    it("rejects wrong value types for boolean fields", () => {
      const ctx = createSumSubWebhookContext()
      // @ts-expect-error - signaturePresent expects boolean, not string
      ctx.set("signaturePresent", "true")
      expect(true).toBe(true)
    })

    it("rejects wrong value types for number fields", () => {
      const ctx = createSumSubWebhookContext()
      // @ts-expect-error - statusCode expects number, not string
      ctx.set("statusCode", "200")
      expect(true).toBe(true)
    })
  })

  describe("StatusContext - valid operations compile correctly", () => {
    it("accepts valid fields and timers", () => {
      const ctx = createStatusContext()
      ctx.set("route", "/api/verification/status")
      ctx.set("method", "GET")
      ctx.set("nearAccountId", "bob.near")
      ctx.set("sessionFound", true)
      ctx.set("usedContractFallback", false)
      ctx.set("outcome", "verified")
      ctx.startTimer("redisLookup")
      ctx.endTimer("redisLookup")
      ctx.startTimer("contractFallback")
      ctx.endTimer("contractFallback")
      expect(true).toBe(true)
    })

    it("accepts nested paths via setNested", () => {
      const ctx = createStatusContext()
      ctx.setNested("error.code", "NOT_FOUND")
      ctx.setNested("error.message", "Session not found")
      expect(true).toBe(true)
    })
  })

  describe("StatusContext - invalid operations cause type errors", () => {
    it("rejects SumSubWebhookContext-specific fields", () => {
      const ctx = createStatusContext()
      // @ts-expect-error - stageReached is a SumSubWebhookEvent field, not StatusRequestEvent
      ctx.set("stageReached", { parsed: true })
      expect(true).toBe(true)
    })

    it("rejects SumSubWebhookContext timer names", () => {
      const ctx = createStatusContext()
      // @ts-expect-error - sumsubVerify is a SumSubWebhookTimers, not StatusTimers
      ctx.startTimer("sumsubVerify")
      expect(true).toBe(true)
    })
  })

  describe("GetVerificationsContext - valid operations compile correctly", () => {
    it("accepts valid fields and timers", () => {
      const ctx = createGetVerificationsContext()
      ctx.set("action", "getVerificationsWithStatus")
      ctx.set("page", 1)
      ctx.set("pageSize", 20)
      ctx.set("verificationsReturned", 15)
      ctx.set("signatureVerificationAttempted", 15)
      ctx.set("signatureVerificationSucceeded", 14)
      ctx.set("signatureVerificationFailed", 1)
      ctx.set("outcome", "success")
      ctx.startTimer("contractFetch")
      ctx.endTimer("contractFetch")
      expect(true).toBe(true)
    })
  })

  describe("GetVerificationsContext - invalid operations cause type errors", () => {
    it("rejects route-based fields", () => {
      const ctx = createGetVerificationsContext()
      // @ts-expect-error - route is for route events, not action events
      ctx.set("route", "/api/test")
      expect(true).toBe(true)
    })

    it("rejects invalid timer names", () => {
      const ctx = createGetVerificationsContext()
      // @ts-expect-error - redisLookup is not a GetVerificationsTimers
      ctx.startTimer("redisLookup")
      expect(true).toBe(true)
    })
  })

  describe("CheckIsVerifiedContext - valid operations compile correctly", () => {
    it("accepts valid fields and timers", () => {
      const ctx = createCheckIsVerifiedContext()
      ctx.set("action", "checkIsVerified")
      ctx.set("nearAccountId", "alice.near")
      ctx.set("isVerified", true)
      ctx.set("outcome", "verified")
      ctx.startTimer("contractCall")
      ctx.endTimer("contractCall")
      expect(true).toBe(true)
    })
  })

  describe("CheckIsVerifiedContext - invalid operations cause type errors", () => {
    it("rejects fields from other event types", () => {
      const ctx = createCheckIsVerifiedContext()
      // @ts-expect-error - sessionFound is a StatusRequestEvent field
      ctx.set("sessionFound", true)
      expect(true).toBe(true)
    })

    it("rejects invalid timer names", () => {
      const ctx = createCheckIsVerifiedContext()
      // @ts-expect-error - contractFetch is not a CheckIsVerifiedTimers
      ctx.startTimer("contractFetch")
      expect(true).toBe(true)
    })
  })

  describe("setMany - type safety", () => {
    it("accepts valid multiple fields", () => {
      const ctx = createSumSubWebhookContext()
      ctx.setMany({
        route: "/api/verification/sumsub/webhook",
        method: "POST",
        nearAccountId: "test.near",
        outcome: "success",
      })
      expect(true).toBe(true)
    })

    it("rejects invalid fields in setMany", () => {
      const ctx = createSumSubWebhookContext()
      ctx.setMany({
        route: "/api/verification/sumsub/webhook",
        method: "POST",
        // @ts-expect-error - invalidField is not a valid key
        invalidField: "value",
      })
      expect(true).toBe(true)
    })
  })

  describe("get - type safety", () => {
    it("returns correctly typed values", () => {
      const ctx = createSumSubWebhookContext()
      ctx.set("outcome", "success")
      ctx.set("statusCode", 200)
      ctx.set("signaturePresent", true)

      const outcome = ctx.get("outcome")
      const statusCode = ctx.get("statusCode")
      const signaturePresent = ctx.get("signaturePresent")

      // These type assertions verify the return types are correct
      const _outcome: typeof outcome = "success" as const
      const _statusCode: typeof statusCode = 200
      const _signaturePresent: typeof signaturePresent = true

      expect(_outcome).toBeDefined()
      expect(_statusCode).toBeDefined()
      expect(_signaturePresent).toBeDefined()
    })
  })
})
