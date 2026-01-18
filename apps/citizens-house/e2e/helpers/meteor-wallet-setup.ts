import { Page, expect } from "@playwright/test"
import { randomBytes } from "crypto"

interface SetupOptions {
  privateKey: string // ed25519:... format for the NEAR account to import
}

interface MeteorWalletSession {
  password: string // Dynamically generated password
}

/**
 * Creates a fresh Meteor wallet and imports a NEAR account.
 *
 * Meteor Wallet Import Flow (when opened from wallet selector):
 * 1. Get Started button
 * 2. Import an existing wallet button
 * 3. Create password + confirm password + accept ToS + Continue
 * 4. Select Private Key import method + Continue
 * 5. Enter private key
 * 6. Find my account
 * 7. Select account
 *
 * @param meteorPage - The Playwright Page for the Meteor wallet tab
 * @param options - Setup options including the private key to import
 * @returns Session info including the generated password
 */
export async function setupMeteorWalletWithAccount(
  meteorPage: Page,
  options: SetupOptions,
): Promise<MeteorWalletSession> {
  const { privateKey } = options

  // Generate a secure random password for this test session
  const password = `E2E-${randomBytes(16).toString("hex")}`

  // Wait for page to load - use domcontentloaded since external wallet may have continuous network activity
  await meteorPage.waitForLoadState("domcontentloaded")

  // Step 1: Click "Get Started with Meteor Wallet"
  // Wait for this button as the signal that the page is ready
  const getStartedBtn = meteorPage.getByRole("button", { name: /get.*started/i })
  try {
    await getStartedBtn.waitFor({ state: "visible", timeout: 15000 })
    await getStartedBtn.click()
  } catch {
    // Button may not be present if wallet already initialized
  }

  // Step 2: Click "Import an existing wallet"
  const importBtn = meteorPage.getByRole("button", {
    name: /import an existing wallet/i,
  })
  try {
    await importBtn.waitFor({ state: "visible", timeout: 5000 })
    await importBtn.click()
  } catch {
    // Button may not be present
  }

  // Step 3: Fill password fields and accept ToS
  const passwordInput = meteorPage.getByPlaceholder("Enter Password")
  try {
    await passwordInput.waitFor({ state: "visible", timeout: 5000 })
    await passwordInput.fill(password)

    const confirmPasswordInput = meteorPage.getByPlaceholder("Confirm Password")
    await confirmPasswordInput.waitFor({ state: "visible", timeout: 3000 })
    await confirmPasswordInput.fill(password)

    // Accept ToS using JavaScript (direct click sometimes doesn't work on custom checkboxes)
    await meteorPage.evaluate(() => {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
      if (checkbox) checkbox.click()
    })

    // Click Continue - wait for it to be enabled after checkbox
    const continueBtn = meteorPage.getByRole("button", { name: /continue/i })
    await continueBtn.waitFor({ state: "visible", timeout: 3000 })
    await continueBtn.click()
  } catch {
    // Password step may not be present
  }

  // Step 4: Select "Private Key" import method
  const privateKeyBtn = meteorPage.getByRole("button", { name: /private key/i })
  try {
    await privateKeyBtn.waitFor({ state: "visible", timeout: 5000 })
    await privateKeyBtn.click()

    // Click Continue after method selection
    const continueBtn2 = meteorPage.getByRole("button", { name: /continue/i })
    await continueBtn2.waitFor({ state: "visible", timeout: 3000 })
    await continueBtn2.click()
  } catch {
    // Method selection may not be present
  }

  // Step 5: Enter private key
  const privateKeyTextarea = meteorPage.locator("textarea").first()
  try {
    await privateKeyTextarea.waitFor({ state: "visible", timeout: 5000 })
    await privateKeyTextarea.fill(privateKey)
  } catch {
    // Textarea may not be present
  }

  // Step 6: Click "Find my account" - wait for it to become enabled
  const findAccountBtn = meteorPage.getByRole("button", {
    name: /find my account/i,
  })
  try {
    // Wait for button to be visible first, then enabled
    await findAccountBtn.waitFor({ state: "visible", timeout: 5000 })
    // Poll for enabled state since Playwright doesn't have waitFor({ state: "enabled" })
    await meteorPage.waitForFunction(
      () => {
        const btn = document.evaluate(
          `//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'find my account')]`,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null,
        ).singleNodeValue as HTMLButtonElement | null
        return btn && !btn.disabled
      },
      null,
      { timeout: 10000 },
    )
    await findAccountBtn.click()
  } catch {
    // Find account button may not be present or enable
  }

  // Step 7: Select the found account - wait for account buttons to appear
  const accountBtn = meteorPage.getByRole("button").filter({ hasText: /\.near|\.testnet/i })
  try {
    await accountBtn.first().waitFor({ state: "visible", timeout: 10000 })
    await accountBtn.first().click()
  } catch {
    // Account button may not appear
  }

  return { password }
}

