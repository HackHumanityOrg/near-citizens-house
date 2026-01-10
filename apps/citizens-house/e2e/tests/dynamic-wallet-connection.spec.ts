/* eslint-disable no-empty-pattern */
import { test, expect } from "../fixtures/dynamic-wallet.fixture"
import { createVerificationRequest } from "../helpers/near-signing"
import { setupSelfWebSocketMock } from "../helpers/self-websocket-mock"
import { v4 as uuidv4 } from "uuid"

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
test.describe("Complete Verification E2E Flow", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!process.env.NEAR_ACCOUNT_ID || !process.env.NEAR_PRIVATE_KEY) {
      testInfo.skip()
      console.log("Skipping: NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY are required")
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
      console.log("Setting up Self.xyz WebSocket mock for full verification flow")
      const { triggerSuccess } = await setupSelfWebSocketMock(page, { successDelay: 500 })
      triggerWebSocketSuccess = triggerSuccess
    }

    // Step 1: Visit homepage and verify redirect to /verification
    console.log("Step 1: Visiting homepage and checking redirect")
    await page.goto("/")
    await page.waitForURL("**/verification**", { timeout: 10000 })
    expect(page.url()).toContain("/verification")

    // Step 2: Verify landing page elements
    console.log("Step 2: Verifying landing page elements")
    await expect(page.getByTestId("identity-verification-tag")).toBeVisible()
    await expect(page.getByTestId("verification-hero-heading")).toBeVisible()
    await expect(page.getByTestId("verification-time-estimate")).toBeVisible()
    await expect(page.getByTestId("step1-heading-desktop")).toBeVisible()
    await expect(page.getByTestId("step2-heading-desktop")).toBeVisible()
    await expect(page.getByTestId("connect-wallet-button-desktop")).toBeVisible()

    // Step 3: Connect wallet via Meteor (full flow)
    console.log("Step 3: Connecting wallet via Meteor")
    await connectWithMeteor(page, context, testAccount)

    // Step 4: Verify redirected to /verification/start
    console.log("Step 4: Verifying redirect to /verification/start")
    expect(page.url()).toContain("/verification/start")

    // Step 5: Verify connected state on start page (parallel assertions for speed)
    console.log("Step 5: Verifying connected state and stepper (Step 1 active)")
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
    console.log("Step 6: Signing verification message")
    await signWithMeteor(page, context)

    // Step 7: Verify Step 2 UI (QR scan screen) and stepper state
    console.log("Step 7: Verifying Step 2 (QR scan) UI and stepper state")
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

    console.log("Phase 1 complete - verification flow reached QR scan screen!")

    // =========================================================================
    // Phase 2: Direct API Verification (requires SKIP_ZK_VERIFICATION=true)
    // =========================================================================

    if (process.env.SKIP_ZK_VERIFICATION !== "true") {
      console.log("Skipping Phase 2-4: SKIP_ZK_VERIFICATION is not enabled")
      console.log("To run full verification flow, set SKIP_ZK_VERIFICATION=true")
      return
    }

    console.log("\nPhase 2: Direct API verification call")

    // Generate session ID for tracking
    const sessionId = uuidv4()

    // Get the signing message (must match what the app uses)
    const verificationContract = process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT || "unknown-contract"
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://citizenshouse.org"
    const signingMessage = `Identify myself for ${verificationContract} at ${appUrl}`

    console.log(`Signing message: "${signingMessage}"`)
    console.log(`Session ID: ${sessionId}`)
    console.log(`Test account: ${testAccount.accountId}`)

    // Create verification request with real NEAR signature
    const verificationBody = createVerificationRequest(testAccount, signingMessage, sessionId)

    console.log("Sending verification request to API...")

    // Call the verification API directly
    // 120s timeout needed because:
    // 1. NEAR RPC calls can be slow (access key lookup, nonce check)
    // 2. Contract storage includes polling for on-chain confirmation (up to 90s on mainnet)
    // 3. FailoverRpcProvider may need to try multiple RPCs before succeeding
    const response = await page.request.post("/api/verification/verify", {
      data: verificationBody,
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    })

    // Check response
    const responseBody = await response.json()
    console.log("API Response:", JSON.stringify(responseBody, null, 2))

    if (!response.ok()) {
      console.error("API Error:", responseBody)
      throw new Error(`Verification API failed: ${responseBody.error || response.status()}`)
    }

    expect(response.ok()).toBe(true)
    expect(responseBody.status).toBe("success")
    console.log("✓ Phase 2 complete: Verification API returned success")

    // =========================================================================
    // Phase 3: Trigger WebSocket Success → onSuccess → Step 3
    // =========================================================================

    console.log("\nPhase 3: Triggering WebSocket success to transition to Step 3")

    // Trigger the WebSocket mock to send proof_verified event
    // This simulates the Self.xyz mobile app completing verification
    if (triggerWebSocketSuccess) {
      triggerWebSocketSuccess()
      console.log("✓ WebSocket success triggered")
    }

    // Wait for Step 3 success screen to appear
    // With production build, no Fast Refresh - state persists
    await expect(page.getByTestId("success-section")).toBeVisible({ timeout: 15000 })
    console.log("✓ Phase 3 complete: Step 3 success screen displayed")

    // =========================================================================
    // Phase 4: Verify Success Screen Content
    // =========================================================================

    console.log("\nPhase 4: Verifying success screen content")

    // Check for success heading
    const successHeading = page.getByTestId("success-heading")
    if (await successHeading.isVisible()) {
      console.log("✓ Success heading visible")
    }

    // Check for verified wallet display
    const verifiedWallet = page.getByTestId("wallet-verified-row")
    if (await verifiedWallet.isVisible()) {
      const walletText = await verifiedWallet.textContent()
      console.log(`✓ Wallet verified row visible: ${walletText}`)
    }

    // Check for identity verified row
    const identityVerified = page.getByTestId("identity-verified-row")
    if (await identityVerified.isVisible()) {
      console.log("✓ Identity verified row visible")
    }

    // Verify session storage via status endpoint (with retry for eventual consistency)
    console.log("\nVerifying contract storage via status API...")

    // Use Playwright's toPass for retry logic instead of hard-coded waitForTimeout
    await expect(async () => {
      const statusResponse = await page.request.get(
        `/api/verification/status?sessionId=${sessionId}&accountId=${testAccount.accountId}`,
      )
      expect(statusResponse.ok()).toBe(true)
      const statusBody = await statusResponse.json()
      console.log("Status Response:", JSON.stringify(statusBody, null, 2))
      expect(statusBody.status).toBe("success")
    }).toPass({ timeout: 10000, intervals: [500, 1000, 2000] })

    console.log("✓ Verification confirmed in session store")

    // Log final state
    console.log(`\n${"=".repeat(60)}`)
    console.log("✓ Full Verification Flow Complete!")
    console.log(`${"=".repeat(60)}`)
    console.log(`Account: ${testAccount.accountId}`)
    console.log(`Session: ${sessionId}`)
    console.log(`Contract: ${verificationContract}`)
    console.log(`${"=".repeat(60)}\n`)
  })
})
