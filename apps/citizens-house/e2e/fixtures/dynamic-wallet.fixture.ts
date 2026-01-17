/* eslint-disable no-empty-pattern, react-hooks/rules-of-hooks */
import { test as base, Page, BrowserContext, expect } from "@playwright/test"
import type { NearAccountId } from "@/lib"
import { NearAccountManager } from "../helpers/near-account-manager"
import { setupMeteorWalletWithAccount, approveConnection, approveSignature } from "../helpers/meteor-wallet-setup"

interface TestAccount {
  accountId: NearAccountId
  publicKey: string
  privateKey: string
}

interface WalletSession {
  password: string
}

interface DynamicWalletFixtures {
  testAccount: TestAccount
  walletSession: WalletSession
  connectWithMeteor: (
    page: Page,
    context: BrowserContext,
    account: TestAccount,
    options?: { connectButtonTestId?: string },
  ) => Promise<void>
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
export const test = base.extend<DynamicWalletFixtures, { accountManager: NearAccountManager }>({
  accountManager: [
    async ({}, use, workerInfo) => {
      const manager = new NearAccountManager(workerInfo.parallelIndex)

      await use(manager)

      // Worker-level cleanup: runs after ALL tests in this worker complete
      // This is the safety net - catches any accounts not deleted by individual tests
      await manager.cleanupAll()
    },
    { scope: "worker" },
  ],

  // Shared wallet session state (stores password from connection)
  walletSession: async ({}, use) => {
    const session: WalletSession = { password: "" }
    await use(session)
  },

  // Create a fresh NEAR subaccount for each test
  // Each worker has its own deterministically-derived access key on the parent account,
  // eliminating nonce collisions. See: https://docs.near.org/protocol/access-keys
  testAccount: async ({ accountManager }, use) => {
    const account = await accountManager.createTestAccount()

    await use(account)

    // Per-test cleanup: delete the subaccount after test
    // If this fails, the worker-level cleanup will catch it
    try {
      await accountManager.deleteTestAccount(account.accountId)
    } catch {
      // Per-test cleanup failed; will retry in worker cleanup
      // Don't throw - let the worker-level cleanup handle it
    }
  },

  // Connect to app via Meteor wallet with dynamically created account
  // Assumes page is already on /verification landing page
  // Flow: click connect wallet -> complete Meteor flow -> redirect to /verification/start
  connectWithMeteor: async ({ walletSession }, use) => {
    const connect = async (
      page: Page,
      context: BrowserContext,
      account: TestAccount,
      options?: { connectButtonTestId?: string },
    ) => {
      // Set up listener for new tab BEFORE clicking (captures popup when wallet selector opens Meteor)
      const meteorPagePromise = context.waitForEvent("page", { timeout: 30000 })

      // Click connect button - auto-waits for actionability
      const connectButtonTestId = options?.connectButtonTestId ?? "connect-wallet-button-desktop"
      await page.getByTestId(connectButtonTestId).click()

      // Wait for wallet selector modal - text-based since it's external library
      await page.getByText(/select.*wallet/i).click({ trial: true }) // trial: true just waits without clicking

      // Select Meteor Wallet from the external wallet selector
      await page.getByText("Meteor Wallet").click()

      // Wait for Meteor wallet tab to open
      const meteorPage = await meteorPagePromise
      await meteorPage.waitForLoadState("domcontentloaded")

      // Create fresh Meteor wallet and import the test account
      const { password } = await setupMeteorWalletWithAccount(meteorPage, {
        privateKey: account.privateKey,
      })

      // Store password for later use in signing
      walletSession.password = password

      // Approve connection to the app (handles page close internally)
      await approveConnection(meteorPage)

      // Use web-first assertion for URL - auto-retries
      await expect(page).toHaveURL(/\/verification\/start/, { timeout: 15000 })

      // Use web-first assertion for connected state
      await expect(page.getByTestId("connected-wallet-display")).toBeVisible({ timeout: 10000 })
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

      // Approve signature (pass password for unlock screen)
      await approveSignature(signaturePage, { password: walletSession.password })

      // Wait for popup to close
      await signaturePage.waitForEvent("close", { timeout: 15000 }).catch(() => {
        // Signature popup did not close, may have redirected
      })

      // Use web-first assertion for Step 2 appearance - this confirms signing succeeded
      await expect(page.getByTestId("step2-section")).toBeVisible({ timeout: 15000 })
    }

    await use(sign)
  },
})

export { expect } from "@playwright/test"
