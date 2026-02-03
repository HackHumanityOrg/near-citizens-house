/**
 * SumSub Webhook Schema Drift Detection
 *
 * This test documents the expected fields in SumSub webhook payloads and
 * will fail if the schema changes unexpectedly, helping catch drift between
 * our schema and SumSub's documentation.
 *
 * @see https://docs.sumsub.com/docs/user-verification-webhooks
 */
import { describe, expect, it } from "vitest"

import { sumsubWebhookPayloadSchema } from "../schemas/providers/sumsub"

describe("SumSub webhook schema drift detection", () => {
  /**
   * Fields documented at https://docs.sumsub.com/docs/user-verification-webhooks
   * Last reviewed: 2026-02-03
   *
   * If this test fails, it means the schema has changed. Review the SumSub
   * documentation to determine if:
   * - We added a field that SumSub now provides (update this list)
   * - We removed a field we no longer need (update this list)
   * - SumSub added new fields we should handle (update schema and this list)
   */
  const documentedFields = [
    "type",
    "applicantId",
    "inspectionId",
    "correlationId",
    "levelName",
    "externalUserId",
    "externalUserIdType",
    "applicantType",
    "reviewResult",
    "reviewStatus",
    "reviewMode",
    "createdAtMs",
    "createdAt",
    "sandboxMode",
    "clientId",
  ]

  it("should match documented SumSub webhook fields", () => {
    const schemaKeys = Object.keys(sumsubWebhookPayloadSchema.shape)

    expect(schemaKeys.sort()).toEqual(documentedFields.sort())
  })

  it("should have externalUserId as required (used for NEAR account mapping)", () => {
    // externalUserId is critical - it maps to the NEAR account ID
    // Check that parsing fails without externalUserId
    const result = sumsubWebhookPayloadSchema.safeParse({
      type: "applicantReviewed",
      applicantId: "test-123",
      // missing externalUserId
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("externalUserId"))).toBe(true)
    }
  })

  it("should have applicantId as required", () => {
    const result = sumsubWebhookPayloadSchema.safeParse({
      type: "applicantReviewed",
      externalUserId: "test.near",
      // missing applicantId
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("applicantId"))).toBe(true)
    }
  })

  it("should have type as required", () => {
    const result = sumsubWebhookPayloadSchema.safeParse({
      applicantId: "test-123",
      externalUserId: "test.near",
      // missing type
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("type"))).toBe(true)
    }
  })

  it("should accept a valid minimal webhook payload", () => {
    const result = sumsubWebhookPayloadSchema.safeParse({
      type: "applicantReviewed",
      applicantId: "test-123",
      externalUserId: "test.near",
    })

    expect(result.success).toBe(true)
  })

  it("should accept a complete webhook payload", () => {
    const result = sumsubWebhookPayloadSchema.safeParse({
      type: "applicantReviewed",
      applicantId: "test-123",
      inspectionId: "inspection-456",
      correlationId: "correlation-789",
      levelName: "basic-kyc-level",
      externalUserId: "test.near",
      externalUserIdType: "string",
      applicantType: "individual",
      reviewResult: {
        reviewAnswer: "GREEN",
      },
      reviewStatus: "completed",
      reviewMode: "regular",
      createdAtMs: "1706918400000",
      createdAt: "2026-02-03 00:00:00+0000",
      sandboxMode: true,
      clientId: "client-abc",
    })

    expect(result.success).toBe(true)
  })
})
