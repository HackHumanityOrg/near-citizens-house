/**
 * Unit tests for external boundary validation schemas
 *
 * Tests runtime validation schemas for external SDK and RPC boundaries:
 * - Self.xyz SDK response validation (selfVerificationResultSchema)
 * - NEAR RPC response validation (nearAccessKeyResponseSchema)
 */
import { describe, it, expect } from "vitest"
import * as allure from "allure-js-commons"
import { selfVerificationResultSchema } from "../schemas/selfxyz"
import { nearAccessKeyResponseSchema } from "../schemas/near"

describe("Near Citizens House", () => {
  describe("Shared Library Unit Tests", () => {
    describe("External Boundary Validation", () => {
      // ============================================================================
      // Self.xyz SDK Response Validation
      // ============================================================================

      describe("selfVerificationResultSchema", () => {
        const validResult = {
          attestationId: 1,
          isValidDetails: { isValid: true },
          forbiddenCountriesList: [],
          discloseOutput: { nullifier: "12345" },
          userData: {
            userIdentifier: "session-123",
            userDefinedData: '{"accountId":"alice.near"}',
          },
        }

        it("accepts valid SDK response", async () => {
          await allure.severity("critical")
          await allure.step("Validate complete response", async () => {
            const result = selfVerificationResultSchema.safeParse(validResult)
            expect(result.success).toBe(true)
          })
        })

        it("accepts response with all isValidDetails fields", async () => {
          await allure.severity("normal")
          await allure.step("Validate complete isValidDetails", async () => {
            const withAllDetails = {
              ...validResult,
              isValidDetails: {
                isValid: true,
                isMinimumAgeValid: true,
                isOfacValid: true,
              },
            }
            expect(selfVerificationResultSchema.safeParse(withAllDetails).success).toBe(true)
          })
        })

        it("accepts response without forbiddenCountriesList (defaults to empty)", async () => {
          await allure.severity("normal")
          await allure.step("Validate default forbidden list", async () => {
            const withoutList = { ...validResult }
            delete (withoutList as Record<string, unknown>).forbiddenCountriesList
            const result = selfVerificationResultSchema.safeParse(withoutList)
            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data.forbiddenCountriesList).toEqual([])
            }
          })
        })

        it("accepts disclose output with extra fields (passthrough)", async () => {
          await allure.severity("normal")
          await allure.step("Validate passthrough", async () => {
            const withExtra = {
              ...validResult,
              discloseOutput: {
                nullifier: "12345",
                nationality: "USA",
                minimumAge: "18",
                gender: "M",
                unknownField: "value",
              },
            }
            const result = selfVerificationResultSchema.safeParse(withExtra)
            expect(result.success).toBe(true)
            if (result.success) {
              expect(result.data.discloseOutput.unknownField).toBe("value")
            }
          })
        })

        it("accepts array userDefinedData (byte array)", async () => {
          await allure.severity("normal")
          await allure.step("Validate array format", async () => {
            const withArray = {
              ...validResult,
              userData: {
                userIdentifier: "session-123",
                userDefinedData: [123, 34, 97, 34, 125],
              },
            }
            expect(selfVerificationResultSchema.safeParse(withArray).success).toBe(true)
          })
        })

        it("accepts record userDefinedData (indexed object)", async () => {
          await allure.severity("normal")
          await allure.step("Validate record format", async () => {
            const withRecord = {
              ...validResult,
              userData: {
                userIdentifier: "session-123",
                userDefinedData: { "0": 123, "1": 34, "2": 125 },
              },
            }
            expect(selfVerificationResultSchema.safeParse(withRecord).success).toBe(true)
          })
        })

        it("accepts all valid attestation IDs (1, 2, 3)", async () => {
          await allure.severity("normal")
          await allure.step("Validate attestation IDs", async () => {
            for (const id of [1, 2, 3]) {
              const data = { ...validResult, attestationId: id }
              expect(selfVerificationResultSchema.safeParse(data).success).toBe(true)
            }
          })
        })

        it("rejects invalid attestation ID", async () => {
          await allure.severity("critical")
          await allure.step("Reject invalid attestation ID", async () => {
            const invalid = { ...validResult, attestationId: 4 }
            const result = selfVerificationResultSchema.safeParse(invalid)
            expect(result.success).toBe(false)
          })
        })

        it("rejects missing required fields", async () => {
          await allure.severity("critical")
          await allure.step("Reject incomplete response", async () => {
            const missingDetails = { ...validResult }
            delete (missingDetails as Record<string, unknown>).isValidDetails
            expect(selfVerificationResultSchema.safeParse(missingDetails).success).toBe(false)

            const missingOutput = { ...validResult }
            delete (missingOutput as Record<string, unknown>).discloseOutput
            expect(selfVerificationResultSchema.safeParse(missingOutput).success).toBe(false)

            const missingUserData = { ...validResult }
            delete (missingUserData as Record<string, unknown>).userData
            expect(selfVerificationResultSchema.safeParse(missingUserData).success).toBe(false)
          })
        })

        it("rejects malformed isValidDetails", async () => {
          await allure.severity("critical")
          await allure.step("Reject wrong isValid type", async () => {
            const badDetails = { ...validResult, isValidDetails: { isValid: "yes" } }
            expect(selfVerificationResultSchema.safeParse(badDetails).success).toBe(false)

            const missingIsValid = { ...validResult, isValidDetails: { isMinimumAgeValid: true } }
            expect(selfVerificationResultSchema.safeParse(missingIsValid).success).toBe(false)
          })
        })

        it("rejects empty or missing nullifier", async () => {
          await allure.severity("critical")
          await allure.step("Reject bad nullifier", async () => {
            const emptyNullifier = {
              ...validResult,
              discloseOutput: { nullifier: "" },
            }
            expect(selfVerificationResultSchema.safeParse(emptyNullifier).success).toBe(false)

            const missingNullifier = {
              ...validResult,
              discloseOutput: { nationality: "USA" },
            }
            expect(selfVerificationResultSchema.safeParse(missingNullifier).success).toBe(false)
          })
        })

        it("rejects missing userIdentifier", async () => {
          await allure.severity("critical")
          await allure.step("Reject missing userIdentifier", async () => {
            const missingId = {
              ...validResult,
              userData: { userDefinedData: "data" },
            }
            expect(selfVerificationResultSchema.safeParse(missingId).success).toBe(false)
          })
        })
      })

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
