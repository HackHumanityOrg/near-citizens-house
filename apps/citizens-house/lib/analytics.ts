"use client"

import { usePostHog } from "posthog-js/react"
import { useCallback } from "react"

export function useAnalytics() {
  const posthog = usePostHog()

  // User identification
  const identifyUser = useCallback(
    (accountId: string) => {
      posthog?.identify(accountId, {
        near_account: accountId,
      })
    },
    [posthog],
  )

  const resetUser = useCallback(() => {
    posthog?.reset()
  }, [posthog])

  // Funnel events
  const trackWalletConnected = useCallback(
    (accountId: string) => {
      identifyUser(accountId)
      posthog?.capture("wallet_connected", { account_id: accountId })
    },
    [posthog, identifyUser],
  )

  const trackWalletDisconnected = useCallback(
    (accountId: string | null, stepReached: number) => {
      posthog?.capture("wallet_disconnected", {
        account_id: accountId,
        step_reached: stepReached,
      })
      resetUser()
    },
    [posthog, resetUser],
  )

  const trackMessageSigned = useCallback(
    (accountId: string) => {
      posthog?.capture("message_signed", { account_id: accountId })
    },
    [posthog],
  )

  const trackMessageSignFailed = useCallback(
    (accountId: string, errorMessage: string) => {
      posthog?.capture("message_sign_failed", {
        account_id: accountId,
        error_message: errorMessage,
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
  const trackVerifiedAccountsViewed = useCallback(
    (pageNumber: number) => {
      posthog?.capture("verified_accounts_viewed", { page_number: pageNumber })
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
    trackVerifiedAccountsViewed,
    trackAccountDetailsViewed,
    trackSignatureVerificationOpened,
    trackZkProofDownloaded,
    trackExternalVerifierOpened,
  }
}
