"use client"

import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { useNearWallet, CONSTANTS, type NearSignatureData } from "@/lib"
import { trackEvent, getPlatform, identifyVerifiedUser } from "@/lib/analytics"
import { checkIsVerified } from "@/app/citizens/actions"
import { Step1WalletSignature } from "../../../components/verification/flow/step-1-wallet-signature"
import { Step2SumSub } from "../../../components/verification/flow/step-2-sumsub"
import { Step3Success } from "../../../components/verification/flow/step-3-success"
import { StepError } from "../../../components/verification/flow/step-error"
import { StepHold } from "../../../components/verification/flow/step-hold"
import { ErrorModal } from "../../../components/verification/flow/error-modal"
import { useDebugRegistration } from "@/lib/hooks/use-debug-registration"
import { isNonRetryableError, isHoldError, getErrorMessage, type VerificationErrorCode } from "@/lib/schemas/errors"

enum VerificationProgressStep {
  NotConnected = "not_connected",
  WalletConnected = "wallet_connected",
  MessageSigned = "message_signed",
  VerificationComplete = "verification_complete",
  Hold = "hold",
  Error = "error",
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e2e8f0] dark:bg-white/10 ${className}`} />
}

function LoadingFallback() {
  return (
    <div className="w-full">
      {/* Hero Section with gradient background */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        {/* Stepper skeleton */}
        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              {/* Step 1 circle skeleton */}
              <div className="col-start-1 row-start-1 flex items-center justify-center">
                <Skeleton className="size-[40px] rounded-full" />
              </div>

              {/* Connecting line */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black/20 dark:bg-white/20" />
              </div>

              {/* Step 2 circle skeleton */}
              <div className="col-start-3 row-start-1 flex items-center justify-center">
                <Skeleton className="size-[40px] rounded-full" />
              </div>

              {/* Labels skeleton */}
              <div className="col-start-1 row-start-2 justify-self-center">
                <Skeleton className="h-[28px] w-[120px] md:w-[160px]" />
              </div>
              <div className="col-start-3 row-start-2 justify-self-center">
                <Skeleton className="h-[28px] w-[100px] md:w-[120px]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4">
        <div className="flex flex-col items-start w-full max-w-[650px]">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center py-[40px] px-4 md:px-0 w-full">
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full max-w-[520px]">
                {/* Card Title skeleton */}
                <Skeleton className="h-[32px] w-[280px]" />

                {/* Description skeleton */}
                <div className="flex flex-col gap-2 w-full">
                  <Skeleton className="h-[28px] w-full" />
                  <Skeleton className="h-[28px] w-5/6" />
                </div>

                {/* Button skeleton */}
                <div className="flex flex-col gap-[16px] items-start py-[8px] px-0 w-full">
                  <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                    <Skeleton className="h-[48px] w-full rounded-[4px]" />
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

function VerificationStartContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isConnected, accountId, isLoading, connect, disconnect, signMessage } = useNearWallet()

  // State management
  const [currentStep, setCurrentStep] = useState<VerificationProgressStep>(VerificationProgressStep.NotConnected)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [isSigning, setIsSigning] = useState(false)
  const [isCheckingVerification, setIsCheckingVerification] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<VerificationErrorCode | null>(null)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const hasTrackedFlowStarted = useRef(false)
  const hasTrackedAlreadyVerified = useRef(false)
  const hasTrackedWalletConnected = useRef(false)
  const lastAccountIdRef = useRef<string | null>(null)
  const [debugModeActive, setDebugModeActive] = useState(false)
  const [debugOverrideConnected, setDebugOverrideConnected] = useState<boolean | null>(null)

  // Effective isConnected - uses debug override when debug mode is active
  const effectiveIsConnected = debugModeActive && debugOverrideConnected !== null ? debugOverrideConnected : isConnected

  // Debug mode state override
  const handleDebugStateChange = useCallback(
    (state: string) => {
      setDebugModeActive(true)
      setCurrentStep(state as VerificationProgressStep)

      // Override isConnected based on the state
      if (state === VerificationProgressStep.NotConnected) {
        setDebugOverrideConnected(false)
      } else {
        setDebugOverrideConnected(true)
      }

      // If switching to MessageSigned, create a mock signature
      if (state === VerificationProgressStep.MessageSigned && !nearSignature) {
        setNearSignature({
          accountId: accountId || "debug.testnet",
          signature: "debug-signature",
          publicKey: "ed25519:debug-public-key",
          nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", // base64-encoded 32 bytes
          timestamp: Date.now(),
          challenge: "Sign this message to verify ownership of your NEAR wallet.",
          recipient: "citizens-house",
        })
      }
    },
    [accountId, nearSignature],
  )

  // Register with debug context
  const debugStates = useMemo(() => Object.values(VerificationProgressStep), [])

  const debugControls = useMemo(
    () => [
      {
        label: "Reset to Real State",
        action: () => {
          setDebugModeActive(false)
          setDebugOverrideConnected(null)
          setCurrentStep(isConnected ? VerificationProgressStep.WalletConnected : VerificationProgressStep.NotConnected)
          setNearSignature(null)
          setErrorMessage(null)
          setErrorCode(null)
          setIsErrorModalOpen(false)
        },
      },
    ],
    [isConnected],
  )

  useDebugRegistration({
    id: "verification-progress",
    name: "Verification Progress",
    availableStates: debugStates,
    currentState: currentStep,
    onStateChange: handleDebugStateChange,
    additionalControls: debugControls,
  })

  // Listen for debug error trigger events
  useEffect(() => {
    const handleDebugTriggerError = (
      event: CustomEvent<{ type: "retryable" | "non-retryable" | "hold"; code: VerificationErrorCode }>,
    ) => {
      const { type, code } = event.detail
      setErrorMessage(`Debug: ${code}`)
      setErrorCode(code)

      if (type === "hold") {
        setIsErrorModalOpen(false)
        setDebugModeActive(true)
        setCurrentStep(VerificationProgressStep.Hold)
      } else if (type === "non-retryable") {
        setIsErrorModalOpen(false)
        setDebugModeActive(true)
        setCurrentStep(VerificationProgressStep.Error)
      } else {
        setIsErrorModalOpen(true)
      }
    }

    const handleDebugClearErrors = () => {
      setErrorMessage(null)
      setErrorCode(null)
      setIsErrorModalOpen(false)
      // If we're on the error or hold step, go back to the appropriate step
      if (currentStep === VerificationProgressStep.Error || currentStep === VerificationProgressStep.Hold) {
        setDebugModeActive(false)
        setDebugOverrideConnected(null)
        setCurrentStep(isConnected ? VerificationProgressStep.WalletConnected : VerificationProgressStep.NotConnected)
      }
    }

    window.addEventListener("debug:trigger-error", handleDebugTriggerError as EventListener)
    window.addEventListener("debug:clear-errors", handleDebugClearErrors)
    return () => {
      window.removeEventListener("debug:trigger-error", handleDebugTriggerError as EventListener)
      window.removeEventListener("debug:clear-errors", handleDebugClearErrors)
    }
  }, [currentStep, isConnected])

  // Track flow_started event once on component mount
  useEffect(() => {
    if (hasTrackedFlowStarted.current) return
    hasTrackedFlowStarted.current = true

    trackEvent({
      domain: "verification",
      action: "flow_started",
      platform: getPlatform(),
    })
  }, [])

  useEffect(() => {
    if (!isConnected) {
      lastAccountIdRef.current = null
      hasTrackedAlreadyVerified.current = false
      hasTrackedWalletConnected.current = false
      return
    }

    if (accountId && lastAccountIdRef.current && lastAccountIdRef.current !== accountId) {
      hasTrackedAlreadyVerified.current = false
      hasTrackedWalletConnected.current = false
    }

    if (accountId) {
      lastAccountIdRef.current = accountId
    }
  }, [accountId, isConnected])

  useEffect(() => {
    // Skip auto state management when debug mode is controlling the state
    if (debugModeActive) return

    if (!isConnected) {
      if (currentStep !== VerificationProgressStep.NotConnected) {
        setCurrentStep(VerificationProgressStep.NotConnected)
      }
      if (nearSignature) {
        setNearSignature(null)
      }
      return
    }

    if (currentStep === VerificationProgressStep.NotConnected && accountId) {
      if (!hasTrackedWalletConnected.current) {
        hasTrackedWalletConnected.current = true
        trackEvent({
          domain: "verification",
          action: "wallet_connect_succeeded",
          platform: getPlatform(),
          accountId,
        })
      }
      setCurrentStep(VerificationProgressStep.WalletConnected)
    }
  }, [isConnected, currentStep, nearSignature, accountId, debugModeActive])

  // Check if already verified on mount
  useEffect(() => {
    const checkVerification = async () => {
      if (!accountId) return

      setIsCheckingVerification(true)
      try {
        const isVerified = await checkIsVerified(accountId)
        if (isVerified) {
          // Track already_verified event (guard against double tracking)
          if (!hasTrackedAlreadyVerified.current) {
            hasTrackedAlreadyVerified.current = true
            trackEvent({
              domain: "verification",
              action: "already_verified",
              platform: getPlatform(),
              accountId,
            })
          }

          // Skip to success step
          setCurrentStep(VerificationProgressStep.VerificationComplete)
        }
      } catch {
        // Failed to check verification status, continue with flow
      } finally {
        setIsCheckingVerification(false)
      }
    }

    checkVerification()
  }, [accountId])

  // Handle URL params from callback
  useEffect(() => {
    const status = searchParams?.get("status")
    const accountIdParam = searchParams?.get("accountId")
    const errorParam = searchParams?.get("error")
    const errorCodeParam = searchParams?.get("errorCode")
    let handled = false

    if (status === "success" && accountIdParam) {
      // Verification successful
      setCurrentStep(VerificationProgressStep.VerificationComplete)
      handled = true
    } else if (status === "error") {
      // Verification failed
      const message = errorParam || "Verification failed. Please try again."
      setErrorMessage(message)
      // Cast to VerificationErrorCode - backend validates error codes before sending
      setErrorCode(errorCodeParam as VerificationErrorCode | null)
      // Route to appropriate step based on error type
      if (errorCodeParam && isHoldError(errorCodeParam)) {
        setCurrentStep(VerificationProgressStep.Hold)
      } else if (errorCodeParam && isNonRetryableError(errorCodeParam)) {
        setCurrentStep(VerificationProgressStep.Error)
      } else {
        setIsErrorModalOpen(true)
        setCurrentStep(isConnected ? VerificationProgressStep.WalletConnected : VerificationProgressStep.NotConnected)
      }
      handled = true
    }

    if (handled) {
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, isConnected, router, pathname])

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [currentStep])

  // Handle wallet connection
  const handleConnect = async () => {
    const platform = getPlatform()

    trackEvent({
      domain: "verification",
      action: "wallet_connect_started",
      platform,
    })

    try {
      await connect()
      // wallet_connected is tracked in the useEffect when isConnected becomes true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to connect wallet"
      trackEvent({
        domain: "verification",
        action: "wallet_connect_failed",
        platform,
        errorMessage,
      })
      setErrorMessage("Failed to connect wallet. Please try again.")
      setIsErrorModalOpen(true)
    }
  }

  // Handle message signing
  const handleSignMessage = async () => {
    if (!accountId) return

    const platform = getPlatform()

    // Re-check if already verified before signing (prevents race conditions)
    try {
      const isVerified = await checkIsVerified(accountId)
      if (isVerified) {
        // Track already_verified event (guard against double tracking)
        if (!hasTrackedAlreadyVerified.current) {
          hasTrackedAlreadyVerified.current = true
          trackEvent({
            domain: "verification",
            action: "already_verified",
            platform,
            accountId,
          })
        }
        setCurrentStep(VerificationProgressStep.VerificationComplete)
        return
      }
    } catch {
      // Continue with signing if check fails - the token endpoint will also check
    }

    trackEvent({
      domain: "verification",
      action: "sign_started",
      platform,
      accountId,
    })

    setIsSigning(true)
    setErrorMessage(null)

    try {
      const signature = await signMessage(CONSTANTS.SIGNING_MESSAGE)

      if (!signature) {
        throw new Error("Failed to sign message")
      }

      trackEvent({
        domain: "verification",
        action: "sign_completed",
        platform,
        accountId,
      })

      setNearSignature(signature)
      setCurrentStep(VerificationProgressStep.MessageSigned)
      toast.success("Successfully Verified NEAR Wallet.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign message"
      const wasUserRejection =
        message.toLowerCase().includes("reject") ||
        message.toLowerCase().includes("cancel") ||
        message.toLowerCase().includes("denied")

      trackEvent({
        domain: "verification",
        action: "sign_failed",
        platform,
        accountId,
        errorMessage: message,
        wasUserRejection,
      })

      setErrorMessage(message)
      setIsErrorModalOpen(true)
    } finally {
      setIsSigning(false)
    }
  }

  // Handle verification success
  const handleVerificationSuccess = () => {
    // Identify verified user for PostHog segmentation
    if (accountId) {
      identifyVerifiedUser(accountId, {
        platform: getPlatform(),
      })
    }

    setErrorMessage(null)
    setCurrentStep(VerificationProgressStep.VerificationComplete)
    toast.success("Successfully Verified Identity.")
  }

  // Handle verification error
  const handleVerificationError = (code: VerificationErrorCode) => {
    setErrorCode(code)
    setErrorMessage(getErrorMessage(code))

    // Route to appropriate step based on error type
    if (isHoldError(code)) {
      setCurrentStep(VerificationProgressStep.Hold)
    } else if (isNonRetryableError(code)) {
      setCurrentStep(VerificationProgressStep.Error)
    } else {
      setIsErrorModalOpen(true)
    }
  }

  // Handle retry from error modal
  const handleRetry = () => {
    // Reset debug mode on retry to use real wallet state
    setDebugModeActive(false)
    setDebugOverrideConnected(null)

    setIsErrorModalOpen(false)
    setErrorMessage(null)
    setErrorCode(null)
    setNearSignature(null)
    setCurrentStep(isConnected ? VerificationProgressStep.WalletConnected : VerificationProgressStep.NotConnected)

    // Always auto-trigger signing for retryable errors (button is labeled "Sign Message")
    if (isConnected) {
      handleSignMessage()
    }
  }

  // Handle disconnect
  const handleDisconnect = () => {
    disconnect()
    setNearSignature(null)
    setErrorMessage(null)
    setCurrentStep(VerificationProgressStep.NotConnected)
  }

  return (
    <div className="min-h-full bg-white dark:bg-black">
      {/* Main Content */}
      <div className="w-full">
        {/* Step 1: Wallet Signature */}
        {(currentStep === VerificationProgressStep.NotConnected ||
          currentStep === VerificationProgressStep.WalletConnected) && (
          <Step1WalletSignature
            accountId={effectiveIsConnected ? accountId : null}
            isConnected={effectiveIsConnected}
            isLoading={isLoading || isCheckingVerification}
            isSigning={isSigning}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSign={handleSignMessage}
          />
        )}

        {/* Step 2: SumSub Verification */}
        {currentStep === VerificationProgressStep.MessageSigned && nearSignature && (
          <Step2SumSub
            nearSignature={nearSignature}
            onSuccess={handleVerificationSuccess}
            onError={handleVerificationError}
          />
        )}

        {/* Step 3: Success */}
        {currentStep === VerificationProgressStep.VerificationComplete && accountId && (
          <Step3Success accountId={accountId} onDisconnect={handleDisconnect} />
        )}

        {/* Hold Step: Verification under review */}
        {currentStep === VerificationProgressStep.Hold && (
          <StepHold
            errorCode={errorCode || undefined}
            errorMessage={errorMessage || undefined}
            isConnected={isConnected}
            onDisconnect={() => {
              disconnect()
              router.push("/")
            }}
          />
        )}

        {/* Error Step: Non-retryable errors */}
        {currentStep === VerificationProgressStep.Error && errorCode && (
          <StepError
            errorCode={errorCode}
            errorMessage={errorMessage || undefined}
            isConnected={isConnected}
            onDisconnect={() => {
              disconnect()
              router.push("/")
            }}
          />
        )}
      </div>

      {/* Error Modal */}
      <ErrorModal
        isOpen={isErrorModalOpen}
        errorMessage={errorMessage || undefined}
        errorCode={errorCode || undefined}
        onClose={() => setIsErrorModalOpen(false)}
        onRetry={handleRetry}
      />
    </div>
  )
}

export default function VerificationStartPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerificationStartContent />
    </Suspense>
  )
}
