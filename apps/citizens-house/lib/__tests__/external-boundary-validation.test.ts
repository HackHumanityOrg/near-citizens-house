/**
 * Unit tests for external boundary validation schemas
 *
 * Tests runtime validation schemas for external RPC boundaries:
 * - NEAR RPC response validation (nearAccessKeyResponseSchema)
 */
import { describe, it, expect } from "vitest"
import * as allure from "allure-js-commons"
import { nearAccessKeyResponseSchema } from "../schemas/near"

describe("Near Citizens House", () => {
  describe("Shared Library Unit Tests", () => {
    describe("External Boundary Validation", () => {
      // ============================================================================
      // NEAR RPC Response Validation
      // ============================================================================

      describe("nearAccessKeyResponseSchema", () => {
        const validResponse = {
          nonce: 123456789,
          permission: "FullAccess",
          block_height: 100000000,
          block_hash: "abc123",
        }

        it("accepts valid RPC response with FullAccess string", async () => {
          await allure.severity("critical")
          await allure.step("Validate complete response", async () => {
            const result = nearAccessKeyResponseSchema.safeParse(validResponse)
            expect(result.success).toBe(true)
          })
        })

        it("accepts FullAccess object variant", async () => {
          await allure.severity("normal")
          await allure.step("Validate FullAccess object", async () => {
            const withObject = { ...validResponse, permission: { FullAccess: {} } }
            expect(nearAccessKeyResponseSchema.safeParse(withObject).success).toBe(true)

            const withNull = { ...validResponse, permission: { FullAccess: null } }
            expect(nearAccessKeyResponseSchema.safeParse(withNull).success).toBe(true)
          })
        })

        it("accepts response without optional fields", async () => {
          await allure.severity("normal")
          await allure.step("Validate minimal response", async () => {
            const minimal = {
              nonce: 1,
              permission: "FullAccess",
            }
            expect(nearAccessKeyResponseSchema.safeParse(minimal).success).toBe(true)
          })
        })

        it("accepts FunctionCall permission", async () => {
          await allure.severity("normal")
          await allure.step("Validate FunctionCall response", async () => {
            const withFunctionCall = {
              nonce: 1,
              permission: {
                FunctionCall: {
                  allowance: "250000000000000000000000",
                  receiver_id: "contract.near",
                  method_names: ["method1", "method2"],
                },
              },
            }
            expect(nearAccessKeyResponseSchema.safeParse(withFunctionCall).success).toBe(true)
          })
        })

        it("accepts FunctionCall with null allowance", async () => {
          await allure.severity("normal")
          await allure.step("Validate null allowance", async () => {
            const withNullAllowance = {
              nonce: 1,
              permission: {
                FunctionCall: {
                  allowance: null,
                  receiver_id: "app.near",
                  method_names: [],
                },
              },
            }
            expect(nearAccessKeyResponseSchema.safeParse(withNullAllowance).success).toBe(true)
          })
        })

        it("rejects unknown permission type", async () => {
          await allure.severity("critical")
          await allure.step("Reject unknown permission", async () => {
            const unknownString = { ...validResponse, permission: "Unknown" }
            expect(nearAccessKeyResponseSchema.safeParse(unknownString).success).toBe(false)

            const unknownObject = { ...validResponse, permission: { Unknown: {} } }
            expect(nearAccessKeyResponseSchema.safeParse(unknownObject).success).toBe(false)
          })
        })

        it("rejects malformed FunctionCall", async () => {
          await allure.severity("critical")
          await allure.step("Reject malformed FunctionCall", async () => {
            const missingReceiver = {
              nonce: 1,
              permission: {
                FunctionCall: {
                  allowance: "100",
                  method_names: [],
                },
              },
            }
            expect(nearAccessKeyResponseSchema.safeParse(missingReceiver).success).toBe(false)

            const missingMethods = {
              nonce: 1,
              permission: {
                FunctionCall: {
                  receiver_id: "app.near",
                },
              },
            }
            expect(nearAccessKeyResponseSchema.safeParse(missingMethods).success).toBe(false)
          })
        })

        it("rejects missing nonce", async () => {
          await allure.severity("critical")
          await allure.step("Reject missing nonce", async () => {
            const invalid = { permission: "FullAccess" }
            const result = nearAccessKeyResponseSchema.safeParse(invalid)
            expect(result.success).toBe(false)
          })
        })

        it("rejects missing permission", async () => {
          await allure.severity("critical")
          await allure.step("Reject missing permission", async () => {
            const invalid = { nonce: 1 }
            const result = nearAccessKeyResponseSchema.safeParse(invalid)
            expect(result.success).toBe(false)
          })
        })

        it("rejects non-numeric nonce", async () => {
          await allure.severity("critical")
          await allure.step("Reject string nonce", async () => {
            const invalid = { nonce: "123", permission: "FullAccess" }
            const result = nearAccessKeyResponseSchema.safeParse(invalid)
            expect(result.success).toBe(false)
          })
        })
      })
    })
  })
})
