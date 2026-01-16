/* eslint-disable no-empty-pattern */
import { test, expect } from "../fixtures/dynamic-wallet.fixture"
import { getAttestationTypeName } from "@near-citizens/shared"
import { createVerificationRequest } from "../helpers/near-signing"
import { setupSelfWebSocketMock } from "../helpers/self-websocket-mock"

/**
 * Complete End-to-End Verification Flow
 *
 * This test creates a real NEAR subaccount, connects it via the actual
 * Meteor wallet UI, and verifies the complete user flow through to
 * contract storage:
 *
 * Phase 1 - Wallet Connection:
 * 1. Visit homepage (/) -> auto-redirect to /verification
 * 2. Click connect wallet on landing page
 * 3. Complete Meteor wallet connection (import account, approve connection)
 * 4. Verify redirect to /verification/start with wallet connected
 * 5. Sign verification message
 * 6. Verify QR scan screen (Step 2)
 *
 * Phase 2 - API Verification (when SKIP_ZK_VERIFICATION=true):
 * 7. Send verification request to API with real NEAR signature
 * 8. Verify API returns success
 *
 * Phase 3 - Contract Storage Verification:
 * 9. Verify contract storage via status endpoint
 *
 * Phase 4 - Success Screen:
 * 10. Navigate to success state and verify Step 3 renders
 *
 * Requirements:
 * - Doppler env vars: NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY
 * - Network configured via NEXT_PUBLIC_NEAR_NETWORK (defaults to testnet)
 * - For full flow: SKIP_ZK_VERIFICATION=true (to mock Self.xyz ZK verification)
 */
async function assertVerificationInCitizensList(
  page: import("@playwright/test").Page,
  accountId: string,
  attestationLabel: string,
) {
  await page.goto("/citizens")

  for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
    const accountLink = page.getByRole("link", { name: accountId })
    if (
      await accountLink
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      const row = accountLink.first().locator('xpath=ancestor::div[contains(@class,"px-[16px]")][1]')
      await expect(row).toContainText(accountId)
      await expect(row).toContainText(attestationLabel)
      return
    }

    const nextLink = page.getByRole("link", { name: /^Next$/ })
    if (await nextLink.isVisible().catch(() => false)) {
      await nextLink.click()
      await page.waitForURL(/\/citizens\?page=/)
      continue
    }

    break
  }

  throw new Error(`Account ${accountId} not found in citizens list`)
}

