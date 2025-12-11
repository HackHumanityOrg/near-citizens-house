"use client"

import React, { useState, useEffect } from "react"
import { useNearWallet } from "@near-citizens/shared"
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Alert,
  AlertDescription,
} from "@near-citizens/ui"
import { PassportQrScanner } from "./passport-qr-scanner"
import { CheckCircle2, Loader2, Shield, Wallet, FileKey, AlertCircle, LogOut } from "lucide-react"
import type { NearSignatureData } from "@near-citizens/shared"
import type { VerificationStep } from "@/types/ui"
import { CONSTANTS } from "@near-citizens/shared"
import { isAccountVerified } from "@/app/verified-accounts/actions"

export function IdentityVerificationFlow() {
  const { accountId, isConnected, connect, disconnect, signMessage, isLoading } = useNearWallet()
  const [currentStep, setCurrentStep] = useState(1)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [isSigningMessage, setIsSigningMessage] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [selfVerificationComplete, setSelfVerificationComplete] = useState(false)
  const [isCheckingVerification, setIsCheckingVerification] = useState(false)

  // Check if wallet is already verified when connected
  useEffect(() => {
    let cancelled = false

    async function checkExistingVerification() {
      if (!accountId || !isConnected) return

      setIsCheckingVerification(true)
      try {
        const isVerified = await isAccountVerified(accountId)

        // Don't update state if effect was cancelled (e.g., user disconnected)
        if (cancelled) return

        if (isVerified) {
          // Already verified - show success
          setNearSignature({
            accountId,
            signature: "",
            publicKey: "",
            challenge: "",
            nonce: [],
            timestamp: Date.now(),
            recipient: accountId,
          })
          setSelfVerificationComplete(true)
          setCurrentStep(3)
        } else if (currentStep === 1) {
          // Not verified - move to step 2
          setCurrentStep(2)
        }
      } catch (error) {
        if (cancelled) return
        console.error("Error checking verification status:", error)
        // On error, just proceed to step 2
        if (currentStep === 1) {
          setCurrentStep(2)
        }
      } finally {
        if (!cancelled) {
          setIsCheckingVerification(false)
        }
      }
    }

    checkExistingVerification()

    return () => {
      cancelled = true
    }
  }, [accountId, isConnected, currentStep])

  // Reset flow when wallet disconnects externally (not via our disconnect button)
  useEffect(() => {
    if (!isConnected && currentStep > 1) {
      // Wallet disconnected while in flow - reset everything
      setNearSignature(null)
      setSignError(null)
      setVerificationError(null)
      setSelfVerificationComplete(false)
      setCurrentStep(1)
    }
  }, [isConnected, currentStep])

  // Invalidate signature if user connects a different wallet
  useEffect(() => {
    if (nearSignature && accountId && nearSignature.accountId !== accountId) {
      // Different wallet connected - signature is invalid, go back to sign step
      setNearSignature(null)
      setVerificationError(null)
      setSelfVerificationComplete(false)
      setCurrentStep(2)
    }
  }, [accountId, nearSignature])

  const steps: VerificationStep[] = [
    {
      id: "connect",
      title: "Connect Wallet",
      description: "Connect your NEAR wallet to begin verification",
      status: isConnected ? "complete" : currentStep === 1 ? "active" : "pending",
    },
    {
      id: "sign",
      title: "Sign Message",
      description: "Sign a message to prove wallet ownership",
      status: nearSignature ? "complete" : currentStep === 2 ? "active" : "pending",
    },
    {
      id: "verify",
      title: "Verify Identity",
      description: "Scan QR code with Self app to verify your passport",
      status: selfVerificationComplete ? "complete" : currentStep === 3 ? "active" : "pending",
    },
  ]

  const handleConnect = async () => {
    await connect()
    // Step transition is handled by useEffect when accountId changes
  }

  const handleSignMessage = async () => {
    setIsSigningMessage(true)
    setSignError(null)

    try {
      const signature = await signMessage(CONSTANTS.SIGNING_MESSAGE)
      setNearSignature(signature)
      setCurrentStep(3)
    } catch (error) {
      console.error("Error signing message:", error)
      setSignError(error instanceof Error ? error.message : "Failed to sign message")
    } finally {
      setIsSigningMessage(false)
    }
  }

  const handleVerificationSuccess = () => {
    setVerificationError(null)
    setSelfVerificationComplete(true)
  }

  const handleVerificationError = (error: string) => {
    setVerificationError(error)
  }

  const handleBackToSign = () => {
    setNearSignature(null)
    setVerificationError(null)
    setCurrentStep(2)
  }

  const handleStartOver = () => {
    disconnect()
    setNearSignature(null)
    setSignError(null)
    setVerificationError(null)
    setSelfVerificationComplete(false)
    setCurrentStep(1)
  }

  return (
    <div className="space-y-6" role="region" aria-label="Identity verification process">
      <nav aria-label="Verification progress" className="px-4">
        <ol className="flex w-full">
          {steps.map((step, index) => (
            <li key={step.id} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full gap-2">
                {/* Left line or spacer */}
                {index === 0 ? (
                  <div className="flex-1" aria-hidden="true" />
                ) : (
                  <div
                    aria-hidden="true"
                    className={`flex-1 h-0.5 transition-colors ${
                      step.status === "complete" || step.status === "active" ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors shrink-0 ${
                    step.status === "complete"
                      ? "bg-primary border-primary text-primary-foreground"
                      : step.status === "active"
                        ? "border-primary text-primary"
                        : "border-muted text-muted-foreground"
                  }`}
                  aria-current={step.status === "active" ? "step" : undefined}
                  aria-label={`Step ${index + 1}: ${step.title} - ${step.status === "complete" ? "Completed" : step.status === "active" ? "Current step" : "Pending"}`}
                >
                  {step.status === "complete" ? (
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <span className="text-sm font-semibold" aria-hidden="true">
                      {index + 1}
                    </span>
                  )}
                </div>
                {/* Right line or spacer */}
                {index === steps.length - 1 ? (
                  <div className="flex-1" aria-hidden="true" />
                ) : (
                  <div
                    aria-hidden="true"
                    className={`flex-1 h-0.5 transition-colors ${
                      steps[index + 1].status === "complete" || steps[index + 1].status === "active"
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                )}
              </div>
              <div className="text-xs text-center mt-2">
                <div className={step.status === "active" ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {step.title}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      <main aria-live="polite" aria-atomic="true">
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" aria-hidden="true" />
                <CardTitle>Connect Your NEAR Wallet</CardTitle>
              </div>
              <CardDescription>
                First, connect your NEAR wallet to begin the identity verification process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleConnect}
                size="lg"
                className="w-full"
                disabled={isLoading || isCheckingVerification}
                aria-busy={isLoading || isCheckingVerification}
              >
                {isLoading || isCheckingVerification ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
                    <span>{isCheckingVerification ? "Checking verification..." : "Loading..."}</span>
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5 mr-2" aria-hidden="true" />
                    Connect NEAR Wallet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileKey className="h-5 w-5 text-primary" aria-hidden="true" />
                <CardTitle>Sign Verification Message</CardTitle>
              </div>
              <CardDescription>
                Sign a message to prove you own this NEAR wallet. This signature will be cryptographically linked to
                your identity proof.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="p-4 bg-muted rounded-lg space-y-2"
                role="status"
                aria-label="Connected wallet information"
              >
                <span id="wallet-label" className="text-sm font-medium">
                  Connected Wallet
                </span>
                <div className="text-sm text-muted-foreground font-mono break-all" aria-labelledby="wallet-label">
                  {accountId}
                </div>
              </div>

              {signError && (
                <Alert variant="destructive" role="alert">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>{signError}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleSignMessage}
                size="lg"
                className="w-full"
                disabled={isSigningMessage}
                aria-busy={isSigningMessage}
              >
                {isSigningMessage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
                    <span>Signing Message...</span>
                  </>
                ) : (
                  <>
                    <FileKey className="h-5 w-5 mr-2" aria-hidden="true" />
                    Sign Message
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                This will open your wallet to sign a message. No transaction fees required.
              </p>

              <Button onClick={handleStartOver} variant="outline" size="sm" className="w-full">
                <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                Disconnect Wallet
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && nearSignature && (
          <>
            {verificationError ? (
              <Card role="alert" aria-labelledby="error-title">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
                    <CardTitle id="error-title">Verification Failed</CardTitle>
                  </div>
                  <CardDescription>There was an error during the verification process</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{verificationError}</AlertDescription>
                  </Alert>

                  <p className="text-sm text-muted-foreground">
                    The QR code is tied to your signature. Please sign a new message and scan the fresh QR code.
                  </p>

                  <div className="flex flex-col gap-2" role="group" aria-label="Recovery options">
                    <Button onClick={handleBackToSign} size="lg" className="w-full">
                      <FileKey className="h-5 w-5 mr-2" aria-hidden="true" />
                      Sign Again
                    </Button>
                    <Button onClick={handleStartOver} variant="outline" size="sm" className="w-full">
                      <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                      Disconnect Wallet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : !selfVerificationComplete ? (
              <PassportQrScanner
                nearSignature={nearSignature}
                onSuccess={handleVerificationSuccess}
                onError={handleVerificationError}
                onDisconnect={handleStartOver}
              />
            ) : (
              <Card role="status" aria-labelledby="success-title">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                    <CardTitle id="success-title">Verification Complete!</CardTitle>
                  </div>
                  <CardDescription>
                    Your identity has been successfully verified and linked to your NEAR wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="p-4 bg-background rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium">NEAR Account</dt>
                      <dd className="text-sm text-muted-foreground font-mono">{nearSignature.accountId}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium">Identity Status</dt>
                      <dd className="text-sm text-primary font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Verified</span>
                      </dd>
                    </div>
                  </dl>

                  <p className="text-sm text-muted-foreground">
                    Your verified identity is now securely linked to your NEAR wallet. You can use this verification for
                    decentralized applications that require identity proof.
                  </p>

                  <Button onClick={handleStartOver} variant="outline" size="sm" className="w-full">
                    <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
                    Disconnect Wallet
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
