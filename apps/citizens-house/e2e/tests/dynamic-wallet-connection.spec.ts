/* eslint-disable no-empty-pattern */
import { test, expect } from "../fixtures/dynamic-wallet.fixture"

/**
 * Complete End-to-End Wallet Connection Flow
 *
 * This test creates a real NEAR subaccount, connects it via the actual
 * Meteor wallet UI, and verifies the complete user flow:
 *
 * 1. Visit homepage (/) -> auto-redirect to /verification
 * 2. Click connect wallet on landing page
 * 3. Complete Meteor wallet connection (import account, approve connection)
 * 4. Verify redirect to /verification/start with wallet connected
 * 5. Verify Sign Message button is available
 *
 * Requirements:
 * - Doppler env vars: NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY
 * - Network configured via NEXT_PUBLIC_NEAR_NETWORK (defaults to testnet)
 */
test.describe("Complete Wallet Connection E2E Flow", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!process.env.NEAR_ACCOUNT_ID || !process.env.NEAR_PRIVATE_KEY) {
      testInfo.skip()
      console.log("Skipping: NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY are required")
    }
  })

  test("complete flow: homepage -> verification -> wallet connect -> sign -> QR scan", async ({
    page,
    context,
    testAccount,
    connectWithMeteor,
    signWithMeteor,
  }) => {
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

    // Step 5: Verify connected state on start page
    console.log("Step 5: Verifying connected state and stepper (Step 1 active)")
    await expect(page.getByTestId("step-indicator-1")).toBeVisible()
    await expect(page.getByTestId("step-indicator-2")).toBeVisible()
    await expect(page.getByTestId("step1-card-title")).toHaveText("Sign Verification Message")

    // Verify stepper state: Step 1 active, Step 2 inactive
    await expect(page.getByTestId("step-indicator-1")).toHaveAttribute("data-step-state", "active")
    await expect(page.getByTestId("step-indicator-2")).toHaveAttribute("data-step-state", "inactive")

    // Verify step labels
    await expect(page.getByTestId("step-label-1")).toHaveText("Verify NEAR Wallet")
    await expect(page.getByTestId("step-label-2")).toHaveText("Verify Identity")

    // Verify wallet is connected
    await expect(page.getByTestId("connected-wallet-display")).toBeVisible()
    await expect(page.getByTestId("connected-wallet-address")).toContainText(testAccount.accountId.split(".")[0])

    // Verify Sign Message button is available
    await expect(page.getByTestId("sign-message-button")).toBeVisible()
    await expect(page.getByTestId("sign-message-button")).toBeEnabled()

    // Verify Disconnect button is available
    await expect(page.getByTestId("disconnect-wallet-button")).toBeVisible()

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

    console.log("All steps completed - verification flow reached QR scan screen!")
  })
})
