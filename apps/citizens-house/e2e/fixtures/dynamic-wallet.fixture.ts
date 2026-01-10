/* eslint-disable no-empty-pattern, react-hooks/rules-of-hooks */
import { test as base, Page, BrowserContext } from "@playwright/test"
import { NearAccountManager } from "../helpers/near-account-manager"
import { setupMeteorWalletWithAccount, approveConnection } from "../helpers/meteor-wallet-setup"

interface TestAccount {
  accountId: string
  publicKey: string
  privateKey: string
}

interface DynamicWalletFixtures {
  testAccount: TestAccount
  connectWithMeteor: (page: Page, context: BrowserContext, account: TestAccount) => Promise<void>
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
  connectWithMeteor: async ({}, use) => {
    const connect = async (page: Page, context: BrowserContext, account: TestAccount) => {
      // Click connect button on landing page (desktop version)
      // Assumes page is already on /verification from the test
      const connectButton = page.getByTestId("connect-wallet-button-desktop")
      await connectButton.waitFor({ state: "visible", timeout: 10000 })
      await connectButton.click()

      // Wait for wallet selector modal to appear

      // Set up listener for new tab BEFORE clicking Meteor
      const meteorPagePromise = context.waitForEvent("page", { timeout: 15000 })

      // Note: Text-based selectors are used here because the wallet selector modal
      // is from external library @near-wallet-selector which doesn't expose test IDs
      await page.getByText(/select.*wallet/i).waitFor({ state: "visible", timeout: 5000 })

      // Select Meteor Wallet from the external wallet selector
      await page.getByText("Meteor Wallet").click()

      // Wait for Meteor wallet tab to open
      const meteorPage = await meteorPagePromise
      await meteorPage.waitForLoadState("domcontentloaded")

      console.log(`✓ Meteor wallet opened: ${meteorPage.url()}`)

      // Create fresh Meteor wallet and import the test account
      // Password is dynamically generated - no env var needed!
      await setupMeteorWalletWithAccount(meteorPage, {
        privateKey: account.privateKey,
      })

      console.log(`✓ Meteor wallet created with dynamic password`)

      // Approve connection to the app
      await approveConnection(meteorPage)

      // Wait for Meteor page to close or redirect
      await meteorPage.waitForEvent("close", { timeout: 15000 }).catch(() => {
        console.log("Meteor page did not close, may have redirected")
      })

      // Wait for redirect to /verification/start and connected state
      await page.waitForURL("**/verification/start**", { timeout: 15000 })
      // Wait for the page to fully load and show connected wallet
      await page.getByTestId("connected-wallet-display").waitFor({ state: "visible", timeout: 10000 })

      console.log(`✓ Connected to app with account: ${account.accountId}`)
      console.log(`✓ Redirected to: ${page.url()}`)
    }

    await use(connect)
  },
})

export { expect } from "@playwright/test"
