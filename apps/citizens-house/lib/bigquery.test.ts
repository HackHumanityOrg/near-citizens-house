/**
 * Integration tests for BigQuery NEAR account queries
 *
 * These tests query the actual NEAR BigQuery public dataset.
 * They require GCP credentials to run.
 *
 * To run these tests:
 * 1. Set GCP_BIGQUERY_CREDENTIALS env var with service account JSON
 * 2. Or set GOOGLE_APPLICATION_CREDENTIALS to point to credentials file
 * 3. Run: pnpm vitest run lib/bigquery.test.ts
 *
 * Tests are skipped if credentials are not available.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { getAccountCreationDate } from "./bigquery"

// Check if BigQuery credentials are available
const hasCredentials = !!(process.env.GCP_BIGQUERY_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS)

// Skip all tests if no credentials
const describeIfCredentials = hasCredentials ? describe : describe.skip

describeIfCredentials("Near Citizens House", () => {
  describeIfCredentials("BigQuery Integration Tests", () => {
    // Increase timeout for BigQuery queries
    beforeAll(() => {
      // BigQuery queries can take a few seconds
    }, 30000)

    describe("getAccountCreationDate", () => {
      describe("mainnet accounts", () => {
        it("returns genesis_account for 'near' (mainnet genesis account)", async () => {
          const result = await getAccountCreationDate("near")

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe("genesis_account")
            expect(result.accountId).toBe("near")
          }
        }, 30000)

        it("returns genesis_account for 'system' (mainnet genesis account)", async () => {
          const result = await getAccountCreationDate("system")

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe("genesis_account")
          }
        }, 30000)

        it("returns creation date for a known old account", async () => {
          // aurora.near is a well-known account created early in NEAR's history
          const result = await getAccountCreationDate("aurora.near")

          expect(result.success).toBe(true)
          if (result.success) {
            expect(result.accountId).toBe("aurora.near")
            expect(result.createdAt).toBeInstanceOf(Date)
            expect(result.blockHeight).toBeGreaterThan(0)
            // Aurora was created in 2020, should be very old
            const ageInDays = (Date.now() - result.createdAt.getTime()) / (24 * 60 * 60 * 1000)
            expect(ageInDays).toBeGreaterThan(365) // At least 1 year old
          }
        }, 30000)

        it("returns not_found for non-existent account", async () => {
          const result = await getAccountCreationDate("this-account-definitely-does-not-exist-12345.near")

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe("not_found")
          }
        }, 30000)
      })

      describe("account ID handling", () => {
        it("handles sub-accounts correctly", async () => {
          // relay.aurora.near is a sub-account
          const result = await getAccountCreationDate("relay.aurora.near")

          // Should either find the account or return not_found (not crash)
          expect(["not_found", "genesis_account"].includes(result.success ? "" : result.error) || result.success).toBe(
            true,
          )
        }, 30000)

        it("handles implicit accounts (64-char hex)", async () => {
          // Random hex that likely doesn't exist
          const implicitAccount = "0".repeat(64)
          const result = await getAccountCreationDate(implicitAccount)

          // Should return not_found for non-existent implicit account
          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe("not_found")
          }
        }, 30000)

        it("handles eth-implicit accounts (0x-prefixed)", async () => {
          const ethImplicitAccount = `0x${"0".repeat(40)}`
          const result = await getAccountCreationDate(ethImplicitAccount)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe("not_found")
          }
        }, 30000)

        it("handles deterministic accounts (0s-prefixed)", async () => {
          const deterministicAccount = `0s${"0".repeat(40)}`
          const result = await getAccountCreationDate(deterministicAccount)

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error).toBe("not_found")
          }
        }, 30000)
      })
    })
  })
})

// Export a flag for other test files to check
export const BIGQUERY_TESTS_AVAILABLE = hasCredentials
