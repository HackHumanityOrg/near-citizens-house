"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useNearWallet, CONSTANTS, type NearSignatureData } from "@near-citizens/shared"
import { checkIsVerified } from "@/app/citizens/actions"
import { useAnalytics } from "@/lib/analytics"
import { VerificationProgressBar } from "../../../components/verification/flow/verification-progress-bar"
import { StepHeader } from "../../../components/verification/flow/step-header"
import { Step1WalletSignature } from "../../../components/verification/flow/step-1-wallet-signature"
import { Step2QrScan } from "../../../components/verification/flow/step-2-qr-scan"
import { Step3Success } from "../../../components/verification/flow/step-3-success"
import { ErrorModal } from "../../../components/verification/flow/error-modal"

function VerificationStartContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isConnected, accountId, isLoading, connect, disconnect, signMessage } = useNearWallet()
  const analytics = useAnalytics()

  // State management
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [sessionId] = useState<string>(() => crypto.randomUUID())
  const [isSigning, setIsSigning] = useState(false)
  const [isCheckingVerification, setIsCheckingVerification] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)

  const trackedWalletRef = useRef<string | null>(null)

  // Check if already verified on mount
  useEffect(() => {
    const checkVerification = async () => {
      if (!accountId) return

      setIsCheckingVerification(true)
      try {
        const isVerified = await checkIsVerified(accountId)
        if (isVerified) {
          // Skip to success step
          setCurrentStep(3)
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

    if (status === "success" && sessionIdParam) {
      // Verification successful from mobile flow
      setCurrentStep(3)
    } else if (status === "error") {
      // Verification failed from mobile flow
      const message = errorParam || "Verification failed. Please try again."
      setErrorMessage(message)
      setIsErrorModalOpen(true)
      setCurrentStep(1)
    }
  }, [searchParams])

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
      setCurrentStep(2)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sign message"
      analytics.trackMessageSignFailed(accountId, message)
      setErrorMessage(message)
      setIsErrorModalOpen(true)
    } finally {
      setIsSigning(false)
    }
  }

  // Handle verification success
  const handleVerificationSuccess = () => {
    setErrorMessage(null)
    setCurrentStep(3)
  }

  // Handle verification error
  const handleVerificationError = (error: string) => {
    setErrorMessage(error)
    setIsErrorModalOpen(true)
  }

  // Handle retry from error modal
  const handleRetry = () => {
    setIsErrorModalOpen(false)
    setErrorMessage(null)
    setNearSignature(null)
    setCurrentStep(1)
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
    setCurrentStep(1)
  }

  // Handle vote for proposals
  const handleVoteForProposals = () => {
    router.push("/governance")
  }

  return (
    <div className="min-h-full bg-[#f2f2f2] dark:bg-neutral-900">
      {/* Progress Bar */}
      <VerificationProgressBar currentStep={currentStep} />

      {/* Main Content */}
      <div className="w-full">
        {/* Step 1: Wallet Signature */}
        {currentStep === 1 && (
          <>
            <StepHeader currentStep={1} totalSteps={3} title="Verify your wallet" />
            <Step1WalletSignature
              accountId={accountId}
              isConnected={isConnected}
              isLoading={isLoading || isCheckingVerification}
              isSigning={isSigning}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onSign={handleSignMessage}
            />
          </>
        )}

        {/* Step 2: QR Scan */}
        {currentStep === 2 && nearSignature && (
          <>
            <StepHeader
              currentStep={2}
              totalSteps={3}
              title="Scan QR Code"
              subtitle="Use the Self mobile app to scan this QR code and generate your passport proof."
            />
            <Step2QrScan
              nearSignature={nearSignature}
              sessionId={sessionId}
              onSuccess={handleVerificationSuccess}
              onError={handleVerificationError}
            />
          </>
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && accountId && (
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
        errorMessage={errorMessage || "An error occurred"}
        onClose={() => setIsErrorModalOpen(false)}
        onRetry={handleRetry}
      />
    </div>
  )
}

export default function VerificationStartPage() {
  return (
    <Suspense fallback={<div className="min-h-full bg-[#f2f2f2] dark:bg-neutral-900" />}>
      <VerificationStartContent />
    </Suspense>
  )
}
