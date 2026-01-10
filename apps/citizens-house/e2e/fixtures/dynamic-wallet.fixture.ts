/* eslint-disable no-empty-pattern, react-hooks/rules-of-hooks */
import { test as base, Page, BrowserContext, expect } from "@playwright/test"
import { NearAccountManager } from "../helpers/near-account-manager"
import { setupMeteorWalletWithAccount, approveConnection, approveSignature } from "../helpers/meteor-wallet-setup"

interface TestAccount {
  accountId: string
  publicKey: string
  privateKey: string
}

interface WalletSession {
  password: string
}

interface DynamicWalletFixtures {
  testAccount: TestAccount
  walletSession: WalletSession
  connectWithMeteor: (page: Page, context: BrowserContext, account: TestAccount) => Promise<void>
  signWithMeteor: (page: Page, context: BrowserContext) => Promise<void>
}

/**
 * Extended Playwright test with dynamic NEAR wallet fixtures.
 *
 * Provides:
 * - testAccount: A dynamically created NEAR subaccount
 * - connectWithMeteor: Function to connect via real Meteor wallet UI
 *
 * The testAccount is automatically cleaned up after each test.
 */
export const test = base.extend<DynamicWalletFixtures>({
  // Shared wallet session state (stores password from connection)
  walletSession: async ({}, use) => {
    const session: WalletSession = { password: "" }
    await use(session)
  },

  // Create a fresh NEAR subaccount for each test
  testAccount: async ({}, use) => {
    const manager = new NearAccountManager()
    const account = await manager.createTestAccount()

    console.log(`✓ Created NEAR test account: ${account.accountId}`)

    await use(account)

    // Cleanup: delete the subaccount after test
    try {
      console.log(`✓ Deleting NEAR test account: ${account.accountId}`)
      await manager.deleteTestAccount(account.accountId)
    } catch (error) {
      console.warn(`⚠ Failed to delete test account: ${error}`)
    }
  },

  // Connect to app via Meteor wallet with dynamically created account
  // Assumes page is already on /verification landing page
  // Flow: click connect wallet -> complete Meteor flow -> redirect to /verification/start
  connectWithMeteor: async ({ walletSession }, use) => {
    const connect = async (page: Page, context: BrowserContext, account: TestAccount) => {
      // Set up listener for new tab BEFORE clicking (captures popup when wallet selector opens Meteor)
      const meteorPagePromise = context.waitForEvent("page", { timeout: 30000 })

      // Click connect button - auto-waits for actionability
      await page.getByTestId("connect-wallet-button-desktop").click()

      // Wait for wallet selector modal - text-based since it's external library
      await page.getByText(/select.*wallet/i).click({ trial: true }) // trial: true just waits without clicking

      // Select Meteor Wallet from the external wallet selector
      await page.getByText("Meteor Wallet").click()

      // Wait for Meteor wallet tab to open
      const meteorPage = await meteorPagePromise
      await meteorPage.waitForLoadState("domcontentloaded")

      console.log(`✓ Meteor wallet opened: ${meteorPage.url()}`)

      // Create fresh Meteor wallet and import the test account
      const { password } = await setupMeteorWalletWithAccount(meteorPage, {
        privateKey: account.privateKey,
      })

      // Store password for later use in signing
      walletSession.password = password
      console.log(`✓ Meteor wallet created with dynamic password`)

      // Approve connection to the app (handles page close internally)
      await approveConnection(meteorPage)

      // Use web-first assertion for URL - auto-retries
      await expect(page).toHaveURL(/\/verification\/start/, { timeout: 15000 })

      // Use web-first assertion for connected state
      await expect(page.getByTestId("connected-wallet-display")).toBeVisible({ timeout: 10000 })

      console.log(`✓ Connected to app with account: ${account.accountId}`)
      console.log(`✓ Redirected to: ${page.url()}`)
    }

    await use(connect)
  },

  // Sign message via Meteor wallet
  // Assumes page is on /verification/start with wallet connected
  signWithMeteor: async ({ walletSession }, use) => {
    const sign = async (page: Page, context: BrowserContext) => {
      // Set up listener for signature popup BEFORE clicking
      const signaturePagePromise = context.waitForEvent("page", { timeout: 30000 })

      // Click Sign Message button - auto-waits for actionability
      await page.getByTestId("sign-message-button").click()

      // Capture Meteor signature popup
      const signaturePage = await signaturePagePromise
      await signaturePage.waitForLoadState("domcontentloaded")
      console.log(`✓ Meteor signature popup opened: ${signaturePage.url()}`)

      // Approve signature (pass password for unlock screen)
      await approveSignature(signaturePage, { password: walletSession.password })

      // Wait for popup to close
      await signaturePage.waitForEvent("close", { timeout: 15000 }).catch(() => {
        console.log("Signature popup did not close, may have redirected")
      })

      // Use web-first assertion for Step 2 appearance - this confirms signing succeeded
      await expect(page.getByTestId("step2-section")).toBeVisible({ timeout: 15000 })
      console.log("✓ Message signed successfully, Step 2 visible")
    }

    await use(sign)
  },
})

export { expect } from "@playwright/test"
