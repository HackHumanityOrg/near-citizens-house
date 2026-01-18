/**
 * Type-level tests for logger RequestContext.
 * These tests verify compile-time type safety for field paths, timer names, and value types.
 */
import { describe, it, expect } from "vitest"
import {
  createVerifyContext,
  createStatusContext,
  createGetVerificationsContext,
  createCheckIsVerifiedContext,
} from "../logger/request-context"

describe("Logger RequestContext Type Safety", () => {
  describe("VerifyContext - valid operations compile correctly", () => {
    it("accepts valid top-level fields", () => {
      const ctx = createVerifyContext()
      ctx.set("route", "/api/verification/verify")
      ctx.set("method", "POST")
      ctx.set("nearAccountId", "alice.near")
      ctx.set("attestationType", "passport")
      ctx.set("outcome", "success")
      ctx.set("statusCode", 200)
      ctx.set("hasProof", true)
      ctx.set("signaturePresent", false)
      expect(true).toBe(true)
    })

    it("accepts valid nested paths", () => {
      const ctx = createVerifyContext()
      ctx.set("stageReached.parsed", true)
      ctx.set("stageReached.signatureValidated", true)
      ctx.set("stageReached.storedOnChain", false)
      ctx.set("externalCalls.selfxyzCalled", true)
      ctx.set("externalCalls.selfxyzSuccess", true)
      ctx.set("error.code", "VALIDATION_ERROR")
      ctx.set("error.message", "Invalid signature")
      ctx.set("error.stage", "signature_validate")
      ctx.set("contract.contractId", "verify.near")
      ctx.set("keyPool.index", 0)
      expect(true).toBe(true)
    })

    it("accepts valid timer names", () => {
      const ctx = createVerifyContext()
      ctx.startTimer("parseBody")
      ctx.endTimer("parseBody")
      ctx.startTimer("selfxyzVerify")
      ctx.endTimer("selfxyzVerify")
      ctx.startTimer("signatureValidation")
      ctx.endTimer("signatureValidation")
      ctx.startTimer("contractStorage")
      ctx.endTimer("contractStorage")
      expect(true).toBe(true)
    })

    it("accepts valid outcome values", () => {
      const ctx = createVerifyContext()
      ctx.set("outcome", "success")
      ctx.set("outcome", "validation_error")
      ctx.set("outcome", "signature_error")
      ctx.set("outcome", "proof_error")
      ctx.set("outcome", "storage_error")
      ctx.set("outcome", "internal_error")
      expect(true).toBe(true)
    })

    it("accepts valid error stage values", () => {
      const ctx = createVerifyContext()
      ctx.set("error.stage", "request_validation")
      ctx.set("error.stage", "self_verify")
      ctx.set("error.stage", "signature_parse")
      ctx.set("error.stage", "signature_validate")
      ctx.set("error.stage", "storage")
      expect(true).toBe(true)
    })
  })

  describe("VerifyContext - invalid operations cause type errors", () => {
    it("rejects invalid field paths", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - invalidField is not a valid path
      ctx.set("invalidField", "value")
      expect(true).toBe(true)
    })

    it("rejects invalid nested paths", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - stageReached.invalid is not a valid path
      ctx.set("stageReached.invalid", true)
      expect(true).toBe(true)
    })

    it("rejects invalid timer names", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - invalidTimer is not a valid timer name
      ctx.startTimer("invalidTimer")
      expect(true).toBe(true)
    })

    it("rejects StatusContext timer names on VerifyContext", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - redisLookup is a StatusTimers, not VerifyTimers
      ctx.startTimer("redisLookup")
      expect(true).toBe(true)
    })

    it("rejects invalid outcome values", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - invalid_outcome is not a valid Outcome
      ctx.set("outcome", "invalid_outcome")
      expect(true).toBe(true)
    })

    it("rejects invalid error stage values", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - invalid_stage is not a valid ErrorStage
      ctx.set("error.stage", "invalid_stage")
      expect(true).toBe(true)
    })

    it("rejects wrong value types for boolean fields", () => {
      const ctx = createVerifyContext()
      // @ts-expect-error - hasProof expects boolean, not string
      ctx.set("hasProof", "true")
      expect(true).toBe(true)
    })

    it("rejects wrong value types for number fields", () => {
      const ctx = createVerifyContext()
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
  })

  describe("StatusContext - invalid operations cause type errors", () => {
    it("rejects VerifyContext-specific fields", () => {
      const ctx = createStatusContext()
      // @ts-expect-error - stageReached.parsed is a VerifyPaths, not StatusPaths
      ctx.set("stageReached.parsed", true)
      expect(true).toBe(true)
    })

    it("rejects VerifyContext timer names", () => {
      const ctx = createStatusContext()
      // @ts-expect-error - selfxyzVerify is a VerifyTimers, not StatusTimers
      ctx.startTimer("selfxyzVerify")
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
      ctx.set("zkVerificationSucceeded", 10)
      ctx.set("outcome", "success")
      ctx.startTimer("contractFetch")
      ctx.endTimer("contractFetch")
      ctx.startTimer("zkVerification")
      ctx.endTimer("zkVerification")
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
      // @ts-expect-error - sessionFound is a StatusPaths field
      ctx.set("sessionFound", true)
      expect(true).toBe(true)
    })

    it("rejects invalid timer names", () => {
      const ctx = createCheckIsVerifiedContext()
      // @ts-expect-error - zkVerification is not a CheckIsVerifiedTimers
      ctx.startTimer("zkVerification")
      expect(true).toBe(true)
    })
  })

  describe("setMany - type safety", () => {
    it("accepts valid multiple fields", () => {
      const ctx = createVerifyContext()
      ctx.setMany({
        route: "/api/verification/verify",
        method: "POST",
        nearAccountId: "test.near",
        outcome: "success",
      })
      expect(true).toBe(true)
    })
  })
})
