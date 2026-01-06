/**
 * Tests for account age verification
 *
 * This file contains both unit tests (mocked) and integration tests (real BigQuery).
 * Integration tests require GCP credentials and are skipped if not available.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Check if BigQuery credentials are available for integration tests
const hasCredentials = !!(process.env.GCP_BIGQUERY_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS)

// =============================================================================
// UNIT TESTS (Mocked)
// =============================================================================

// Mock the BigQuery module for unit tests
vi.mock("./bigquery", () => ({
  getAccountCreationDate: vi.fn(),
}))

// Mock the Redis client for unit tests
vi.mock("./redis", () => ({
  getRedisClient: vi.fn(),
}))

// Mock the shared config
vi.mock("@near-citizens/shared", () => ({
  ACCOUNT_AGE_CONFIG: {
    minAccountAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    cacheTimeoutSeconds: 24 * 60 * 60, // 24 hours
  },
}))

import { checkAccountAge } from "./account-age"
import { getAccountCreationDate } from "./bigquery"
import { getRedisClient } from "./redis"

const mockGetAccountCreationDate = vi.mocked(getAccountCreationDate)
const mockGetRedisClient = vi.mocked(getRedisClient)

describe("Near Citizens House", () => {
  describe("Citizens House App Tests", () => {
    describe("Account Age Verification - Unit Tests", () => {
      let mockRedisClient: {
        get: ReturnType<typeof vi.fn>
        set: ReturnType<typeof vi.fn>
      }

      beforeEach(() => {
        vi.clearAllMocks()

        // Setup mock Redis client
        mockRedisClient = {
          get: vi.fn(),
          set: vi.fn(),
        }
        mockGetRedisClient.mockResolvedValue(mockRedisClient as never)
      })

      afterEach(() => {
        vi.resetAllMocks()
      })

      describe("established accounts (allowed)", () => {
        it("allows account created 60 days ago", async () => {
          const now = Date.now()
          const createdAt = now - 60 * 24 * 60 * 60 * 1000 // 60 days ago

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 1000,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("old-account.near")

          expect(result.allowed).toBe(true)
          expect(result.accountAgeDays).toBe(60)
        })

        it("allows account created exactly 30 days ago", async () => {
          const now = Date.now()
          const createdAt = now - 30 * 24 * 60 * 60 * 1000 // exactly 30 days

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 1000,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("boundary.near")

          expect(result.allowed).toBe(true)
          expect(result.accountAgeDays).toBe(30)
        })

        it("allows genesis accounts", async () => {
          const now = Date.now()

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt: null,
              fetchedAt: now - 1000,
              isGenesis: true,
            }),
          )

          const result = await checkAccountAge("genesis.near")

          expect(result.allowed).toBe(true)
          expect(result.reason).toBe("Genesis account")
        })
      })

      describe("new accounts (rejected)", () => {
        it("rejects account created 5 days ago", async () => {
          const now = Date.now()
          const createdAt = now - 5 * 24 * 60 * 60 * 1000 // 5 days ago

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 1000,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("new-account.near")

          expect(result.allowed).toBe(false)
          expect(result.accountAgeDays).toBe(5)
          expect(result.reason).toContain("at least")
        })

        it("rejects account created 29 days ago", async () => {
          const now = Date.now()
          const createdAt = now - 29 * 24 * 60 * 60 * 1000 // 29 days

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 1000,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("almost.near")

          expect(result.allowed).toBe(false)
          expect(result.accountAgeDays).toBe(29)
        })

        it("rejects account created today", async () => {
          const now = Date.now()
          const createdAt = now - 1000 // just created

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 500,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("brand-new.near")

          expect(result.allowed).toBe(false)
          expect(result.accountAgeDays).toBe(0)
        })
      })

      describe("30-day boundary precision", () => {
        // These tests verify the exact 30-day boundary behavior
        // minAccountAgeMs = 30 * 24 * 60 * 60 * 1000 = 2,592,000,000 ms

        it("rejects account created 29 days, 23 hours, 59 minutes, 59 seconds ago", async () => {
          const now = Date.now()
          // 30 days minus 1 second = 29d 23h 59m 59s
          const almostThirtyDaysMs = 30 * 24 * 60 * 60 * 1000 - 1000
          const createdAt = now - almostThirtyDaysMs

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 100,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("almost-30.near")

          expect(result.allowed).toBe(false)
          // Should be 29 days (floor of 29.999...)
          expect(result.accountAgeDays).toBe(29)
        })

        it("allows account created exactly 30 days ago (to the millisecond)", async () => {
          const now = Date.now()
          const exactlyThirtyDaysMs = 30 * 24 * 60 * 60 * 1000
          const createdAt = now - exactlyThirtyDaysMs

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 100,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("exactly-30.near")

          expect(result.allowed).toBe(true)
          expect(result.accountAgeDays).toBe(30)
        })

        it("allows account created 30 days and 1 second ago", async () => {
          const now = Date.now()
          const thirtyDaysPlusOneSecondMs = 30 * 24 * 60 * 60 * 1000 + 1000
          const createdAt = now - thirtyDaysPlusOneSecondMs

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 100,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("just-over-30.near")

          expect(result.allowed).toBe(true)
          expect(result.accountAgeDays).toBe(30)
        })

        it("allows account created 31 days ago", async () => {
          const now = Date.now()
          const createdAt = now - 31 * 24 * 60 * 60 * 1000

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 100,
              isGenesis: false,
            }),
          )

          const result = await checkAccountAge("over-30.near")

          expect(result.allowed).toBe(true)
          expect(result.accountAgeDays).toBe(31)
        })
      })

      describe("cache behavior", () => {
        it("uses cached data when available", async () => {
          const now = Date.now()
          const createdAt = now - 60 * 24 * 60 * 60 * 1000

          mockRedisClient.get.mockResolvedValue(
            JSON.stringify({
              createdAt,
              fetchedAt: now - 1000,
              isGenesis: false,
            }),
          )

          await checkAccountAge("cached-account.near")

          expect(mockRedisClient.get).toHaveBeenCalledWith("account-creation:cached-account.near")
          expect(mockGetAccountCreationDate).not.toHaveBeenCalled()
        })

        it("fetches from BigQuery on cache miss and caches result", async () => {
          const now = Date.now()
          const createdAt = new Date(now - 45 * 24 * 60 * 60 * 1000)

          mockRedisClient.get.mockResolvedValue(null)
          mockGetAccountCreationDate.mockResolvedValue({
            success: true,
            accountId: "uncached.near",
            createdAt,
            blockDate: "2024-01-01",
            blockHeight: 12345678,
          })

          const result = await checkAccountAge("uncached.near")

          expect(result.allowed).toBe(true)
          expect(mockGetAccountCreationDate).toHaveBeenCalledWith("uncached.near")
          expect(mockRedisClient.set).toHaveBeenCalled()
        })
      })

      describe("error handling", () => {
        it("rejects when BigQuery query fails", async () => {
          mockRedisClient.get.mockResolvedValue(null)
          mockGetAccountCreationDate.mockResolvedValue({
            success: false,
            accountId: "test.near",
            error: "query_error",
            message: "BigQuery connection failed",
          })

          const result = await checkAccountAge("test.near")

          expect(result.allowed).toBe(false)
          expect(result.reason).toBe("Unable to verify account age")
        })

        it("rejects when account not found", async () => {
          mockRedisClient.get.mockResolvedValue(null)
          mockGetAccountCreationDate.mockResolvedValue({
            success: false,
            accountId: "nonexistent.near",
            error: "not_found",
            message: "Account not found",
          })

          const result = await checkAccountAge("nonexistent.near")

          expect(result.allowed).toBe(false)
          expect(result.reason).toBe("Account not found")
        })

        it("allows genesis accounts from BigQuery", async () => {
          mockRedisClient.get.mockResolvedValue(null)
          mockGetAccountCreationDate.mockResolvedValue({
            success: false,
            accountId: "near",
            error: "genesis_account",
            message: "Account is a genesis account",
          })

          const result = await checkAccountAge("near")

          expect(result.allowed).toBe(true)
          expect(result.reason).toBe("Genesis account")
        })
      })
    })
  })
})

// =============================================================================
// INTEGRATION TESTS (Real BigQuery)
// =============================================================================
// These tests are skipped if GCP credentials are not available

const describeIntegration = hasCredentials ? describe : describe.skip

describeIntegration("Near Citizens House", () => {
  describeIntegration("Account Age Verification - Integration Tests", () => {
    // Note: These tests use real BigQuery queries and may incur costs
    // They also require a real Redis connection, so we'll skip them for now
    // and only test the BigQuery queries directly in bigquery.test.ts

    it("integration tests require credentials - see bigquery.test.ts", () => {
      expect(hasCredentials).toBe(true)
    })
  })
})

// Export credential check for other tests
export const HAS_BIGQUERY_CREDENTIALS = hasCredentials
