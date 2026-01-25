"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import dynamic from "next/dynamic"
import { type NearSignatureData } from "@/lib"
import { trackEvent } from "@/lib/analytics"
import {
  sumsubTokenResponseSchema,
  verificationStatusResponseSchema,
  type SumSubWebSdkProps,
  type SumSubWebSdkPayload,
  type SumSubApplicantStatusChangedPayload,
  type VerificationStepState,
  type VerificationErrorCode,
} from "@/lib/schemas"
import { Loader2, Info, Ban, Check, Shield } from "lucide-react"
import { StarPattern } from "../icons/star-pattern"
import { useDebugRegistration } from "@/lib/hooks/use-debug-registration"

// Dynamic import of SumSub WebSDK to avoid SSR issues
// The @sumsub/websdk-react package doesn't ship TypeScript definitions
const SumSubWebSdk = dynamic<SumSubWebSdkProps>(
  () =>
    import("@sumsub/websdk-react").then((mod) => {
      // Cast required as package lacks TypeScript definitions
      const Component = mod.default as React.ComponentType<SumSubWebSdkProps>
      return Component
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 animate-spin text-[#ffda1e]" />
      </div>
    ),
  },
)

interface Step2SumSubProps {
  nearSignature: NearSignatureData
  onSuccess: () => void
  onError: (code: VerificationErrorCode) => void
}

export function Step2SumSub({ nearSignature, onSuccess, onError }: Step2SumSubProps) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStepState>("loading")
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const confirmationInProgressRef = useRef(false)

  // Debug mode state override
  const handleDebugStateChange = useCallback(
    (state: string) => {
      const validStates = ["loading", "ready", "verifying", "polling", "success", "error"] as const
      if (validStates.includes(state as (typeof validStates)[number])) {
        setVerificationStatus(state as (typeof validStates)[number])
        // If switching to ready or verifying, set a mock token
        if ((state === "ready" || state === "verifying") && !accessToken) {
          setAccessToken("debug-token")
        }
        // If success, trigger the onSuccess callback
        if (state === "success") {
          onSuccess()
        }
      }
    },
    [accessToken, onSuccess],
  )

  // Register with debug context
  const debugStates = useMemo(() => ["loading", "ready", "verifying", "polling", "success", "error"], [])

  useDebugRegistration({
    id: "step2-sumsub",
    name: "Step 2: SumSub",
    availableStates: debugStates,
    currentState: verificationStatus,
    onStateChange: handleDebugStateChange,
  })

  // Fetch access token on mount
  const fetchAccessToken = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch("/api/verification/sumsub/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nearSignature: {
            accountId: nearSignature.accountId,
            signature: nearSignature.signature,
            publicKey: nearSignature.publicKey,
            nonce: nearSignature.nonce,
            timestamp: nearSignature.timestamp,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to get access token: ${errorText}`)
      }

      const data = await response.json()
      const parsed = sumsubTokenResponseSchema.safeParse(data)

      if (!parsed.success) {
        throw new Error("Invalid token response")
      }

      return parsed.data.token
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize verification"
      throw new Error(message)
    }
  }, [nearSignature])

  // Initial token fetch
  useEffect(() => {
    let mounted = true

    const initToken = async () => {
      try {
        const token = await fetchAccessToken()
        if (mounted) {
          setAccessToken(token)
          setVerificationStatus("ready")
          trackEvent({
            domain: "verification",
            action: "sumsub_sdk_loaded",
            accountId: nearSignature.accountId,
          })
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "Failed to initialize"
          setTokenError(message)
          setVerificationStatus("error")
          onError("TOKEN_FETCH_FAILED")
        }
      }
    }

    void initToken()

    return () => {
      mounted = false
    }
  }, [fetchAccessToken, nearSignature.accountId, onError])

  // Token refresh handler for SumSub SDK
  const handleExpirationRefresh = useCallback(async (): Promise<string> => {
    try {
      const token = await fetchAccessToken()
      setAccessToken(token)
      return token
    } catch {
      // Return empty string on failure - SDK will handle the error
      return ""
    }
  }, [fetchAccessToken])

  // Poll for backend status confirmation by checking status endpoint
  const confirmBackendStatus = useCallback(async () => {
    const maxPolls = 60 // 2 minutes at 2s interval
    const pollIntervalMs = 2000

    trackEvent({
      domain: "verification",
      action: "polling_started",
      accountId: nearSignature.accountId,
    })

    for (let pollCount = 0; pollCount < maxPolls; pollCount++) {
      try {
        const response = await fetch(
          `/api/verification/status?accountId=${encodeURIComponent(nearSignature.accountId)}`,
        )
        const rawData = await response.json()
        const parsed = verificationStatusResponseSchema.safeParse(rawData)
        if (!parsed.success) {
          console.error("Invalid status response", parsed.error)
          // Continue polling on invalid response
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
          continue
        }
        const data = parsed.data

        switch (data.status) {
          case "APPROVED":
            confirmationInProgressRef.current = false
            setVerificationStatus("success")
            onSuccess()
            return

          case "ON_HOLD":
            // Route to StepHold via onError callback
            trackEvent({
              domain: "verification",
              action: "manual_review_shown",
              accountId: nearSignature.accountId,
            })
            confirmationInProgressRef.current = false
            onError("VERIFICATION_ON_HOLD")
            return

          case "REJECTED":
            confirmationInProgressRef.current = false
            setVerificationStatus("error")
            onError("VERIFICATION_REJECTED")
            return

          case "RETRY":
            confirmationInProgressRef.current = false
            setVerificationStatus("error")
            onError("VERIFICATION_RETRY")
            return

          case "DUPLICATE_IDENTITY":
            confirmationInProgressRef.current = false
            setVerificationStatus("error")
            onError("DUPLICATE_IDENTITY")
            return

          case "ACCOUNT_ALREADY_VERIFIED":
            confirmationInProgressRef.current = false
            setVerificationStatus("error")
            onError("ACCOUNT_ALREADY_VERIFIED")
            return

          case "CONTRACT_PAUSED":
            confirmationInProgressRef.current = false
            setVerificationStatus("error")
            onError("CONTRACT_PAUSED")
            return

          case "NOT_FOUND":
            // Continue polling - still waiting for webhook
            break
        }
      } catch {
        // Network error, continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    // Timeout - check one more time for ON_HOLD status
    try {
      const finalResponse = await fetch(
        `/api/verification/status?accountId=${encodeURIComponent(nearSignature.accountId)}`,
      )
      const finalRawData = await finalResponse.json()
      const finalParsed = verificationStatusResponseSchema.safeParse(finalRawData)

      if (finalParsed.success && finalParsed.data.status === "ON_HOLD") {
        trackEvent({
          domain: "verification",
          action: "manual_review_shown",
          accountId: nearSignature.accountId,
        })
        confirmationInProgressRef.current = false
        onError("VERIFICATION_ON_HOLD")
        return
      }
    } catch {
      // Ignore final check errors
    }

    // Timeout
    trackEvent({
      domain: "verification",
      action: "polling_timeout",
      accountId: nearSignature.accountId,
      pollCount: maxPolls,
    })
    confirmationInProgressRef.current = false
    setVerificationStatus("error")
    onError("TIMEOUT")
  }, [nearSignature.accountId, onSuccess, onError])

  // Handle SumSub SDK messages
  const handleMessage = useCallback(
    (type: string, payload: SumSubWebSdkPayload) => {
      trackEvent({
        domain: "verification",
        action: "sumsub_message",
        accountId: nearSignature.accountId,
        messageType: type,
      })

      // Handle different message types from SumSub SDK
      if (type === "idCheck.onApplicantLoaded") {
        setVerificationStatus("verifying")
      }

      // Applicant submitted their documents or status changed - handle based on review result
      if (
        type === "idCheck.onApplicantSubmitted" ||
        type === "idCheck.applicantStatus" ||
        type === "idCheck.onApplicantStatusChanged"
      ) {
        const status = payload as SumSubApplicantStatusChangedPayload | undefined
        const reviewAnswer = status?.reviewResult?.reviewAnswer

        // Handle immediate rejection from SumSub (duplicate detection, etc.)
        // NOTE: SDK message doesn't include rejectLabels, so we show generic rejection
        // The webhook will set the specific error code (DUPLICATE_IDENTITY, etc.) in Redis
        if (reviewAnswer === "RED") {
          trackEvent({
            domain: "verification",
            action: "sumsub_rejected",
            accountId: nearSignature.accountId,
            reviewAnswer,
          })
          confirmationInProgressRef.current = false
          setVerificationStatus("error")
          onError("VERIFICATION_REJECTED")
          return
        }

        // Handle manual review needed
        if (reviewAnswer === "YELLOW") {
          trackEvent({
            domain: "verification",
            action: "manual_review_shown",
            accountId: nearSignature.accountId,
            reviewAnswer,
          })
          confirmationInProgressRef.current = false
          onError("VERIFICATION_ON_HOLD")
          return
        }

        // Only poll for GREEN results or when reviewStatus is "completed" without a clear answer
        // The "reviewStatus completed without reviewAnswer" case handles edge cases where
        // SumSub sends completion without explicit answer (legacy behavior)
        if (reviewAnswer === "GREEN" || (status?.reviewStatus === "completed" && !reviewAnswer)) {
          if (!confirmationInProgressRef.current) {
            confirmationInProgressRef.current = true
            setVerificationStatus("polling")
            void confirmBackendStatus()
          }
        }
      }
    },
    [nearSignature.accountId, confirmBackendStatus, onError],
  )

  // Handle SumSub SDK errors
  const handleSdkError = useCallback(
    (error: Error) => {
      trackEvent({
        domain: "verification",
        action: "sumsub_error",
        accountId: nearSignature.accountId,
        errorMessage: error.message,
      })
      // Don't immediately fail - SDK might recover
      console.error("SumSub SDK error:", error)
    },
    [nearSignature.accountId],
  )

  return (
    <div className="w-full" data-testid="step2-section">
      {/* Hero Section with gradient background */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        {/* Star pattern */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="step2Star" />
        </div>

        {/* Step indicator */}
        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              {/* Step 1 circle - completed */}
              <div
                className="col-start-1 row-start-1 flex items-center justify-center"
                data-testid="step2-indicator-completed"
                data-step-state="completed"
              >
                <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full size-[40px]">
                  <Check className="w-5 h-5 text-white dark:text-black" strokeWidth={3} />
                </div>
              </div>

              {/* Connecting line */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black dark:bg-white/40" />
              </div>

              {/* Step 2 circle - active */}
              <div
                className="col-start-3 row-start-1 flex items-center justify-center"
                data-testid="step2-indicator-active"
                data-step-state="active"
              >
                <div className="border-2 border-[#090909] dark:border-white bg-white dark:bg-black flex items-center justify-center rounded-full size-[40px]">
                  <span className="font-fk-grotesk font-bold text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    2
                  </span>
                </div>
              </div>

              {/* Labels row */}
              <span
                data-testid="step2-label-1"
                className="col-start-1 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-verified whitespace-nowrap text-center"
              >
                NEAR Wallet Verified
              </span>
              <span
                data-testid="step2-label-2"
                className="col-start-3 row-start-2 justify-self-center font-fk-grotesk font-bold text-[16px] md:text-[20px] leading-[28px] text-[#090909] dark:text-white whitespace-nowrap text-center"
              >
                Verify Identity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4 md:px-6">
        <div className="flex flex-col items-center w-full">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center p-0 md:p-[40px] w-full max-w-[1032px] overflow-hidden">
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col md:flex-row items-start justify-center w-full gap-[36px] md:gap-[40px]">
                {/* Left Column: SumSub SDK */}
                <div className="flex flex-col gap-[16px] items-start pt-[40px] md:pt-0 w-full md:flex-1 px-[24px] md:px-0">
                  {verificationStatus === "loading" && (
                    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
                      <Loader2 className="h-12 w-12 animate-spin text-[#ffda1e]" />
                      <p className="mt-4 font-fk-grotesk text-[16px] text-[#757575]">Initializing verification...</p>
                    </div>
                  )}

                  {tokenError && (
                    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
                      <Ban className="h-12 w-12 text-red-500" />
                      <p className="mt-4 font-fk-grotesk text-[16px] text-red-500">{tokenError}</p>
                    </div>
                  )}

                  {accessToken && verificationStatus !== "loading" && (
                    <div className="w-full min-h-[400px]" data-testid="sumsub-sdk-container">
                      <SumSubWebSdk
                        accessToken={accessToken}
                        expirationHandler={handleExpirationRefresh}
                        config={{
                          lang: "en",
                          theme: "light",
                        }}
                        options={{
                          addViewportTag: false,
                          adaptIframeHeight: true,
                        }}
                        onMessage={handleMessage}
                        onError={handleSdkError}
                      />
                    </div>
                  )}

                  {verificationStatus === "polling" && (
                    <div className="mt-[16px] flex items-center gap-[8px] text-[14px] text-[#757575] dark:text-[#a3a3a3]">
                      <Loader2 className="h-[16px] w-[16px] animate-spin" />
                      <span className="font-fk-grotesk">Finalizing verification on-chain...</span>
                    </div>
                  )}
                </div>

                {/* Right Column: Instructions Panel */}
                <div className="bg-[#f8fafc] dark:bg-white/5 w-full md:w-[503px] p-[20px] px-[40px] md:p-[40px] md:rounded-[16px] flex flex-col gap-[24px] items-center">
                  {/* How to verify */}
                  <div className="flex flex-col gap-[16px] items-start w-full">
                    <p
                      className="font-fk-grotesk font-medium text-[24px] leading-[32px] text-black dark:text-white"
                      data-testid="how-to-verify-heading"
                    >
                      How to verify?
                    </p>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200">
                      Complete the identity verification steps on the left:
                    </p>
                  </div>

                  {/* Numbered Steps */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[12px] items-start leading-[28px] text-[16px]">
                      <span className="font-fk-grotesk font-medium text-[#090909] dark:text-white flex-shrink-0">
                        01
                      </span>
                      <span className="font-fk-grotesk text-black dark:text-neutral-200">
                        Take a photo of your government-issued ID
                      </span>
                    </div>
                    <div className="flex gap-[12px] items-start leading-[28px] text-[16px]">
                      <span className="font-fk-grotesk font-medium text-[#090909] dark:text-white flex-shrink-0">
                        02
                      </span>
                      <span className="font-fk-grotesk text-black dark:text-neutral-200">
                        Complete a quick selfie check for liveness verification
                      </span>
                    </div>
                    <div className="flex gap-[12px] items-start leading-[28px] text-[16px]">
                      <span className="font-fk-grotesk font-medium text-[#090909] dark:text-white flex-shrink-0">
                        03
                      </span>
                      <span className="font-fk-grotesk text-black dark:text-neutral-200">
                        Wait for verification to complete (usually instant)
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px w-full bg-black dark:bg-white/10" />

                  {/* Privacy Info */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[8px] items-center">
                      <Shield className="w-[22px] h-[22px] text-black dark:text-white flex-shrink-0" />
                      <span className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-black dark:text-white">
                        Your Privacy is Protected
                      </span>
                    </div>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#757575] dark:text-[#a3a3a3]">
                      Your ID documents are processed securely and only a verification status is stored on-chain. Your
                      personal information is never stored on the blockchain.
                    </p>
                  </div>

                  {/* Accepted Documents */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[8px] items-center">
                      <Info className="w-[22px] h-[22px] text-black dark:text-white flex-shrink-0" />
                      <span className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-black dark:text-white">
                        Accepted Documents
                      </span>
                    </div>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#757575] dark:text-[#a3a3a3]">
                      Passport, Driver&apos;s License, National ID Card, or Residence Permit from most countries.
                    </p>
                  </div>

                  {/* Failed Verification Info */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[8px] items-center">
                      <Ban className="w-[22px] h-[22px] text-black dark:text-white flex-shrink-0" />
                      <span className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-black dark:text-white">
                        Verification Failed?
                      </span>
                    </div>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#757575] dark:text-[#a3a3a3]">
                      If verification fails, ensure your document is clearly visible, not expired, and that you&apos;re
                      in good lighting for the selfie check.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
