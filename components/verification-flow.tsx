"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useNearWallet } from "@/lib/near-wallet-provider"
import { useDiscourse } from "@/lib/discourse-provider"
import { SelfVerification } from "./self-verification"
import { DiscourseVerification } from "./discourse-verification"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CheckCircle2, Loader2, Shield, Wallet, FileKey, AlertCircle, RotateCcw, MessageSquare } from "lucide-react"
import type { NearSignatureData, VerificationStep } from "@/lib/types"
import { CONSTANTS, ERROR_MESSAGES, DISCOURSE_CONFIG } from "@/lib/config"

export function VerificationFlow() {
  const { accountId, isConnected, connect, disconnect, signMessage, isLoading } = useNearWallet()
  const { isConnected: discourseConnected, profile: discourseProfile } = useDiscourse()
  const [currentStep, setCurrentStep] = useState(1)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [isSigningMessage, setIsSigningMessage] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [selfVerificationComplete, setSelfVerificationComplete] = useState(false)
  const [discourseError, setDiscourseError] = useState<string | null>(null)
  const [isCheckingVerification, setIsCheckingVerification] = useState(false)

  // Check if Discourse is configured
  const discourseEnabled = !!DISCOURSE_CONFIG.url

  // Check if wallet is already verified when connected
  useEffect(() => {
    async function checkExistingVerification() {
      if (!accountId || !isConnected) return

      setIsCheckingVerification(true)
      try {
        const response = await fetch("/api/verify-stored", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nearAccountId: accountId }),
        })
        const result = await response.json()

        if (result.verified) {
          // Already verified - skip to Discourse step (or final if no Discourse)
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
          // If Discourse is enabled and not connected, go to step 4
          // Otherwise, stay at step 3 (which will show success)
          if (discourseEnabled && !discourseConnected) {
            setCurrentStep(4)
          } else {
            setCurrentStep(discourseEnabled ? 4 : 3)
          }
        } else if (currentStep === 1) {
          // Not verified - move to step 2
          setCurrentStep(2)
        }
      } catch (error) {
        console.error("Error checking verification status:", error)
        // On error, just proceed to step 2
        if (currentStep === 1) {
          setCurrentStep(2)
        }
      } finally {
        setIsCheckingVerification(false)
      }
    }

    checkExistingVerification()
  }, [accountId, isConnected, discourseEnabled, discourseConnected])

  const baseSteps: VerificationStep[] = [
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

  // Add Discourse step if configured
  const steps: VerificationStep[] = discourseEnabled
    ? [
        ...baseSteps,
        {
          id: "discourse",
          title: "Link Discourse",
          description: "Connect your Discourse forum account",
          status: discourseConnected ? "complete" : currentStep === 4 ? "active" : "pending",
        },
      ]
    : baseSteps

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
      setSignError(error instanceof Error ? error.message : ERROR_MESSAGES.SIGNING_FAILED)
    } finally {
      setIsSigningMessage(false)
    }
  }

  const handleVerificationSuccess = () => {
    setVerificationError(null)
    setSelfVerificationComplete(true)
    // If Discourse is enabled, move to step 4
    if (discourseEnabled) {
      setCurrentStep(4)
    }
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
    setSelfVerificationComplete(false)
    setDiscourseError(null)
    setCurrentStep(1)
  }

  // Discourse handlers
  const handleDiscourseSuccess = useCallback(() => {
    setDiscourseError(null)
  }, [])

  const handleDiscourseError = useCallback((error: string) => {
    setDiscourseError(error)
  }, [])

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

      <main aria-live="polite" aria-atomic="true">
        {currentStep === 1 && (
          <Card corners="dots" pattern="diagonal" patternFade="top-left" patternOpacity={0.15}>
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
          <Card corners="crosshairs" pattern="diagonal" patternFade="top-left" patternOpacity={0.15}>
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
              <Card
                corners="crosshairs"
                pattern="diagonal"
                patternFade="top-left"
                patternOpacity={0.15}
                className="border-destructive/20"
                role="alert"
                aria-labelledby="error-title"
              >
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
            ) : !selfVerificationComplete ? (
              <SelfVerification
                nearSignature={nearSignature}
                onSuccess={handleVerificationSuccess}
                onError={handleVerificationError}
              />
            ) : !discourseEnabled ? (
              // No Discourse - show success immediately
              <Card
                corners="dots-accent"
                pattern="diagonal"
                patternFade="top-left"
                patternOpacity={0.18}
                className="border-primary/20 bg-primary/5"
                role="status"
                aria-labelledby="success-title"
              >
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
            ) : null}
          </>
        )}

        {/* Step 4: Discourse Authentication */}
        {currentStep === 4 && selfVerificationComplete && discourseEnabled && (
          <>
            {discourseError && !discourseConnected ? (
              <Card
                corners="crosshairs"
                pattern="diagonal"
                patternFade="top-left"
                patternOpacity={0.15}
                className="border-destructive/20"
                role="alert"
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
                    <CardTitle>Discourse Connection Failed</CardTitle>
                  </div>
                  <CardDescription>There was an error connecting to Discourse</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertDescription>{discourseError}</AlertDescription>
                  </Alert>

                  <DiscourseVerification onSuccess={handleDiscourseSuccess} onError={handleDiscourseError} />
                </CardContent>
              </Card>
            ) : !discourseConnected ? (
              <DiscourseVerification onSuccess={handleDiscourseSuccess} onError={handleDiscourseError} />
            ) : (
              // Full verification complete - show final success
              <Card
                corners="dots-accent"
                pattern="diagonal"
                patternFade="top-left"
                patternOpacity={0.18}
                className="border-primary/20 bg-primary/5"
                role="status"
                aria-labelledby="success-title"
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
                    <CardTitle id="success-title">Verification Complete!</CardTitle>
                  </div>
                  <CardDescription>
                    Your identity and Discourse account have been linked to your NEAR wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="p-4 bg-background rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium">NEAR Account</dt>
                      <dd className="text-sm text-muted-foreground font-mono">{nearSignature?.accountId}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-sm font-medium">Identity Status</dt>
                      <dd className="text-sm text-primary font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Verified</span>
                      </dd>
                    </div>
                    {discourseProfile && (
                      <>
                        <div className="border-t pt-3 mt-3">
                          <dt className="text-sm font-medium mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" aria-hidden="true" />
                            Discourse Account
                          </dt>
                          <dd className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={discourseProfile.avatar_url} alt={discourseProfile.username} />
                              <AvatarFallback>{discourseProfile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">
                                {discourseProfile.name || discourseProfile.username}
                              </div>
                              <div className="text-xs text-muted-foreground">@{discourseProfile.username}</div>
                            </div>
                          </dd>
                        </div>
                      </>
                    )}
                  </dl>

                  <p className="text-sm text-muted-foreground">
                    Your verified identity and Discourse account are now securely linked to your NEAR wallet.
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
