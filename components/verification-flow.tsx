"use client"

import React, { useState } from "react"
import { useNearWallet } from "@/lib/near-wallet-provider"
import { SelfVerification } from "./self-verification"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, Shield, Wallet, FileKey, AlertCircle } from "lucide-react"
import type { NearSignatureData, VerificationStep } from "@/lib/types"
import { CONSTANTS, ERROR_MESSAGES } from "@/lib/config"

export function VerificationFlow() {
  const { accountId, isConnected, connect, disconnect, signMessage, isLoading } = useNearWallet()
  const [currentStep, setCurrentStep] = useState(1)
  const [nearSignature, setNearSignature] = useState<NearSignatureData | null>(null)
  const [isSigningMessage, setIsSigningMessage] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)
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
    setVerificationComplete(true)
  }

  const handleVerificationError = (_error: string) => {}

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2 min-w-[100px]">
              <div
                className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors ${
                  step.status === "complete"
                    ? "bg-primary border-primary text-primary-foreground"
                    : step.status === "active"
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {step.status === "complete" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <div className="text-xs text-center">
                <div className={step.status === "active" ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {step.title}
                </div>
              </div>
            </div>

            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors ${
                  steps[index + 1].status === "complete" || steps[index + 1].status === "active"
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="min-h-[400px]">
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle>Connect Your NEAR Wallet</CardTitle>
              </div>
              <CardDescription>
                First, connect your NEAR wallet to begin the identity verification process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleConnect} size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5 mr-2" />
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
                <FileKey className="h-5 w-5 text-primary" />
                <CardTitle>Sign Verification Message</CardTitle>
              </div>
              <CardDescription>
                Sign a message to prove you own this NEAR wallet. This signature will be cryptographically linked to
                your identity proof.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Connected Wallet</div>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-muted-foreground" onClick={disconnect}>
                    Disconnect
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground font-mono break-all">{accountId}</div>
              </div>

              {signError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{signError}</AlertDescription>
                </Alert>
              )}

              <Button onClick={handleSignMessage} size="lg" className="w-full" disabled={isSigningMessage}>
                {isSigningMessage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Signing Message...
                  </>
                ) : (
                  <>
                    <FileKey className="h-5 w-5 mr-2" />
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
            {!verificationComplete ? (
              <SelfVerification
                nearSignature={nearSignature}
                onSuccess={handleVerificationSuccess}
                onError={handleVerificationError}
              />
            ) : (
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <CardTitle>Verification Complete!</CardTitle>
                  </div>
                  <CardDescription>
                    Your identity has been successfully verified and linked to your NEAR wallet
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-background rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">NEAR Account</span>
                      <span className="text-sm text-muted-foreground font-mono">{nearSignature.accountId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Identity Status</span>
                      <span className="text-sm text-primary font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Verified
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Your verified identity is now securely linked to your NEAR wallet. You can use this verification for
                    decentralized applications that require identity proof.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