test.describe("Complete Verification E2E Flow", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!process.env.NEAR_ACCOUNT_ID || !process.env.NEAR_PRIVATE_KEY) {
      testInfo.skip()
    }
  })

  test("complete flow: wallet connect -> sign -> verify API -> contract storage -> success", async ({
    page,
    context,
    testAccount,
    connectWithMeteor,
    signWithMeteor,
  }) => {
    // =========================================================================
    // Setup: Mock the Self.xyz WebSocket BEFORE page loads (if running full flow)
    // =========================================================================
    let triggerWebSocketSuccess: (() => void) | null = null

    if (process.env.SKIP_ZK_VERIFICATION === "true") {
      const { triggerSuccess } = await setupSelfWebSocketMock(page, { successDelay: 500 })
      triggerWebSocketSuccess = triggerSuccess
    }

    // Step 1: Visit homepage and verify redirect to /verification
    await page.goto("/")
    await page.waitForURL("**/verification**", { timeout: 10000 })
    expect(page.url()).toContain("/verification")

    // Step 2: Verify landing page elements
    await expect(page.getByTestId("identity-verification-tag")).toBeVisible()
    await expect(page.getByTestId("verification-hero-heading")).toBeVisible()
    await expect(page.getByTestId("verification-time-estimate")).toBeVisible()
    await expect(page.getByTestId("step1-heading-desktop")).toBeVisible()
    await expect(page.getByTestId("step2-heading-desktop")).toBeVisible()
    await expect(page.getByTestId("connect-wallet-button-desktop")).toBeVisible()

    // Step 3: Connect wallet via Meteor (full flow)
    await connectWithMeteor(page, context, testAccount)

    // Step 4: Verify redirected to /verification/start
    expect(page.url()).toContain("/verification/start")

    // Step 5: Verify connected state on start page (parallel assertions for speed)
    await Promise.all([
      expect(page.getByTestId("step-indicator-1")).toBeVisible(),
      expect(page.getByTestId("step-indicator-2")).toBeVisible(),
      expect(page.getByTestId("step1-card-title")).toHaveText("Sign Verification Message"),
      expect(page.getByTestId("step-indicator-1")).toHaveAttribute("data-step-state", "active"),
      expect(page.getByTestId("step-indicator-2")).toHaveAttribute("data-step-state", "inactive"),
      expect(page.getByTestId("step-label-1")).toHaveText("Verify NEAR Wallet"),
      expect(page.getByTestId("step-label-2")).toHaveText("Verify Identity"),
      expect(page.getByTestId("connected-wallet-display")).toBeVisible(),
      expect(page.getByTestId("connected-wallet-address")).toContainText(testAccount.accountId.split(".")[0]),
      expect(page.getByTestId("sign-message-button")).toBeVisible(),
      expect(page.getByTestId("sign-message-button")).toBeEnabled(),
      expect(page.getByTestId("disconnect-wallet-button")).toBeVisible(),
    ])

    // Step 6: Sign message via Meteor (fixture verifies toast appears)
    await signWithMeteor(page, context)

    // Step 7: Verify Step 2 UI (QR scan screen) and stepper state
    await expect(page.getByTestId("step2-section")).toBeVisible()

    // Verify stepper state: Step 1 completed (checkmark), Step 2 active
    await expect(page.getByTestId("step2-indicator-completed")).toHaveAttribute("data-step-state", "completed")
    await expect(page.getByTestId("step2-indicator-active")).toHaveAttribute("data-step-state", "active")

    // Verify step labels changed after signing
    await expect(page.getByTestId("step2-label-1")).toHaveText("NEAR Wallet Verified")
    await expect(page.getByTestId("step2-label-2")).toHaveText("Verify Identity")

    // Verify QR code and instructions visible
    await expect(page.getByTestId("qr-code-container")).toBeVisible()
    await expect(page.getByTestId("how-to-verify-heading")).toHaveText("How to verify?")

    // =========================================================================
    // Phase 2: Direct API Verification (requires SKIP_ZK_VERIFICATION=true)
    // =========================================================================

    if (process.env.SKIP_ZK_VERIFICATION !== "true") {
      return
    }

    await page.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("self-session-")))

    const sessionKey = await page.evaluate(() => {
      return Object.keys(localStorage).find((key) => key.startsWith("self-session-")) || null
    })

    if (!sessionKey) {
      throw new Error("Failed to find Self verification session key in localStorage")
    }

    const sessionId = sessionKey.replace("self-session-", "")

    // Get the signing message (must match what the app uses)
    const verificationContract = process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT || "unknown-contract"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://citizenshouse.org"
    const signingMessage = `Identify myself for ${verificationContract} at ${appUrl}`

    // Create verification request with real NEAR signature
    const verificationBody = createVerificationRequest(testAccount, signingMessage, sessionId)
    const expectedAttestationLabel = getAttestationTypeName(verificationBody.attestationId)
    const expectedAttestationId = String(verificationBody.attestationId)

    // Call the verification API directly
    // 120s timeout needed because:
    // 1. NEAR RPC calls can be slow (access key lookup, nonce check)
    // 2. Contract execution waits for EXECUTED_OPTIMISTIC confirmation
    // 3. FastNEAR RPC calls can be slow under load
    const response = await page.request.post("/api/verification/verify", {
      data: verificationBody,
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    })

    // Check response
    const responseBody = await response.json()

    if (!response.ok()) {
      throw new Error(`Verification API failed: ${responseBody.error || response.status()}`)
    }

    expect(response.ok()).toBe(true)
    expect(responseBody.status).toBe("success")
    expect(responseBody.attestationId).toBe(verificationBody.attestationId)

    // =========================================================================
    // Phase 3: Trigger WebSocket Success → onSuccess → Step 3
    // =========================================================================

    // Trigger the WebSocket mock to send proof_verified event
    // This simulates the Self.xyz mobile app completing verification
    if (triggerWebSocketSuccess) {
      const statusRequestPromise = page.waitForRequest((request) => request.url().includes("/api/verification/status"))

      triggerWebSocketSuccess()

      const statusRequest = await statusRequestPromise
      const statusUrl = new URL(statusRequest.url())
      expect(statusUrl.searchParams.get("sessionId")).toBe(sessionId)
      expect(statusUrl.searchParams.get("accountId")).toBe(testAccount.accountId)
    }

    // Wait for Step 3 success screen to appear
    // With production build, no Fast Refresh - state persists
    await expect(page.getByTestId("success-section")).toBeVisible({ timeout: 60000 })

    // =========================================================================
    // Phase 4: Verify Success Screen Content
    // =========================================================================

    // Check for verified wallet display
    const verifiedWallet = page.getByTestId("wallet-verified-row")
    await expect(verifiedWallet).toContainText(testAccount.accountId)

    // Check for identity verified row and attestation badge
    const attestationBadge = page.getByTestId("attestation-badge-desktop")
    await expect(attestationBadge).toBeVisible()
    await expect(attestationBadge).toHaveText(expectedAttestationLabel)
    await expect(attestationBadge).toContainText(expectedAttestationLabel)

    // Verify session storage via status endpoint (with retry for eventual consistency)
    // Use Playwright's toPass for retry logic instead of hard-coded waitForTimeout
    await expect(async () => {
      const statusResponse = await page.request.get(
        `/api/verification/status?sessionId=${sessionId}&accountId=${testAccount.accountId}`,
      )
      expect(statusResponse.ok()).toBe(true)
      const statusBody = await statusResponse.json()
      expect(statusBody.status).toBe("success")
      expect(statusBody.attestationId).toBe(expectedAttestationId)
    }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] })

    await expect(async () => {
      await assertVerificationInCitizensList(page, testAccount.accountId, expectedAttestationLabel)
    }).toPass({ timeout: 30000, intervals: [1000, 2000, 3000] })
  })
})
