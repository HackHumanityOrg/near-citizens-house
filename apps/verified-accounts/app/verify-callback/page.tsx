"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
  Button,
} from "@near-citizens/ui"
import { Loader2, CheckCircle2, AlertCircle, Home } from "lucide-react"
import Link from "next/link"
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
  const sessionId = searchParams.get("sessionId")
  const [status, setStatus] = useState<VerificationStatus>("checking")
  const [accountId, setAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
        const response = await fetch(`/api/verify-status?sessionId=${encodeURIComponent(sessionId)}`, {
          signal: abortController.signal,
        })

        // Check mounted before processing response
        if (!isMounted) return false

        // Handle non-OK responses explicitly
        if (!response.ok) {
          // 4xx = client error (invalid/expired session) - terminal, stop polling
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-b from-background to-background/80">
      <Card className="max-w-md w-full">
        {status === "checking" && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <CardTitle>Verifying...</CardTitle>
              </div>
              <CardDescription>Please wait while we complete your verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center">
                  This may take a few moments. Do not close this page.
                </p>
              </div>
            </CardContent>
          </>
        )}

        {status === "success" && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <CardTitle>Verification Complete!</CardTitle>
              </div>
              <CardDescription>Your identity has been successfully verified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Your NEAR account <span className="font-mono font-semibold">{accountId}</span> is now verified.
                </AlertDescription>
              </Alert>

              <Link href="/" className="block">
                <Button className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Return Home
                </Button>
              </Link>
            </CardContent>
          </>
        )}

        {(status === "error" || status === "expired") && (
          <>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>Verification Failed</CardTitle>
              </div>
              <CardDescription>There was an issue with your verification</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage || "An unexpected error occurred"}</AlertDescription>
              </Alert>

              <Link href="/" className="block">
                <Button className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </Link>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-b from-background to-background/80">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <CardTitle>Loading...</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
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
