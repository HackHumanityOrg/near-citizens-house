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
 * Note: Full wallet connection and signing flow is tested in local E2E tests
 * (desktop-qr-verification-flow.spec.ts) which can interact with Meteor wallet.
 * Cloud browsers have limitations with cross-tab wallet communication.
 */

test.describe("Citizens House Web App E2E", () => {
  test("Home page redirects to verification", async ({ page }) => {
    await test.step("Navigate to home page", async () => {
      await page.goto("https://citizenshouse.org/", { waitUntil: "domcontentloaded" })
    })

    await test.step("Redirects to verification page", async () => {
      await expect(page).toHaveURL(/citizenshouse\.org\/verification/)
    })

    await test.step("Verification page loads after redirect", async () => {
      await expect(page.getByTestId("identity-verification-tag")).toBeVisible({ timeout: 15000 })
    })
  })

  test("Verification landing page and wallet selector", async ({ page }) => {
    // =========================================================================
    // Part 1: Landing Page Verification
    // =========================================================================
    await test.step("Navigate to verification page", async () => {
      await page.goto("https://citizenshouse.org/verification", { waitUntil: "domcontentloaded" })
    })

    await test.step("Page loads successfully", async () => {
      await expect(page).toHaveURL(/citizenshouse\.org\/verification/)
    })

    await test.step("Identity verification tag is visible", async () => {
      await expect(page.getByTestId("identity-verification-tag")).toBeVisible({ timeout: 15000 })
    })

    await test.step("Hero heading is visible", async () => {
      await expect(page.getByTestId("verification-hero-heading")).toBeVisible({ timeout: 10000 })
    })

    await test.step("Time estimate is displayed", async () => {
      await expect(page.getByTestId("verification-time-estimate")).toBeVisible({ timeout: 10000 })
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
    // =========================================================================
    // Verify Start Page Loads (without wallet connection)
    // This tests that the /verification/start route is accessible
    // =========================================================================
    await test.step("Verification start page is accessible", async () => {
      await page.goto("https://citizenshouse.org/verification/start", { waitUntil: "domcontentloaded" })
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
    // =========================================================================
    await test.step("Navigate to citizens page", async () => {
      await page.goto("https://citizenshouse.org/citizens", { waitUntil: "domcontentloaded" })
    })

    await test.step("Page loads successfully", async () => {
      await expect(page).toHaveURL(/citizenshouse\.org\/citizens/)
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
