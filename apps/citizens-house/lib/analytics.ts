"use client"

import { usePostHog } from "posthog-js/react"
import { useCallback } from "react"
import { AnalyticsProperties } from "./analytics-schema"

export function useAnalytics() {
  const posthog = usePostHog()

  // Note: User identification is handled globally by PostHogIdentifier in providers.tsx
  // This ensures all events are attributed to the connected NEAR wallet automatically

  // Funnel events
  const trackWalletConnected = useCallback(
    (accountId: string) => {
      // Identification happens automatically via PostHogIdentifier
      posthog?.capture("wallet_connected", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackWalletDisconnected = useCallback(
    (accountId: string | null, stepReached: string) => {
      posthog?.capture("wallet_disconnected", {
        ...(accountId ? { [AnalyticsProperties.accountId]: accountId } : {}),
        [AnalyticsProperties.stepReached]: stepReached,
        [AnalyticsProperties.trackingSource]: "client",
      })
      // Reset happens automatically via PostHogIdentifier when wallet disconnects
    },
    [posthog],
  )

  const trackMessageSigned = useCallback(
    (accountId: string) => {
      posthog?.capture("message_signed", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackMessageSignFailed = useCallback(
    (accountId: string, error: { code?: string; message: string }) => {
      posthog?.capture("message_sign_failed", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.errorCode]: error.code || "UNKNOWN",
        [AnalyticsProperties.errorMessage]: error.message,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackVerificationStarted = useCallback(
    (accountId: string, method: "qr" | "deeplink") => {
      posthog?.capture("verification_started", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.verificationMethod]: method,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackVerificationCompleted = useCallback(
    (accountId: string, method: "qr" | "deeplink") => {
      posthog?.capture("verification_completed", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.verificationMethod]: method,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackVerificationFailed = useCallback(
    (accountId: string, errorCode: string, errorMessage?: string) => {
      posthog?.capture("verification_failed", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.errorCode]: errorCode,
        [AnalyticsProperties.errorMessage]: errorMessage,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  // Engagement events
  const trackVerificationsViewed = useCallback(
    (pageNumber: number) => {
      posthog?.capture("verifications_viewed", {
        [AnalyticsProperties.pageNumber]: pageNumber,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackAccountDetailsViewed = useCallback(
    (viewedAccountId: string) => {
      posthog?.capture("account_details_viewed", {
        [AnalyticsProperties.viewedAccountId]: viewedAccountId,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackSignatureVerificationOpened = useCallback(
    (viewedAccountId: string) => {
      posthog?.capture("signature_verification_opened", {
        [AnalyticsProperties.viewedAccountId]: viewedAccountId,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackZkProofDownloaded = useCallback(
    (viewedAccountId: string, fileType: string) => {
      posthog?.capture("zk_proof_downloaded", {
        [AnalyticsProperties.viewedAccountId]: viewedAccountId,
        [AnalyticsProperties.fileType]: fileType,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackExternalVerifierOpened = useCallback(
    (verifierType: "cyphr" | "snarkjs") => {
      posthog?.capture("external_verifier_opened", {
        [AnalyticsProperties.verifierType]: verifierType,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  // New engagement events
  const trackVerificationPageViewed = useCallback(() => {
    posthog?.capture("verification_page_viewed", {
      [AnalyticsProperties.pageUrl]: typeof window !== "undefined" ? window.location.href : "",
      [AnalyticsProperties.trackingSource]: "client",
    })
  }, [posthog])

  const trackQrCodeDisplayed = useCallback(
    (accountId: string, method: "qr" | "deeplink") => {
      posthog?.capture("qr_code_displayed", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.displayMethod]: method,
        [AnalyticsProperties.trackingSource]: "client",
      })
    },
    [posthog],
  )

  const trackDeeplinkOpened = useCallback(
    (accountId: string) => {
      posthog?.capture("deeplink_opened", {
        [AnalyticsProperties.accountId]: accountId,
        [AnalyticsProperties.userAgent]: typeof window !== "undefined" ? window.navigator.userAgent : "",
        [AnalyticsProperties.trackingSource]: "client",
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
