/* eslint-disable no-empty-pattern */
import { devices } from "@playwright/test"
import { getAttestationTypeName } from "@near-citizens/shared"
import { test, expect } from "../fixtures/dynamic-wallet.fixture"
import { createVerificationRequest } from "../helpers/near-signing"

const verificationContract = process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT || "unknown-contract"
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://citizenshouse.org"
const signingMessage = `Identify myself for ${verificationContract} at ${appUrl}`

test.use({ ...devices["iPhone 14"] })

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

test.describe("Mobile Deeplink Verification Flow", () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!process.env.NEAR_ACCOUNT_ID || !process.env.NEAR_PRIVATE_KEY) {
      testInfo.skip()
    }
  })

  test("mobile flow: wallet connect -> sign -> deeplink callback -> success", async ({
    page,
    context,
    testAccount,
    connectWithMeteor,
    signWithMeteor,
  }) => {
    await page.addInitScript(() => {
      ;(window as { __lastOpenedUrl?: string }).__lastOpenedUrl = undefined
      const originalOpen = window.open.bind(window)
      window.open = (url, target, features) => {
        const nextUrl = typeof url === "string" ? url : url?.toString()
        if (nextUrl && nextUrl.includes("redirect.self.xyz")) {
          ;(window as { __lastOpenedUrl?: string }).__lastOpenedUrl = nextUrl
          return null
        }
        return originalOpen(url as string, target, features)
      }
    })

    // Note: Mobile deeplink flow does NOT use WebSocket.
    // Success notification comes via callback page redirect, not WebSocket events.
    // The SelfQRcodeWrapper component is hidden on mobile (CSS), so its WebSocket
    // connection is irrelevant for the mobile flow.

    await page.goto("/")
    await page.waitForURL("**/verification**", { timeout: 10000 })
    expect(page.url()).toContain("/verification")

    await expect(page.getByTestId("identity-verification-tag")).toBeVisible()
    await expect(page.getByTestId("verification-hero-heading")).toBeVisible()
    await expect(page.getByTestId("verification-time-estimate")).toBeVisible()
    await expect(page.getByTestId("step1-heading-mobile")).toBeVisible()
    await expect(page.getByTestId("step2-heading-mobile")).toBeVisible()
    await expect(page.getByTestId("connect-wallet-button-mobile")).toBeVisible()

    await connectWithMeteor(page, context, testAccount, { connectButtonTestId: "connect-wallet-button-mobile" })

    expect(page.url()).toContain("/verification/start")

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

    await signWithMeteor(page, context)

    await expect(page.getByTestId("step2-section")).toBeVisible()
    await expect(page.getByTestId("step2-indicator-completed")).toHaveAttribute("data-step-state", "completed")
    await expect(page.getByTestId("step2-indicator-active")).toHaveAttribute("data-step-state", "active")
    await expect(page.getByTestId("step2-label-1")).toHaveText("NEAR Wallet Verified")
    await expect(page.getByTestId("step2-label-2")).toHaveText("Verify Identity")
    await expect(page.getByTestId("open-self-app-button")).toBeVisible()
    await expect(page.getByTestId("qr-code-container")).toBeHidden()
    await expect(page.getByTestId("how-to-verify-heading")).toHaveText("How to verify?")

    if (process.env.SKIP_ZK_VERIFICATION !== "true") {
      return
    }

    await page.getByTestId("open-self-app-button").click()

    const deeplinkData = await page.evaluate(() => {
      const lastOpenedUrl = (window as { __lastOpenedUrl?: string }).__lastOpenedUrl
      if (!lastOpenedUrl) {
        return { lastOpenedUrl: null, callbackSessionId: null }
      }

      let callbackSessionId: string | null = null
      let callbackAccountId: string | null = null

      try {
        const parsedUrl = new URL(lastOpenedUrl)
        const selfAppParam = parsedUrl.searchParams.get("selfApp")

        if (selfAppParam) {
          let selfApp
          try {
            selfApp = JSON.parse(selfAppParam)
          } catch {
            selfApp = JSON.parse(decodeURIComponent(selfAppParam))
          }

          if (selfApp?.deeplinkCallback) {
            const callbackUrl = new URL(selfApp.deeplinkCallback)
            callbackSessionId = callbackUrl.searchParams.get("sessionId")
            callbackAccountId = callbackUrl.searchParams.get("accountId")
          }
        }
      } catch {
        callbackSessionId = null
        callbackAccountId = null
      }

      return { lastOpenedUrl, callbackSessionId, callbackAccountId }
    })

    expect(deeplinkData.lastOpenedUrl).toBeTruthy()
    expect(deeplinkData.lastOpenedUrl).toContain("redirect.self.xyz")
    expect(deeplinkData.callbackSessionId).toBeTruthy()
    expect(deeplinkData.callbackAccountId).toBe(testAccount.accountId)

    const storedSessionId = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((item) => item.startsWith("self-session-"))
      return key ? key.replace("self-session-", "") : null
    })

    expect(storedSessionId).toBe(deeplinkData.callbackSessionId)

    const sessionId = deeplinkData.callbackSessionId
    if (!sessionId) {
      throw new Error("Missing sessionId from deeplink callback")
    }

    await page.evaluate((id) => {
      localStorage.removeItem(`self-session-${id}`)
    }, sessionId)

    const verificationBody = createVerificationRequest(testAccount, signingMessage, sessionId)
    const expectedAttestationLabel = getAttestationTypeName(verificationBody.attestationId)

    const response = await page.request.post("/api/verification/verify", {
      data: verificationBody,
      headers: { "Content-Type": "application/json" },
      timeout: 120000,
    })

    const responseBody = await response.json()

    if (!response.ok()) {
      throw new Error(`Verification API failed: ${responseBody.error || response.status()}`)
    }

    expect(response.ok()).toBe(true)
    expect(responseBody.status).toBe("success")
    expect(responseBody.attestationId).toBe(verificationBody.attestationId)

    const statusRequestPromise = page.waitForRequest((request) => request.url().includes("/api/verification/status"))
    await page.goto(
      `/verification/callback?sessionId=${sessionId}&accountId=${encodeURIComponent(testAccount.accountId)}`,
    )
    const statusRequest = await statusRequestPromise
    const statusUrl = new URL(statusRequest.url())
    expect(statusUrl.searchParams.get("sessionId")).toBe(sessionId)
    expect(statusUrl.searchParams.get("accountId")).toBe(testAccount.accountId)
    await page.waitForURL(/\/verification\/start/, { timeout: 20000 })

    await expect(page.getByTestId("success-section")).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId("success-heading")).toBeVisible()
    const walletRow = page.getByTestId("wallet-verified-row")
    await expect(walletRow).toBeVisible()
    await expect(walletRow).toContainText(testAccount.accountId)
    await expect(page.getByTestId("identity-verified-row")).toBeVisible()

    const attestationBadge = page.getByTestId("attestation-badge-mobile")
    await expect(attestationBadge).toBeVisible()
    await expect(attestationBadge).toHaveText(expectedAttestationLabel)

    await expect(async () => {
      await assertVerificationInCitizensList(page, testAccount.accountId, expectedAttestationLabel)
    }).toPass({ timeout: 30000, intervals: [1000, 2000, 3000] })
  })
})
