"use client"

import { useEffect, useState, Suspense, useRef, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAnalytics } from "@/lib/analytics"
import { clientLogger } from "@/lib/logger-client"
import { LogScope, Op } from "@/lib/logger"
import { Loader2 } from "lucide-react"
import { getErrorTitle, getErrorMessage, isNonRetryableError } from "@/lib/verification-errors"
import { StarPattern } from "@/components/verification/icons/star-pattern"

type VerificationStatus = "checking" | "success" | "error" | "expired"

function VerifyCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get("sessionId")
  const analytics = useAnalytics()
  const [status, setStatus] = useState<VerificationStatus>("checking")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const trackedResultRef = useRef(false)

  const logContext = useMemo(
    () => ({
      scope: LogScope.VERIFICATION,
      component: "verification.callback",
      session_id: sessionId ?? undefined,
    }),
    [sessionId],
  )

  // Track verification result when status changes
  useEffect(() => {
    if (trackedResultRef.current) return

    if (status === "success" && accountId) {
      analytics.trackVerificationCompleted(accountId, "deeplink")
      clientLogger.info("Verification callback completed", {
        ...logContext,
        operation: Op.VERIFICATION.CALLBACK_RESULT,
        account_id: accountId,
        status,
      })
      trackedResultRef.current = true
    } else if (status === "error" || status === "expired") {
      // Get accountId from localStorage if available
      const storedSession = sessionId ? localStorage.getItem(`self-session-${sessionId}`) : null
      const storedAccountId = storedSession ? JSON.parse(storedSession).accountId : "unknown"
      // Use actual error code if available, fallback to generic codes
      const trackingErrorCode = errorCode || (status === "expired" ? "TIMEOUT" : "VERIFICATION_FAILED")
      analytics.trackVerificationFailed(storedAccountId, trackingErrorCode, errorMessage || undefined)
      clientLogger.warn("Verification callback failed", {
        ...logContext,
        operation: Op.VERIFICATION.CALLBACK_RESULT,
        account_id: storedAccountId,
        status,
        error_code: trackingErrorCode,
        error_message: errorMessage ?? undefined,
      })
      trackedResultRef.current = true
    }
  }, [status, accountId, sessionId, errorMessage, errorCode, analytics, logContext])

  useEffect(() => {
    if (!sessionId) {
      clientLogger.warn("Missing sessionId in verification callback", {
        ...logContext,
        operation: Op.VERIFICATION.CALLBACK_INIT,
      })
      setStatus("error")
      setErrorMessage("Invalid callback URL - missing session ID")
      return
    }

    // Track mounted state, abort controller, and timeout for cleanup
    let isMounted = true
    let abortController: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    /**
     * Check verification status with abort support.
     * Returns early without updating state if aborted or unmounted.
     */
    const checkVerificationStatus = async (): Promise<boolean> => {
      // Create new abort controller for this request
      abortController = new AbortController()

      try {
        const response = await fetch(`/api/verification/status?sessionId=${encodeURIComponent(sessionId)}`, {
          signal: abortController.signal,
        })

        // Check mounted before processing response
        if (!isMounted) return false

        // Handle non-OK responses explicitly
        if (!response.ok) {
          // 404 during grace period: session may not exist yet (race condition)
          // The verify endpoint creates the session after processing, but the callback
          // page may load and start polling before that completes. Allow up to 15 polls
          // (30 seconds) before treating 404 as terminal.
          const GRACE_PERIOD_POLLS = 15
          if (response.status === 404 && pollCount < GRACE_PERIOD_POLLS) {
            clientLogger.debug("Verification session not found yet, retrying", {
              ...logContext,
              operation: Op.VERIFICATION.CALLBACK_POLL,
              poll_count: pollCount + 1,
              grace_period_polls: GRACE_PERIOD_POLLS,
              status_code: response.status,
            })
            return false // Continue polling
          }
          // Other 4xx = client error (invalid/expired session) - terminal, stop polling
          if (response.status >= 400 && response.status < 500) {
            clientLogger.warn("Verification status API client error", {
              ...logContext,
              operation: Op.VERIFICATION.CALLBACK_POLL,
              status_code: response.status,
            })
            setStatus("error")
            setErrorMessage("Invalid or expired verification session. Please try again.")
            return true
          }
          // 5xx = server error - keep retrying
          clientLogger.error("Verification status API server error", {
            ...logContext,
            operation: Op.VERIFICATION.CALLBACK_POLL,
            status_code: response.status,
          })
          return false
        }

        const data = await response.json()

        // Check mounted again before updating state
        if (!isMounted) return false

        if (data.status === "success") {
          setStatus("success")
          setAccountId(data.accountId)
          // Clean up localStorage (wrapped in try/catch for restricted environments)
          try {
            localStorage.removeItem(`self-session-${sessionId}`)
          } catch {
            // Ignore storage errors (e.g., incognito mode, storage disabled)
          }
          return true
        } else if (data.status === "error") {
          setStatus("error")
          // Use errorCode if available, fall back to error field for backwards compatibility
          const code = data.errorCode || data.error
          setErrorCode(code)
          setErrorMessage(getErrorMessage(code))
          return true
        } else if (data.status === "expired") {
          setStatus("expired")
          setErrorMessage("Session expired. Please try again.")
          return true
        }
        // Still pending
        return false
      } catch (error) {
        // Ignore abort errors, don't update state
        if (error instanceof Error && error.name === "AbortError") {
          return false
        }
        // Log unexpected errors for debugging
        const errorDetails =
          error instanceof Error
            ? { error_type: error.name, error_message: error.message, error_stack: error.stack }
            : { error_message: String(error) }
        clientLogger.error("Verification callback polling error", {
          ...logContext,
          operation: Op.VERIFICATION.CALLBACK_POLL,
          ...errorDetails,
        })
        // Network error - keep polling (but only if still mounted)
        return false
      }
    }

    // Poll for verification status
    let pollCount = 0
    const maxPolls = 60 // 60 * 2s = 2 minutes max

    const poll = async () => {
      if (!isMounted) return

      const done = await checkVerificationStatus()
      if (!isMounted || done) return

      pollCount++
      if (pollCount >= maxPolls) {
        if (isMounted) {
          setStatus("expired")
          setErrorMessage("Verification timed out. Please try again.")
        }
        return
      }

      // Continue polling
      timeoutId = setTimeout(poll, 2000)
    }

    poll()

    // Cleanup: abort pending fetch and clear timeout to prevent state updates after unmount
    return () => {
      isMounted = false
      if (abortController) {
        abortController.abort()
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }, [sessionId, logContext])

  // Auto-redirect on success (skip the intermediate "Continue" screen)
  useEffect(() => {
    if (status === "success" && accountId) {
      router.push(`/verification/start?status=success&sessionId=${sessionId}`)
    }
  }, [status, accountId, sessionId, router])

  const handleTryAgain = () => {
    const params = new URLSearchParams({
      status: "error",
      error: errorMessage || "Unknown error",
    })
    if (errorCode) {
      params.set("errorCode", errorCode)
    }
    router.push(`/verification/start?${params.toString()}`)
  }

  const handleGoHome = () => {
    router.push("/")
  }

  return (
    <div className="w-full">
      {/* Hero Section with gradient background */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.5)_0%,_rgba(253,221,57,0.4)_20%,_rgba(249,230,136,0.3)_40%,_rgba(245,236,189,0.15)_60%,_rgba(242,242,242,0.05)_80%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.3)_0%,_rgba(253,221,57,0.2)_20%,_rgba(249,230,136,0.15)_40%,_transparent_70%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="callbackStar" />
        </div>

        {/* Stepper - shows step 2 active */}
        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              {/* Step 1 circle - completed */}
              <div className="col-start-1 row-start-1 flex items-center justify-center">
                <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full size-[40px]">
                  <svg
                    className="w-5 h-5 text-white dark:text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Connecting line */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black dark:bg-white/40" />
              </div>

              {/* Step 2 circle - active */}
              <div className="col-start-3 row-start-1 flex items-center justify-center">
                <div className="border-2 border-black dark:border-white bg-white dark:bg-black flex items-center justify-center rounded-full size-[40px]">
                  <span className="font-fk-grotesk font-medium md:font-bold text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    2
                  </span>
                </div>
              </div>

              {/* Labels */}
              <span className="col-start-1 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-verified whitespace-nowrap text-center">
                NEAR Wallet Verified
              </span>
              <span className="col-start-3 row-start-2 justify-self-center font-fk-grotesk md:font-bold text-[16px] md:text-[20px] leading-[28px] text-[#090909] dark:text-white whitespace-nowrap text-center">
                Verify Identity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4">
        <div className="flex flex-col items-start w-full max-w-[650px]">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center py-[40px] px-4 md:px-0 w-full">
            {/* Checking Status */}
            {status === "checking" && (
              <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
                <Loader2 className="h-16 w-16 animate-spin text-[#FFDA1E]" />
                <div className="flex flex-col items-center gap-4 text-center">
                  <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] text-[#090909] dark:text-white font-fk-grotesk font-medium">
                    Verifying...
                  </h1>
                  <p className="text-[16px] leading-[28px] text-[#090909] dark:text-neutral-200 font-fk-grotesk">
                    Please wait while we complete your verification
                  </p>
                  <p className="text-[14px] leading-[20px] text-[#757575] dark:text-neutral-400 font-fk-grotesk">
                    This may take a few moments. Do not close this page.
                  </p>
                </div>
              </div>
            )}

            {/* Error/Expired Status */}
            {(status === "error" || status === "expired") && (
              <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
                {/* Error Icon */}
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(239,68,68,0.15)]">
                  <svg className="w-8 h-8 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>

                <div className="flex flex-col items-center gap-4 text-center w-full">
                  <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] text-[#090909] dark:text-white font-fk-grotesk font-medium">
                    {getErrorTitle(errorCode)}
                  </h1>
                  <p className="text-[16px] leading-[28px] text-[#090909] dark:text-neutral-200 font-fk-grotesk">
                    {isNonRetryableError(errorCode)
                      ? "This verification cannot be completed"
                      : "There was an issue with your verification"}
                  </p>

                  {/* Error Message */}
                  <div className="w-full bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded-[8px] p-4 mt-2">
                    <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-[24px] text-[#ef4444] dark:text-[#f87171] font-fk-grotesk">
                      {errorMessage || "An unexpected error occurred"}
                    </p>
                  </div>

                  {/* Action Button */}
                  {isNonRetryableError(errorCode) ? (
                    <button
                      onClick={handleGoHome}
                      className="mt-4 w-full bg-[#040404] dark:bg-white text-[#d8d8d8] dark:text-[#040404] h-[56px] px-6 rounded-[4px] font-fk-grotesk font-medium text-[16px] leading-[20px] cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      Back to Home
                    </button>
                  ) : (
                    <button
                      onClick={handleTryAgain}
                      className="mt-4 w-full bg-[#040404] dark:bg-white text-[#d8d8d8] dark:text-[#040404] h-[56px] px-6 rounded-[4px] font-fk-grotesk font-medium text-[16px] leading-[20px] cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="w-full">
      {/* Hero Section with gradient background */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.5)_0%,_rgba(253,221,57,0.4)_20%,_rgba(249,230,136,0.3)_40%,_rgba(245,236,189,0.15)_60%,_rgba(242,242,242,0.05)_80%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.3)_0%,_rgba(253,221,57,0.2)_20%,_rgba(249,230,136,0.15)_40%,_transparent_70%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="callbackLoadingStar" />
        </div>

        {/* Stepper skeleton - shows step 2 active */}
        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              {/* Step 1 circle - completed */}
              <div className="col-start-1 row-start-1 flex items-center justify-center">
                <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full size-[40px]">
                  <svg
                    className="w-5 h-5 text-white dark:text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              {/* Connecting line */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black dark:bg-white/40" />
              </div>

              {/* Step 2 circle - active */}
              <div className="col-start-3 row-start-1 flex items-center justify-center">
                <div className="border-2 border-black dark:border-white bg-white dark:bg-black flex items-center justify-center rounded-full size-[40px]">
                  <span className="font-fk-grotesk font-medium md:font-bold text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    2
                  </span>
                </div>
              </div>

              {/* Labels */}
              <span className="col-start-1 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-verified whitespace-nowrap text-center">
                NEAR Wallet Verified
              </span>
              <span className="col-start-3 row-start-2 justify-self-center font-fk-grotesk md:font-bold text-[16px] md:text-[20px] leading-[28px] text-[#090909] dark:text-white whitespace-nowrap text-center">
                Verify Identity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4">
        <div className="flex flex-col items-start w-full max-w-[650px]">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center py-[40px] px-4 md:px-0 w-full">
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="h-16 w-16 animate-spin text-[#FFDA1E]" />
              <div className="flex flex-col items-center gap-4 text-center max-w-[520px]">
                <h1 className="text-[24px] md:text-[28px] leading-[32px] md:leading-[36px] text-[#090909] dark:text-white font-fk-grotesk font-medium">
                  Verifying...
                </h1>
                <p className="text-[16px] leading-[28px] text-[#090909] dark:text-neutral-200 font-fk-grotesk">
                  Please wait while we complete your verification
                </p>
                <p className="text-[14px] leading-[20px] text-[#757575] dark:text-neutral-400 font-fk-grotesk">
                  This may take a few moments. Do not close this page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyCallbackContent />
    </Suspense>
  )
}
