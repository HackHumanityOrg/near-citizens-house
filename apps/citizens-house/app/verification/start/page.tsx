"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { useNearWallet, CONSTANTS, type NearSignatureData } from "@near-citizens/shared"
import { checkIsVerified } from "@/app/citizens/actions"
import { useAnalytics } from "@/lib/analytics"
import { Step1WalletSignature } from "../../../components/verification/flow/step-1-wallet-signature"
import { Step2QrScan } from "../../../components/verification/flow/step-2-qr-scan"
import { Step3Success } from "../../../components/verification/flow/step-3-success"
import { ErrorModal } from "../../../components/verification/flow/error-modal"

enum VerificationProgressStep {
  NotConnected = "not_connected",
  WalletConnected = "wallet_connected",
  MessageSigned = "message_signed",
  VerificationComplete = "verification_complete",
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

function LoadingFallback() {
  return (
    <div className="min-h-full bg-white dark:bg-black">
      <div className="w-full">
        <div className="flex flex-col gap-[24px] items-center text-center w-full py-[40px] px-4">
          <Skeleton className="h-[22px] w-[120px] md:h-[28px] md:w-[140px]" />
          <Skeleton className="h-[32px] w-[240px] md:h-[44px] md:w-[320px]" />
          <Skeleton className="h-[24px] w-[320px] md:h-[28px] md:w-[420px]" />
        </div>

        <div className="flex flex-col items-center pb-0 pt-0 w-full px-4">
          <div className="flex flex-col items-start w-full max-w-[650px]">
            <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex items-center justify-center py-[40px] px-4 md:px-0 w-full">
              <div className="flex flex-col items-center w-full">
                <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full max-w-[520px]">
                  <div className="flex h-[30.945px] items-center justify-center w-full">
                    <div className="w-full">
                      <Skeleton className="h-[24px] w-[260px]" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <Skeleton className="h-[14px] w-full" />
                    <Skeleton className="h-[14px] w-5/6" />
                  </div>

                  <div className="flex flex-col gap-[16px] items-start py-[8px] px-0 w-full">
                    <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                      <Skeleton className="h-[56px] w-full rounded-[4px]" />
                    </div>
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
  const analytics = useAnalytics()

  // State management
  const [currentStep, setCurrentStep] = useState<VerificationProgressStep>(VerificationProgressStep.NotConnected)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [sessionId] = useState<string>(() => crypto.randomUUID())
  const [isSigning, setIsSigning] = useState(false)
  const [isCheckingVerification, setIsCheckingVerification] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)

  const trackedWalletRef = useRef<string | null>(null)
  const trackedPageViewRef = useRef(false)

  // Track page view on mount
  useEffect(() => {
    if (!trackedPageViewRef.current) {
      analytics.trackVerificationPageViewed()
      trackedPageViewRef.current = true
    }
  }, [analytics])

  useEffect(() => {
    if (!isConnected) {
      if (currentStep !== VerificationProgressStep.NotConnected) {
        setCurrentStep(VerificationProgressStep.NotConnected)
      }
      if (nearSignature) {
        setNearSignature(null)
      }
      return
    }

    if (currentStep === VerificationProgressStep.NotConnected) {
      setCurrentStep(VerificationProgressStep.WalletConnected)
    }
  }, [isConnected, currentStep, nearSignature])

  // Check if already verified on mount
  useEffect(() => {
    const checkVerification = async () => {
      if (!accountId) return

      setIsCheckingVerification(true)
      try {
        const isVerified = await checkIsVerified(accountId)
        if (isVerified) {
          // Skip to success step
          setCurrentStep(VerificationProgressStep.VerificationComplete)
        }
      } catch (error) {
        console.error("Error checking verification:", error)
      } finally {
        setIsCheckingVerification(false)
      }
    }

    checkVerification()
  }, [accountId])

  // Handle URL params from callback (mobile flow)
  useEffect(() => {
    const status = searchParams?.get("status")
    const sessionIdParam = searchParams?.get("sessionId")
    const errorParam = searchParams?.get("error")
    const errorCodeParam = searchParams?.get("errorCode")
    let handled = false

    if (status === "success" && sessionIdParam) {
      // Verification successful from mobile flow
      setCurrentStep(VerificationProgressStep.VerificationComplete)
      handled = true
    } else if (status === "error") {
      // Verification failed from mobile flow
      const message = errorParam || "Verification failed. Please try again."
      setErrorMessage(message)
      setErrorCode(errorCodeParam)
      setIsErrorModalOpen(true)
      setCurrentStep(isConnected ? VerificationProgressStep.WalletConnected : VerificationProgressStep.NotConnected)
      handled = true
    }

    if (handled) {
      router.replace(pathname, { scroll: false })
    }
  }, [searchParams, isConnected, router, pathname])

  // Track wallet connection
  useEffect(() => {
    if (isConnected && accountId && trackedWalletRef.current !== accountId) {
      analytics.trackWalletConnected(accountId)
      trackedWalletRef.current = accountId
    }
  }, [isConnected, accountId, analytics])

  // Handle wallet connection
  const handleConnect = async () => {
    try {
      await connect()
    } catch (error) {
      console.error("Error connecting wallet:", error)
      setErrorMessage("Failed to connect wallet. Please try again.")
      setIsErrorModalOpen(true)
    }
  }

  // Handle message signing
  const handleSignMessage = async () => {
    if (!accountId) return

    setIsSigning(true)
    setErrorMessage(null)

    try {
      const signature = await signMessage(CONSTANTS.SIGNING_MESSAGE)

      if (!signature) {
        throw new Error("Failed to sign message")
      }

      analytics.trackMessageSigned(accountId)
      setNearSignature(signature)
      setCurrentStep(VerificationProgressStep.MessageSigned)
      toast.success("Successfully Verified NEAR Wallet.")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign message"
      const errorCode = message.includes("rejected") || message.includes("cancelled") ? "USER_REJECTED" : "UNKNOWN"
      analytics.trackMessageSignFailed(accountId, { code: errorCode, message })
      setErrorMessage(message)
      setIsErrorModalOpen(true)
    } finally {
      setIsSigning(false)
    }
  }

  // Handle verification success
  const handleVerificationSuccess = () => {
    setErrorMessage(null)
    setCurrentStep(VerificationProgressStep.VerificationComplete)
    toast.success("Successfully Verified Identity.")
  }

  // Handle verification error
  const handleVerificationError = (error: string, code?: string) => {
    setErrorMessage(error)
    setErrorCode(code || null)
    setIsErrorModalOpen(true)
  }

  // Handle retry from error modal
  const handleRetry = () => {
    setIsErrorModalOpen(false)
    setErrorMessage(null)
    setErrorCode(null)
    setNearSignature(null)
    setCurrentStep(isConnected ? VerificationProgressStep.WalletConnected : VerificationProgressStep.NotConnected)
  }

  // Handle disconnect
  const handleDisconnect = () => {
    if (accountId) {
      analytics.trackWalletDisconnected(accountId, currentStep)
    }
    trackedWalletRef.current = null
    disconnect()
    setNearSignature(null)
    setErrorMessage(null)
    setCurrentStep(VerificationProgressStep.NotConnected)
  }

  // Handle vote for proposals
  const handleVoteForProposals = () => {
    router.push("/governance")
  }

  return (
    <div className="min-h-full bg-white dark:bg-black">
      {/* Main Content */}
      <div className="w-full">
        {/* Step 1: Wallet Signature */}
        {(currentStep === VerificationProgressStep.NotConnected ||
          currentStep === VerificationProgressStep.WalletConnected) && (
          <Step1WalletSignature
            accountId={accountId}
            isConnected={isConnected}
            isLoading={isLoading || isCheckingVerification}
            isSigning={isSigning}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSign={handleSignMessage}
          />
        )}

        {/* Step 2: QR Scan */}
        {currentStep === VerificationProgressStep.MessageSigned && nearSignature && (
          <Step2QrScan
            nearSignature={nearSignature}
            sessionId={sessionId}
            onSuccess={handleVerificationSuccess}
            onError={handleVerificationError}
          />
        )}

        {/* Step 3: Success */}
        {currentStep === VerificationProgressStep.VerificationComplete && accountId && (
          <Step3Success
            accountId={accountId}
            onDisconnect={handleDisconnect}
            onVoteForProposals={handleVoteForProposals}
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
