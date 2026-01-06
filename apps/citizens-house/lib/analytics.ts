"use client"

import { usePostHog } from "posthog-js/react"
import { useCallback } from "react"

export function useAnalytics() {
  const posthog = usePostHog()

  // Note: User identification is handled globally by PostHogIdentifier in providers.tsx
  // This ensures all events are attributed to the connected NEAR wallet automatically

  // Funnel events
  const trackWalletConnected = useCallback(
    (accountId: string) => {
      // Identification happens automatically via PostHogIdentifier
      posthog?.capture("wallet_connected", { account_id: accountId })
    },
    [posthog],
  )

  const trackWalletDisconnected = useCallback(
    (accountId: string | null, stepReached: number) => {
      posthog?.capture("wallet_disconnected", {
        account_id: accountId,
        step_reached: stepReached,
      })
      // Reset happens automatically via PostHogIdentifier when wallet disconnects
    },
    [posthog],
  )

  const trackMessageSigned = useCallback(
    (accountId: string) => {
      posthog?.capture("message_signed", { account_id: accountId })
    },
    [posthog],
  )

  const trackMessageSignFailed = useCallback(
    (accountId: string, error: { code?: string; message: string }) => {
      posthog?.capture("message_sign_failed", {
        account_id: accountId,
        error_code: error.code || "UNKNOWN",
        error_message: error.message,
      })
    },
    [posthog],
  )

  const trackVerificationStarted = useCallback(
    (accountId: string, method: "qr" | "deeplink") => {
      posthog?.capture("verification_started", {
        account_id: accountId,
        method,
      })
    },
    [posthog],
  )

  const trackVerificationCompleted = useCallback(
    (accountId: string, method: "qr" | "deeplink") => {
      posthog?.capture("verification_completed", {
        account_id: accountId,
        verification_method: method,
      })
    },
    [posthog],
  )

  const trackVerificationFailed = useCallback(
    (accountId: string, errorCode: string, errorMessage?: string) => {
      posthog?.capture("verification_failed", {
        account_id: accountId,
        error_code: errorCode,
        error_message: errorMessage,
      })
    },
    [posthog],
  )

  // Engagement events
  const trackVerificationsViewed = useCallback(
    (pageNumber: number) => {
      posthog?.capture("verifications_viewed", { page_number: pageNumber })
    },
    [posthog],
  )

  const trackAccountDetailsViewed = useCallback(
    (viewedAccountId: string) => {
      posthog?.capture("account_details_viewed", {
        viewed_account_id: viewedAccountId,
      })
    },
    [posthog],
  )

  const trackSignatureVerificationOpened = useCallback(
    (viewedAccountId: string) => {
      posthog?.capture("signature_verification_opened", { viewed_account_id: viewedAccountId })
    },
    [posthog],
  )

  const trackZkProofDownloaded = useCallback(
    (viewedAccountId: string, fileType: string) => {
      posthog?.capture("zk_proof_downloaded", {
        viewed_account_id: viewedAccountId,
        file_type: fileType,
      })
    },
    [posthog],
  )

  const trackExternalVerifierOpened = useCallback(
    (verifierType: "cyphr" | "snarkjs") => {
      posthog?.capture("external_verifier_opened", { verifier_type: verifierType })
    },
    [posthog],
  )

  // New engagement events
  const trackVerificationPageViewed = useCallback(() => {
    posthog?.capture("verification_page_viewed", {
      page_url: typeof window !== "undefined" ? window.location.href : "",
    })
  }, [posthog])

  const trackQrCodeDisplayed = useCallback(
    (accountId: string, method: "qr" | "deeplink") => {
      posthog?.capture("qr_code_displayed", {
        account_id: accountId,
        display_method: method,
      })
    },
    [posthog],
  )

  const trackDeeplinkOpened = useCallback(
    (accountId: string) => {
      posthog?.capture("deeplink_opened", {
        account_id: accountId,
        user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "",
      })
    },
    [posthog],
  )

  return {
    // Funnel events
    trackWalletConnected,
    trackWalletDisconnected,
    trackMessageSigned,
    trackMessageSignFailed,
    trackVerificationStarted,
    trackVerificationCompleted,
    trackVerificationFailed,
    // Engagement events
    trackVerificationsViewed,
    trackAccountDetailsViewed,
    trackSignatureVerificationOpened,
    trackZkProofDownloaded,
    trackExternalVerifierOpened,
    trackVerificationPageViewed,
    trackQrCodeDisplayed,
    trackDeeplinkOpened,
  }
}
