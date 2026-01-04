"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAnalytics } from "@/lib/analytics"
import { Loader2 } from "lucide-react"
import { VERIFICATION_ERROR_MESSAGES, type VerificationErrorCode } from "@near-citizens/shared"

function getErrorMessage(errorCode: string | null): string {
  if (!errorCode) return "An unexpected error occurred. Please try again."
  // Check if it's a known error code
  if (errorCode in VERIFICATION_ERROR_MESSAGES) {
    return VERIFICATION_ERROR_MESSAGES[errorCode as VerificationErrorCode]
  }
  return errorCode
}

type VerificationStatus = "checking" | "success" | "error" | "expired"

function VerifyCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get("sessionId")
  const analytics = useAnalytics()
  const [status, setStatus] = useState<VerificationStatus>("checking")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const trackedResultRef = useRef(false)

  // Track verification result when status changes
  useEffect(() => {
    if (trackedResultRef.current) return

    if (status === "success" && accountId) {
      analytics.trackVerificationCompleted(accountId, "deeplink")
      trackedResultRef.current = true
    } else if (status === "error" || status === "expired") {
      // Get accountId from localStorage if available
      const storedSession = sessionId ? localStorage.getItem(`self-session-${sessionId}`) : null
      const storedAccountId = storedSession ? JSON.parse(storedSession).accountId : "unknown"
      const errorCode = status === "expired" ? "TIMEOUT" : "VERIFICATION_FAILED"
      analytics.trackVerificationFailed(storedAccountId, errorCode, errorMessage || undefined)
      trackedResultRef.current = true
    }
  }, [status, accountId, sessionId, errorMessage, analytics])

  useEffect(() => {
    if (!sessionId) {
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
            console.log(
              `[VerifyCallback] Session not found yet (poll ${pollCount + 1}/${GRACE_PERIOD_POLLS}), retrying...`,
            )
            return false // Continue polling
          }
          // Other 4xx = client error (invalid/expired session) - terminal, stop polling
          if (response.status >= 400 && response.status < 500) {
            setStatus("error")
            setErrorMessage("Invalid or expired verification session. Please try again.")
            return true
          }
          // 5xx = server error - keep retrying
          console.error(`[VerifyCallback] Server error: ${response.status}`)
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
          setErrorMessage(getErrorMessage(data.error))
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
        console.error("[VerifyCallback] Polling error:", error)
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
  }, [sessionId])

  const handleContinue = () => {
    router.push(`/verification/start?status=success&sessionId=${sessionId}`)
  }

  const handleTryAgain = () => {
    router.push(`/verification/start?status=error&error=${encodeURIComponent(errorMessage || "Unknown error")}`)
  }

  return (
    <div className="min-h-screen bg-[#f2f2f2] dark:bg-neutral-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[650px]">
        {/* Checking Status */}
        {status === "checking" && (
          <div className="bg-white dark:bg-neutral-800 border border-[rgba(0,0,0,0.1)] dark:border-neutral-700 py-10 px-6 sm:px-10">
            <div className="flex flex-col items-center gap-6">
              <Loader2 className="h-16 w-16 animate-spin text-[#00ec97]" />
              <div className="flex flex-col items-center gap-4 text-center">
                <h1 className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-[#111] dark:text-white font-fk-grotesk font-medium">
                  Verifying...
                </h1>
                <p className="text-[16px] sm:text-[18px] leading-[24px] sm:leading-[28px] text-black dark:text-neutral-200">
                  Please wait while we complete your verification
                </p>
                <p className="text-[14px] leading-[20px] text-[#757575] dark:text-[#a3a3a3] mt-2">
                  This may take a few moments. Do not close this page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success Status */}
        {status === "success" && (
          <div className="bg-white dark:bg-neutral-800 border border-[rgba(0,0,0,0.1)] dark:border-neutral-700 py-10 px-6 sm:px-10">
            <div className="flex flex-col items-center gap-6">
              {/* Success Icon */}
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(0,236,151,0.15)]">
                <svg
                  className="w-8 h-8 text-[#00ec97]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="flex flex-col items-center gap-4 text-center w-full">
                <h1 className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-[#111] dark:text-white font-fk-grotesk font-medium">
                  Verification Complete!
                </h1>
                <p className="text-[16px] sm:text-[18px] leading-[24px] sm:leading-[28px] text-black dark:text-neutral-200">
                  Your identity has been successfully verified
                </p>

                {/* Account Info */}
                {accountId && (
                  <div className="w-full bg-[rgba(0,236,151,0.08)] border border-[rgba(0,236,151,0.3)] rounded p-4 mt-2">
                    <p className="text-[14px] leading-[20px] text-black dark:text-neutral-200 mb-2">
                      Your NEAR account is now verified:
                    </p>
                    <p className="text-[16px] leading-[24px] font-mono font-semibold text-[#111] dark:text-white break-all">
                      {accountId}
                    </p>
                  </div>
                )}

                {/* Continue Button */}
                <button
                  onClick={handleContinue}
                  className="mt-4 w-full bg-[#040404] dark:bg-white text-[#d8d8d8] dark:text-[#040404] px-6 py-3.5 rounded-[4px] font-inter font-medium text-[16px] leading-[20px] hover:opacity-90 transition-opacity"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error/Expired Status */}
        {(status === "error" || status === "expired") && (
          <div className="bg-white dark:bg-neutral-800 border border-[rgba(0,0,0,0.1)] dark:border-neutral-700 py-10 px-6 sm:px-10">
            <div className="flex flex-col items-center gap-6">
              {/* Error Icon */}
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(239,68,68,0.15)]">
                <svg
                  className="w-8 h-8 text-[#ef4444]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>

              <div className="flex flex-col items-center gap-4 text-center w-full">
                <h1 className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-[#111] dark:text-white font-fk-grotesk font-medium">
                  Verification Failed
                </h1>
                <p className="text-[16px] sm:text-[18px] leading-[24px] sm:leading-[28px] text-black dark:text-neutral-200">
                  There was an issue with your verification
                </p>

                {/* Error Message */}
                <div className="w-full bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] rounded p-4 mt-2">
                  <p className="text-[14px] sm:text-[16px] leading-[20px] sm:leading-[24px] text-[#ef4444] dark:text-[#f87171]">
                    {errorMessage || "An unexpected error occurred"}
                  </p>
                </div>

                {/* Try Again Button */}
                <button
                  onClick={handleTryAgain}
                  className="mt-4 w-full bg-[#040404] dark:bg-white text-[#d8d8d8] dark:text-[#040404] px-6 py-3.5 rounded-[4px] font-inter font-medium text-[16px] leading-[20px] hover:opacity-90 transition-opacity"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#f2f2f2] dark:bg-neutral-900 flex items-center justify-center px-4">
      <div className="w-full max-w-[650px] bg-white dark:bg-neutral-800 border border-[rgba(0,0,0,0.1)] dark:border-neutral-700 py-10 px-6 sm:px-10">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-16 w-16 animate-spin text-[#00ec97]" />
          <h1 className="text-[28px] sm:text-[32px] leading-[36px] sm:leading-[40px] text-[#111] dark:text-white font-fk-grotesk font-medium">
            Loading...
          </h1>
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
