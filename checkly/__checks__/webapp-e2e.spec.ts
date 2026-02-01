import { test, expect } from "@playwright/test"

/**
 * Citizens House Web App E2E Tests for Checkly
 *
 * This test suite verifies the web application is functional across all routes:
 * 1. Home page (/) - redirects to /verification
 * 2. Verification landing (/verification) - all key UI elements visible
 * 3. Verification start (/verification/start) - flow step page
 * 4. Citizens page (/citizens) - verification records table
 *
 * Maintenance Mode Handling:
 * - Maintenance mode is controlled via Vercel Edge Config (per-deployment)
 * - When enabled, non-exempt routes are REWRITTEN to /maintenance (URL stays same)
 * - Exempt routes: /privacy, /terms, /maintenance, /_next/*, /api/*, /ingest/*
 * - Tests pass with logged message when maintenance mode is detected (degraded)
 * - Tests fail when elements are missing during normal operation
 *
 * URL Configuration:
 * - Uses ENVIRONMENT_URL env var when provided (for Vercel preview deployments)
 * - Falls back to production URL (https://citizenshouse.org) for scheduled checks
 */

// Base URL from environment (Vercel integration) or default to production
const BASE_URL = process.env.ENVIRONMENT_URL || "https://citizenshouse.org"

/**
 * Check if the page is showing maintenance mode.
 * Maintenance mode is detected by the presence of the maintenance-message testid.
 * Note: URL stays the same during maintenance (it's a rewrite, not redirect).
 */
async function isMaintenanceMode(page: import("@playwright/test").Page): Promise<boolean> {
  const maintenanceMessage = page.getByTestId("maintenance-message")
  return maintenanceMessage.isVisible({ timeout: 3000 }).catch(() => false)
}

