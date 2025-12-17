/**
 * Unit tests for near-account.ts
 *
 * Tests NEAR account ID validation per NEAR Protocol specification:
 * - https://nomicon.io/DataStructures/Account
 * - https://docs.near.org/protocol/account-id
 *
 * Covers: nearAccountIdSchema, nearNamedAccountSchema, nearImplicitAccountSchema,
 *         ethImplicitAccountSchema, isValidNearAccountId, getNearAccountType
 */
import { describe, it, expect } from "vitest"
import * as allure from "allure-js-commons"
import {
  nearAccountIdSchema,
  nearNamedAccountSchema,
  nearImplicitAccountSchema,
  ethImplicitAccountSchema,
  isValidNearAccountId,
  getNearAccountType,
} from "../validation/near-account"

// Use nested describes to create Allure suite hierarchy:
// parentSuite > suite > subSuite (matching Rust pattern)
describe("Near Citizens House", () => {
  describe("Shared Library Unit Tests", () => {
    describe("NEAR Account Validation", () => {
      // ============================================================================
      // Named Account Tests
      // ============================================================================

      describe("nearNamedAccountSchema", () => {
        describe("valid named accounts", () => {
          it("accepts minimum length (2 chars)", async () => {
            await allure.severity("normal")
            await allure.step("Validate 2-char account", async () => {
              expect(nearNamedAccountSchema.safeParse("ab").success).toBe(true)
            })
          })

          it("accepts maximum length (64 chars)", async () => {
            await allure.severity("normal")
            await allure.step("Validate 64-char account", async () => {
              const maxAccount = "a".repeat(64)
              expect(nearNamedAccountSchema.safeParse(maxAccount).success).toBe(true)
            })
          })

          it("accepts standard named accounts", async () => {
            await allure.severity("normal")
            await allure.step("Validate standard accounts", async () => {
              const validAccounts = [
                "alice.near",
                "bob.testnet",
                "test_account.near",
                "my-app.near",
                "sub.account.near",
                "a1b2c3.testnet",
              ]
              for (const account of validAccounts) {
                expect(nearNamedAccountSchema.safeParse(account).success).toBe(true)
              }
            })
          })

          it("accepts accounts with underscores and hyphens", async () => {
            await allure.severity("normal")
            await allure.step("Validate separator usage", async () => {
              expect(nearNamedAccountSchema.safeParse("my_account.near").success).toBe(true)
              expect(nearNamedAccountSchema.safeParse("my-account.near").success).toBe(true)
              expect(nearNamedAccountSchema.safeParse("my_test-account.near").success).toBe(true)
            })
          })

          it("accepts deeply nested subaccounts", async () => {
            await allure.severity("normal")
            await allure.step("Validate nested accounts", async () => {
              expect(nearNamedAccountSchema.safeParse("a.b.c.near").success).toBe(true)
            })
          })

          it("accepts numeric-only accounts", async () => {
            await allure.severity("normal")
            await allure.step("Validate numeric accounts", async () => {
              expect(nearNamedAccountSchema.safeParse("100").success).toBe(true)
              expect(nearNamedAccountSchema.safeParse("12").success).toBe(true)
              expect(nearNamedAccountSchema.safeParse("99").success).toBe(true)
            })
          })

          it("accepts all valid examples from NEAR spec", async () => {
            await allure.severity("normal")
            await allure.step("Validate spec examples", async () => {
              const specExamples = [
                "ok",
                "bowen",
                "ek-2",
                "ek.near",
                "com",
                "google.com",
                "bowen.google.com",
                "near",
                "illia.cheap-accounts.near",
                "max_99.near",
                "100",
                "near2019",
                "over.9000",
                "a.bro",
              ]
              for (const account of specExamples) {
                expect(nearNamedAccountSchema.safeParse(account).success).toBe(true)
              }
            })
          })
        })

        describe("invalid named accounts", () => {
          it("rejects accounts shorter than 2 chars", async () => {
            await allure.severity("critical")
            await allure.step("Reject 1-char account", async () => {
              const result = nearNamedAccountSchema.safeParse("a")
              expect(result.success).toBe(false)
            })
          })

          it("rejects accounts longer than 64 chars", async () => {
            await allure.severity("critical")
            await allure.step("Reject 65-char account", async () => {
              const longAccount = "a".repeat(65)
              const result = nearNamedAccountSchema.safeParse(longAccount)
              expect(result.success).toBe(false)
            })
          })

          it("rejects uppercase letters", async () => {
            await allure.severity("critical")
            await allure.step("Reject uppercase", async () => {
              expect(nearNamedAccountSchema.safeParse("Alice.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("ALICE.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice.NEAR").success).toBe(false)
            })
          })

          it("rejects consecutive separators", async () => {
            await allure.severity("critical")
            await allure.step("Reject consecutive separators", async () => {
              expect(nearNamedAccountSchema.safeParse("alice..near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice--test.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice__test.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice.-test.near").success).toBe(false)
            })
          })

          it("rejects accounts starting with separator", async () => {
            await allure.severity("critical")
            await allure.step("Reject leading separator", async () => {
              expect(nearNamedAccountSchema.safeParse(".alice.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("-alice.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("_alice.near").success).toBe(false)
            })
          })

          it("rejects accounts ending with separator", async () => {
            await allure.severity("critical")
            await allure.step("Reject trailing separator", async () => {
              expect(nearNamedAccountSchema.safeParse("alice.near.").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice.near-").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice.near_").success).toBe(false)
            })
          })

          it("rejects invalid characters", async () => {
            await allure.severity("critical")
            await allure.step("Reject invalid chars", async () => {
              expect(nearNamedAccountSchema.safeParse("alice@near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice#near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice near").success).toBe(false)
            })
          })

          it("rejects all invalid examples from NEAR spec", async () => {
            await allure.severity("critical")
            await allure.step("Reject spec invalid examples", async () => {
              const specInvalid = [
                "a", // too short
                "100-", // suffix separator
                "bo__wen", // consecutive separators
                "_illia", // prefix separator
                ".near", // prefix dot
                "near.", // suffix dot
                "a..near", // two dots in a row
                "$$$", // invalid chars
                "WAT", // uppercase
                "me@google.com", // invalid char @
              ]
              for (const account of specInvalid) {
                expect(nearNamedAccountSchema.safeParse(account).success).toBe(false)
              }
            })
          })

          it("rejects separators at subaccount part boundaries", async () => {
            await allure.severity("critical")
            await allure.step("Reject part boundary separators", async () => {
              expect(nearNamedAccountSchema.safeParse("alice.-bob.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice.bob-.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice._bob.near").success).toBe(false)
              expect(nearNamedAccountSchema.safeParse("alice.bob_.near").success).toBe(false)
            })
          })
        })
      })

      // ============================================================================
      // Implicit Account Tests (ED25519)
      // ============================================================================

      describe("nearImplicitAccountSchema", () => {
        const validImplicit = "0".repeat(64)
        const validImplicitMixed = "0123456789abcdef".repeat(4)

        describe("valid implicit accounts", () => {
          it("accepts 64 lowercase hex chars", async () => {
            await allure.severity("normal")
            await allure.step("Validate 64 hex", async () => {
              expect(nearImplicitAccountSchema.safeParse(validImplicit).success).toBe(true)
              expect(nearImplicitAccountSchema.safeParse(validImplicitMixed).success).toBe(true)
            })
          })
        })

        describe("invalid implicit accounts", () => {
          it("rejects uppercase hex", async () => {
            await allure.severity("critical")
            await allure.step("Reject uppercase", async () => {
              const upperHex = "0".repeat(32) + "A".repeat(32)
              expect(nearImplicitAccountSchema.safeParse(upperHex).success).toBe(false)
            })
          })

          it("rejects wrong length", async () => {
            await allure.severity("critical")
            await allure.step("Reject wrong length", async () => {
              expect(nearImplicitAccountSchema.safeParse("0".repeat(63)).success).toBe(false)
              expect(nearImplicitAccountSchema.safeParse("0".repeat(65)).success).toBe(false)
            })
          })

          it("rejects non-hex characters", async () => {
            await allure.severity("critical")
            await allure.step("Reject non-hex", async () => {
              const withG = "0".repeat(63) + "g"
              expect(nearImplicitAccountSchema.safeParse(withG).success).toBe(false)
            })
          })
        })
      })

      // ============================================================================
      // ETH-Implicit Account Tests
      // ============================================================================

      describe("ethImplicitAccountSchema", () => {
        const validEthImplicit = "0x" + "0".repeat(40)
        const validEthImplicitMixed = "0x" + "0123456789abcdef".repeat(2) + "abcdef01"

        describe("valid ETH-implicit accounts", () => {
          it("accepts 0x + 40 lowercase hex chars", async () => {
            await allure.severity("normal")
            await allure.step("Validate ETH format", async () => {
              expect(ethImplicitAccountSchema.safeParse(validEthImplicit).success).toBe(true)
              expect(ethImplicitAccountSchema.safeParse(validEthImplicitMixed).success).toBe(true)
            })
          })
        })

        describe("invalid ETH-implicit accounts", () => {
          it("rejects uppercase hex", async () => {
            await allure.severity("critical")
            await allure.step("Reject uppercase", async () => {
              const upperEth = "0x" + "A".repeat(40)
              expect(ethImplicitAccountSchema.safeParse(upperEth).success).toBe(false)
            })
          })

          it("rejects missing 0x prefix", async () => {
            await allure.severity("critical")
            await allure.step("Reject no prefix", async () => {
              expect(ethImplicitAccountSchema.safeParse("0".repeat(40)).success).toBe(false)
            })
          })

          it("rejects wrong length", async () => {
            await allure.severity("critical")
            await allure.step("Reject wrong length", async () => {
              expect(ethImplicitAccountSchema.safeParse("0x" + "0".repeat(39)).success).toBe(false)
              expect(ethImplicitAccountSchema.safeParse("0x" + "0".repeat(41)).success).toBe(false)
            })
          })

          it("rejects uppercase 0X prefix", async () => {
            await allure.severity("critical")
            await allure.step("Reject 0X prefix", async () => {
              const upperPrefix = "0X" + "0".repeat(40)
              expect(ethImplicitAccountSchema.safeParse(upperPrefix).success).toBe(false)
            })
          })
        })
      })

      // ============================================================================
      // Unified Schema Tests (nearAccountIdSchema)
      // ============================================================================

      describe("nearAccountIdSchema", () => {
        it("accepts named accounts", async () => {
          await allure.severity("normal")
          await allure.step("Named accounts work", async () => {
            expect(nearAccountIdSchema.safeParse("alice.near").success).toBe(true)
          })
        })

        it("accepts implicit accounts", async () => {
          await allure.severity("normal")
          await allure.step("Implicit accounts work", async () => {
            expect(nearAccountIdSchema.safeParse("0".repeat(64)).success).toBe(true)
          })
        })

        it("accepts ETH-implicit accounts", async () => {
          await allure.severity("normal")
          await allure.step("ETH-implicit accounts work", async () => {
            expect(nearAccountIdSchema.safeParse("0x" + "0".repeat(40)).success).toBe(true)
          })
        })

        it("rejects empty string", async () => {
          await allure.severity("critical")
          await allure.step("Empty rejected", async () => {
            expect(nearAccountIdSchema.safeParse("").success).toBe(false)
          })
        })

        it("rejects whitespace", async () => {
          await allure.severity("critical")
          await allure.step("Whitespace rejected", async () => {
            expect(nearAccountIdSchema.safeParse(" alice.near ").success).toBe(false)
            expect(nearAccountIdSchema.safeParse("alice .near").success).toBe(false)
          })
        })
      })

      // ============================================================================
      // Helper Function Tests
      // ============================================================================

      describe("isValidNearAccountId", () => {
        it("returns true for valid accounts", async () => {
          await allure.severity("normal")
          await allure.step("Valid accounts", async () => {
            expect(isValidNearAccountId("alice.near")).toBe(true)
            expect(isValidNearAccountId("0".repeat(64))).toBe(true)
            expect(isValidNearAccountId("0x" + "0".repeat(40))).toBe(true)
          })
        })

        it("returns false for invalid accounts", async () => {
          await allure.severity("critical")
          await allure.step("Invalid accounts", async () => {
            expect(isValidNearAccountId("")).toBe(false)
            expect(isValidNearAccountId("a")).toBe(false)
            expect(isValidNearAccountId("ALICE.near")).toBe(false)
          })
        })
      })

      describe("getNearAccountType", () => {
        it("identifies named accounts", async () => {
          await allure.severity("normal")
          await allure.step("Named type", async () => {
            expect(getNearAccountType("alice.near")).toBe("named")
            expect(getNearAccountType("bob.testnet")).toBe("named")
          })
        })

        it("identifies implicit accounts", async () => {
          await allure.severity("normal")
          await allure.step("Implicit type", async () => {
            expect(getNearAccountType("0".repeat(64))).toBe("implicit")
          })
        })

        it("identifies ETH-implicit accounts", async () => {
          await allure.severity("normal")
          await allure.step("ETH-implicit type", async () => {
            expect(getNearAccountType("0x" + "0".repeat(40))).toBe("eth-implicit")
          })
        })

        it("returns null for invalid accounts", async () => {
          await allure.severity("normal")
          await allure.step("Invalid returns null", async () => {
            expect(getNearAccountType("")).toBeNull()
            expect(getNearAccountType("ALICE.near")).toBeNull()
          })
        })
      })
    })
  })
})
