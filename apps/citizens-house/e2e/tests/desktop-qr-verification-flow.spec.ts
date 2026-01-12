/* eslint-disable no-empty-pattern */
import { test, expect } from "../fixtures/dynamic-wallet.fixture"
import { getAttestationTypeName } from "@near-citizens/shared"
import { createVerificationRequest } from "../helpers/near-signing"
import { setupSelfWebSocketMock } from "../helpers/self-websocket-mock"
import { logger, LogScope, Op } from "../../lib/logger"

const logContext = { scope: LogScope.E2E, operation: Op.E2E.DESKTOP_QR_FLOW }
const logStep = (step: number, message: string) => {
  logger.info(message, { ...logContext, step })
}
const logPhase = (phase: number, message: string) => {
  logger.info(message, { ...logContext, phase })
}

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
      logger.warn("Skipping desktop QR flow: missing NEAR credentials", {
        ...logContext,
        reason: "missing_env",
      })
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
      logPhase(0, "Setting up Self.xyz WebSocket mock for full verification flow")
      const { triggerSuccess } = await setupSelfWebSocketMock(page, { successDelay: 500 })
      triggerWebSocketSuccess = triggerSuccess
    }

    // Step 1: Visit homepage and verify redirect to /verification
    logStep(1, "Visiting homepage and checking redirect")
    await page.goto("/")
    await page.waitForURL("**/verification**", { timeout: 10000 })
    expect(page.url()).toContain("/verification")

    // Step 2: Verify landing page elements
    logStep(2, "Verifying landing page elements")
    await expect(page.getByTestId("identity-verification-tag")).toBeVisible()
    await expect(page.getByTestId("verification-hero-heading")).toBeVisible()
    await expect(page.getByTestId("verification-time-estimate")).toBeVisible()
    await expect(page.getByTestId("step1-heading-desktop")).toBeVisible()
    await expect(page.getByTestId("step2-heading-desktop")).toBeVisible()
    await expect(page.getByTestId("connect-wallet-button-desktop")).toBeVisible()

    // Step 3: Connect wallet via Meteor (full flow)
    logStep(3, "Connecting wallet via Meteor")
    await connectWithMeteor(page, context, testAccount)

    // Step 4: Verify redirected to /verification/start
    logStep(4, "Verifying redirect to /verification/start")
    expect(page.url()).toContain("/verification/start")

    // Step 5: Verify connected state on start page (parallel assertions for speed)
    logStep(5, "Verifying connected state and stepper (Step 1 active)")
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
    logStep(6, "Signing verification message")
    await signWithMeteor(page, context)

    // Step 7: Verify Step 2 UI (QR scan screen) and stepper state
    logStep(7, "Verifying Step 2 (QR scan) UI and stepper state")
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

    logPhase(1, "Phase 1 complete - reached QR scan screen")

    // =========================================================================
    // Phase 2: Direct API Verification (requires SKIP_ZK_VERIFICATION=true)
    // =========================================================================

    if (process.env.SKIP_ZK_VERIFICATION !== "true") {
      logger.warn("Skipping phases 2-4: SKIP_ZK_VERIFICATION not enabled", {
        ...logContext,
        reason: "skip_zk_verification",
      })
      logger.info("Set SKIP_ZK_VERIFICATION=true to run full flow", {
        ...logContext,
      })
      return
    }

    logPhase(2, "Phase 2: Direct API verification call")

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

    logger.info("Signing message prepared", {
      ...logContext,
      phase: 2,
      signing_message_length: signingMessage.length,
    })
    logger.info("Session ID captured", {
      ...logContext,
      phase: 2,
      session_id: sessionId,
    })
    logger.info("Test account ready", {
      ...logContext,
      phase: 2,
      account_id: testAccount.accountId,
    })

    // Create verification request with real NEAR signature
    const verificationBody = createVerificationRequest(testAccount, signingMessage, sessionId)
    const expectedAttestationLabel = getAttestationTypeName(verificationBody.attestationId)
    const expectedAttestationId = String(verificationBody.attestationId)

    logger.info("Sending verification request to API", {
      ...logContext,
      phase: 2,
    })

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
    logger.info("Verification API response received", {
      ...logContext,
      phase: 2,
      status_code: response.status(),
      response_status: responseBody.status,
      attestation_id: responseBody.attestationId,
      error_code: responseBody.errorCode,
      error_message: responseBody.error,
    })

    if (!response.ok()) {
      logger.error("Verification API error", {
        ...logContext,
        phase: 2,
        status_code: response.status(),
        error_code: responseBody.errorCode,
        error_message: responseBody.error || response.status(),
      })
      throw new Error(`Verification API failed: ${responseBody.error || response.status()}`)
    }

    expect(response.ok()).toBe(true)
    expect(responseBody.status).toBe("success")
    expect(responseBody.attestationId).toBe(verificationBody.attestationId)
    logger.info("Phase 2 complete: Verification API success", {
      ...logContext,
      phase: 2,
      attestation_id: responseBody.attestationId,
    })

    // =========================================================================
    // Phase 3: Trigger WebSocket Success → onSuccess → Step 3
    // =========================================================================

    logPhase(3, "Phase 3: Triggering WebSocket success to transition to Step 3")

    // Trigger the WebSocket mock to send proof_verified event
    // This simulates the Self.xyz mobile app completing verification
    if (triggerWebSocketSuccess) {
      triggerWebSocketSuccess()
      logger.info("WebSocket success triggered", {
        ...logContext,
        phase: 3,
      })
    }

    // Wait for Step 3 success screen to appear
    // With production build, no Fast Refresh - state persists
    await expect(page.getByTestId("success-section")).toBeVisible({ timeout: 60000 })
    logger.info("Phase 3 complete: Success screen displayed", {
      ...logContext,
      phase: 3,
    })

    // =========================================================================
    // Phase 4: Verify Success Screen Content
    // =========================================================================

    logPhase(4, "Phase 4: Verifying success screen content")

    // Check for success heading
    const successHeading = page.getByTestId("success-heading")
    if (await successHeading.isVisible()) {
      logger.info("Success heading visible", {
        ...logContext,
        phase: 4,
      })
    }

    // Check for verified wallet display
    const verifiedWallet = page.getByTestId("wallet-verified-row")
    if (await verifiedWallet.isVisible()) {
      const walletText = await verifiedWallet.textContent()
      logger.info("Wallet verified row visible", {
        ...logContext,
        phase: 4,
        wallet_text: walletText,
      })
    }
    await expect(verifiedWallet).toContainText(testAccount.accountId)

    // Check for identity verified row and attestation badge
    const identityVerified = page.getByTestId("identity-verified-row")
    if (await identityVerified.isVisible()) {
      logger.info("Identity verified row visible", {
        ...logContext,
        phase: 4,
      })
    }

    const attestationBadge = page.getByTestId("attestation-badge-desktop")
    await expect(attestationBadge).toBeVisible()
    await expect(attestationBadge).toHaveText(expectedAttestationLabel)
    await expect(attestationBadge).toContainText(expectedAttestationLabel)

    // Verify session storage via status endpoint (with retry for eventual consistency)
    logger.info("Verifying contract storage via status API", {
      ...logContext,
      phase: 4,
    })

    // Use Playwright's toPass for retry logic instead of hard-coded waitForTimeout
    await expect(async () => {
      const statusResponse = await page.request.get(
        `/api/verification/status?sessionId=${sessionId}&accountId=${testAccount.accountId}`,
      )
      expect(statusResponse.ok()).toBe(true)
      const statusBody = await statusResponse.json()
      logger.info("Status API response received", {
        ...logContext,
        phase: 4,
        status: statusBody.status,
        attestation_id: statusBody.attestationId,
        error_code: statusBody.errorCode,
        error_message: statusBody.error,
      })
      expect(statusBody.status).toBe("success")
      expect(statusBody.attestationId).toBe(expectedAttestationId)
    }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] })

    logger.info("Verification confirmed in session store", {
      ...logContext,
      phase: 4,
      session_id: sessionId,
    })

    await expect(async () => {
      await assertVerificationInCitizensList(page, testAccount.accountId, expectedAttestationLabel)
    }).toPass({ timeout: 30000, intervals: [1000, 2000, 3000] })

    // Log final state
    logger.info("Full verification flow complete", {
      ...logContext,
      status: "success",
      account_id: testAccount.accountId,
      session_id: sessionId,
      contract: verificationContract,
    })
  })
})