test.describe("Citizens House Web App E2E", () => {
  test("Home page loads verification flow", async ({ page }) => {
    await test.step("Navigate to home page", async () => {
      await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" })
    })

    // Check for maintenance mode first
    const inMaintenance = await isMaintenanceMode(page)
    if (inMaintenance) {
      console.log("[MAINTENANCE MODE] Site is in maintenance mode - test passes with degraded status")
      // Verify maintenance page structure
      await expect(page.getByTestId("maintenance-message")).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId("identity-verification-tag")).toBeVisible({ timeout: 10000 })
      return // Pass the test - maintenance mode is expected
    }

    // Normal operation - should redirect to /verification
    await test.step("Redirects to verification page", async () => {
      await expect(page).toHaveURL(/\/verification/)
    })

    await test.step("Verification page loads after redirect", async () => {
      await expect(page.getByTestId("identity-verification-tag")).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId("connect-wallet-button-desktop")).toBeVisible({ timeout: 10000 })
    })
  })

  test("Verification landing page and wallet selector", async ({ page }) => {
    await test.step("Navigate to verification page", async () => {
      await page.goto(`${BASE_URL}/verification`, { waitUntil: "domcontentloaded" })
    })

    // Check for maintenance mode first (URL stays /verification but content is maintenance)
    const inMaintenance = await isMaintenanceMode(page)
    if (inMaintenance) {
      console.log("[MAINTENANCE MODE] Site is in maintenance mode - test passes with degraded status")
      // Verify maintenance page structure
      await expect(page.getByTestId("maintenance-message")).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId("identity-verification-tag")).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId("verification-hero-heading")).toBeVisible({ timeout: 10000 })
      return // Pass the test - maintenance mode is expected
    }

    // =========================================================================
    // Normal operation - full verification
    // =========================================================================
    await test.step("Page loads successfully", async () => {
      await expect(page).toHaveURL(/\/verification/)
    })

    await test.step("Identity verification tag is visible", async () => {
      await expect(page.getByTestId("identity-verification-tag")).toBeVisible({ timeout: 15000 })
    })

    await test.step("Hero heading is visible", async () => {
      await expect(page.getByTestId("verification-hero-heading")).toBeVisible({ timeout: 10000 })
    })

    await test.step("Step 1 (Connect wallet) heading is visible", async () => {
      await expect(page.getByTestId("step1-heading-desktop")).toBeVisible({ timeout: 10000 })
    })

    await test.step("Step 2 heading is visible", async () => {
      await expect(page.getByTestId("step2-heading-desktop")).toBeVisible({ timeout: 10000 })
    })

    await test.step("Connect wallet button is visible and clickable", async () => {
      await expect(page.getByTestId("connect-wallet-button-desktop")).toBeVisible({ timeout: 10000 })
    })

    // =========================================================================
    // Part 2: Wallet Selector Modal
    // =========================================================================
    await test.step("Click connect wallet button", async () => {
      await page.getByTestId("connect-wallet-button-desktop").click()
    })

    await test.step("Wallet selector modal appears", async () => {
      // Dynamic wallet SDK shows a modal with "Select a wallet" text
      await expect(page.getByText(/select.*wallet/i)).toBeVisible({ timeout: 15000 })
    })

    await test.step("Meteor Wallet option is available", async () => {
      await expect(page.getByText("Meteor Wallet")).toBeVisible({ timeout: 10000 })
    })
  })

  test("Verification start page", async ({ page }) => {
    await test.step("Navigate to verification start page", async () => {
      await page.goto(`${BASE_URL}/verification/start`, { waitUntil: "domcontentloaded" })
    })

    // Check for maintenance mode (URL stays /verification/start but content is maintenance)
    const inMaintenance = await isMaintenanceMode(page)
    if (inMaintenance) {
      console.log("[MAINTENANCE MODE] Site is in maintenance mode - test passes with degraded status")
      await expect(page.getByTestId("maintenance-message")).toBeVisible({ timeout: 10000 })
      return // Pass the test - maintenance mode is expected
    }

    // =========================================================================
    // Normal operation - full verification
    // =========================================================================
    await test.step("Verification start page is accessible", async () => {
      await expect(page).toHaveURL(/\/verification\/start/)
    })

    await test.step("Start page shows connect wallet state", async () => {
      // Without wallet connected, should show the connect button
      await expect(page.getByTestId("connect-near-wallet-button")).toBeVisible({ timeout: 10000 })
    })

    await test.step("Step indicators are visible on start page", async () => {
      await expect(page.getByTestId("step-indicator-1")).toBeVisible({ timeout: 10000 })
      await expect(page.getByTestId("step-indicator-2")).toBeVisible({ timeout: 10000 })
    })
  })

  test("Citizens page with verification records", async ({ page }) => {
    // =========================================================================
    // Citizens Page - Public verification records
    // Note: This page IS affected by maintenance mode (not in exempt list)
    // =========================================================================
    await test.step("Navigate to citizens page", async () => {
      await page.goto(`${BASE_URL}/citizens`, { waitUntil: "domcontentloaded" })
    })

    // Check for maintenance mode (URL stays /citizens but content is maintenance)
    const inMaintenance = await isMaintenanceMode(page)
    if (inMaintenance) {
      console.log("[MAINTENANCE MODE] Site is in maintenance mode - test passes with degraded status")
      await expect(page.getByTestId("maintenance-message")).toBeVisible({ timeout: 10000 })
      return // Pass the test - maintenance mode is expected
    }

    // =========================================================================
    // Normal operation - full verification
    // =========================================================================
    await test.step("Page loads successfully", async () => {
      await expect(page).toHaveURL(/\/citizens/)
    })

    await test.step("Citizens page title is visible", async () => {
      await expect(page.getByRole("heading", { name: "Citizens", level: 1 })).toBeVisible({ timeout: 15000 })
    })

    await test.step("Verification Records header is visible", async () => {
      await expect(page.getByRole("heading", { name: "Verification Records" })).toBeVisible({ timeout: 10000 })
    })

    await test.step("Table or empty state is displayed", async () => {
      // Either the table with accounts is shown, or the empty state message
      const tableHeader = page.getByText(/Showing \d+ of \d+ NEAR Verified Accounts|No verified accounts yet/)
      await expect(tableHeader).toBeVisible({ timeout: 10000 })
    })

    await test.step("View contract link is visible", async () => {
      await expect(page.getByRole("link", { name: "View contract" })).toBeVisible({ timeout: 10000 })
    })
  })
})
