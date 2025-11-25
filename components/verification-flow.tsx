"use client"

import React, { useState } from "react"
import { useNearWallet } from "@/lib/near-wallet-provider"
import { SelfVerification } from "./self-verification"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, Shield, Wallet, FileKey, AlertCircle, RotateCcw } from "lucide-react"
import type { NearSignatureData, VerificationStep } from "@/lib/types"
import { CONSTANTS, ERROR_MESSAGES } from "@/lib/config"

export function VerificationFlow() {
  const { accountId, isConnected, connect, disconnect, signMessage, isLoading } = useNearWallet()
  const [currentStep, setCurrentStep] = useState(1)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [isSigningMessage, setIsSigningMessage] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [verificationComplete, setVerificationComplete] = useState(false)

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
      status: verificationComplete ? "complete" : currentStep === 3 ? "active" : "pending",
    },
  ]

  const handleConnect = async () => {
    await connect()
    setCurrentStep(2)
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
      setSignError(error instanceof Error ? error.message : ERROR_MESSAGES.SIGNING_FAILED)
    } finally {
      setIsSigningMessage(false)
    }
  }

  const handleVerificationSuccess = () => {
    setVerificationError(null)
    setVerificationComplete(true)
  }

  const handleVerificationError = (error: string) => {
    setVerificationError(error)
  }

  const handleRetryVerification = () => {
    setVerificationError(null)
  }

  const handleBackToSign = () => {
    setNearSignature(null)
    setVerificationError(null)
    setCurrentStep(2)
  }

  const handleStartOver = () => {
    disconnect()
    setNearSignature(null)
    setVerificationError(null)
    setVerificationComplete(false)
    setCurrentStep(1)
  }

  return (
    <div className="space-y-6" role="region" aria-label="Identity verification process">
      <nav aria-label="Verification progress" className="flex items-center gap-4 px-4">
        <ol className="flex items-center gap-4 w-full">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <li className="flex flex-col items-center gap-2 min-w-[100px]">
                <div
                  className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors ${
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
                <div className="text-xs text-center">
                  <div className={step.status === "active" ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {step.title}
                  </div>
                </div>
              </li>

              {index < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className={`flex-1 h-0.5 mx-2 transition-colors ${
                    steps[index + 1].status === "complete" || steps[index + 1].status === "active"
                      ? "bg-primary"
                      : "bg-muted"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </ol>
      </nav>

      <main className="min-h-[400px]" aria-live="polite" aria-atomic="true">
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
              <Button onClick={handleConnect} size="lg" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" aria-hidden="true" />
                    <span>Loading...</span>
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
                <div className="flex items-center justify-between">
                  <span id="wallet-label" className="text-sm font-medium">
                    Connected Wallet
                  </span>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-muted-foreground" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
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
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && nearSignature && (
          <>
            {verificationError ? (
              <Card className="border-destructive/20" role="alert" aria-labelledby="error-title">
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

                  <div className="flex flex-col gap-2" role="group" aria-label="Recovery options">
                    <Button onClick={handleRetryVerification} size="lg" className="w-full">
                      <RotateCcw className="h-5 w-5 mr-2" aria-hidden="true" />
                      Try Again
                    </Button>
                    <Button onClick={handleBackToSign} variant="outline" size="lg" className="w-full">
                      Re-sign Message
                    </Button>
                    <Button onClick={handleStartOver} variant="ghost" size="sm" className="w-full">
                      Start Over with Different Wallet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : !verificationComplete ? (
              <SelfVerification
                nearSignature={nearSignature}
                onSuccess={handleVerificationSuccess}
                onError={handleVerificationError}
              />
            ) : (
              <Card className="border-primary/20 bg-primary/5" role="status" aria-labelledby="success-title">
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
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
