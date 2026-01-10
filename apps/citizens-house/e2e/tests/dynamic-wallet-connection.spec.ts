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

  test("complete flow: homepage -> verification -> wallet connect -> start page", async ({
    page,
    context,
    testAccount,
    connectWithMeteor,
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
    console.log("Step 5: Verifying connected state")
    await expect(page.getByTestId("step-indicator-1")).toBeVisible()
    await expect(page.getByTestId("step-indicator-2")).toBeVisible()
    await expect(page.getByTestId("step1-card-title")).toBeVisible()
    await expect(page.getByTestId("step1-card-title")).toHaveText("Sign Verification Message")

    // Verify wallet is connected
    await expect(page.getByTestId("connected-wallet-display")).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId("connected-wallet-address")).toBeVisible()

    // Verify account ID matches dynamically created account
    const displayedAddress = await page.getByTestId("connected-wallet-address").textContent()
    expect(displayedAddress).toContain(testAccount.accountId.split(".")[0])

    // Verify Sign Message button is available
    const signButton = page.getByTestId("sign-message-button")
    await expect(signButton).toBeVisible()
    await expect(signButton).toBeEnabled()

    // Verify Disconnect button is available
    await expect(page.getByTestId("disconnect-wallet-button")).toBeVisible()

    console.log("All steps completed successfully!")
  })
})