/**
 * Approves a connection request from an app in the Meteor wallet.
 * Handles promotional modals that may appear before the connect screen.
 *
 * @param meteorPage - The Playwright Page for the Meteor wallet tab
 */
export async function approveConnection(meteorPage: Page): Promise<void> {
  // Close promotional modals - look for Close button (not Cancel!)
  // Promotional modals have "Close" button, connection screen has "Cancel" + "Connect"
  for (let i = 0; i < 5; i++) {
    // Check if we're on the Connect Request screen (has both Cancel and Connect)
    // Note: isVisible() returns immediately (timeout param is deprecated/ignored)
    const cancelBtn = meteorPage.getByRole("button", { name: "Cancel" })
    const connectBtnCheck = meteorPage.getByRole("button", { name: "Connect" })

    const [hasCancelBtn, hasConnectBtn] = await Promise.all([cancelBtn.isVisible(), connectBtnCheck.isVisible()])

    if (hasCancelBtn && hasConnectBtn) {
      break
    }

    // Look for Close button (promotional modal)
    const closeBtn = meteorPage.getByRole("button", { name: "Close" }).first()
    if (await closeBtn.isVisible()) {
      // Use JavaScript click since button may be outside viewport in some modal states
      await closeBtn.evaluate((el) => (el as HTMLButtonElement).click())
      // Wait for the modal to close before checking again
      await closeBtn.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {})
    } else {
      // Neither target screen nor close button visible - wait for UI to update
      await meteorPage.waitForTimeout(500)
    }
  }

  // Click elsewhere to dismiss any open menus/dropdowns
  await meteorPage
    .locator("body")
    .click({ position: { x: 10, y: 10 }, force: true })
    .catch(() => {})

  // Find and click the Connect button
  const connectBtn = meteorPage.getByRole("button", { name: "Connect" }).last()
  // Use web-first assertion to wait for button visibility
  await expect(connectBtn).toBeVisible({ timeout: 10000 })
  // Use JavaScript click since other elements may intercept pointer events
  await connectBtn.evaluate((el) => (el as HTMLButtonElement).click())

  // Wait for the Meteor page to close automatically
  try {
    await meteorPage.waitForEvent("close", { timeout: 15000 })
  } catch {
    // Page did not close automatically
  }
}

interface SignatureOptions {
  password: string // The Meteor wallet password for unlocking
}

/**
 * Approves a message signing request in Meteor wallet.
 * Handles wallet unlock screen and promotional modals.
 *
 * @param meteorPage - The Playwright Page for the Meteor wallet tab
 * @param options - Options including the wallet password for unlocking
 */
export async function approveSignature(meteorPage: Page, options: SignatureOptions): Promise<void> {
  const { password } = options

  // Wait for page to load
  await meteorPage.waitForLoadState("domcontentloaded")

  // Check if unlock screen is showing (wallet needs password)
  // Use waitFor with a try/catch to detect unlock screen
  const unlockBtn = meteorPage.getByRole("button", { name: /unlock/i })
  try {
    await unlockBtn.waitFor({ state: "visible", timeout: 5000 })

    // Enter password
    const passwordInput = meteorPage.getByPlaceholder(/enter password/i)
    await passwordInput.waitFor({ state: "visible", timeout: 5000 })
    await passwordInput.fill(password)

    // Click Unlock
    await unlockBtn.click()

    // Wait for unlock to complete
    await unlockBtn.waitFor({ state: "hidden", timeout: 10000 })
  } catch {
    // No unlock screen, proceed to signature approval
  }

  // Close promotional modals (same pattern as approveConnection)
  for (let i = 0; i < 5; i++) {
    // Check if we're on the signature approval screen
    // Note: isVisible() returns immediately (timeout param is deprecated/ignored)
    const approveBtn = meteorPage.getByRole("button", { name: /approve|sign|confirm/i })
    if (await approveBtn.isVisible()) {
      break
    }

    // Look for Close button (promotional modal)
    const closeBtn = meteorPage.getByRole("button", { name: "Close" }).first()
    if (await closeBtn.isVisible()) {
      await closeBtn.evaluate((el) => (el as HTMLButtonElement).click())
      await closeBtn.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {})
    } else {
      // Neither target screen nor close button visible - wait for UI to update
      await meteorPage.waitForTimeout(500)
    }
  }

  // Click elsewhere to dismiss any open menus/dropdowns
  await meteorPage
    .locator("body")
    .click({ position: { x: 10, y: 10 }, force: true })
    .catch(() => {})

  // Find and click the Approve/Sign button
  const approveBtn = meteorPage.getByRole("button", { name: /approve|sign|confirm/i }).last()
  // Use web-first assertion to wait for button visibility
  await expect(approveBtn).toBeVisible({ timeout: 10000 })
  await approveBtn.evaluate((el) => (el as HTMLButtonElement).click())

  // Wait for the Meteor page to close automatically
  try {
    await meteorPage.waitForEvent("close", { timeout: 15000 })
  } catch {
    // Page did not close automatically after signing
  }
}
