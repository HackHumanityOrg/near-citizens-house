"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { SelfAppBuilder } from "@selfxyz/qrcode"
import { SELF_CONFIG } from "@/lib/config"
import type { NearSignatureData } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, QrCode, CheckCircle2, AlertCircle } from "lucide-react"

type SelfApp = ReturnType<SelfAppBuilder["build"]>

interface SelfQRcodeProps {
  selfApp: SelfApp
  onSuccess: () => void
  onError: () => void
}

const SelfQRcodeWrapper = dynamic<SelfQRcodeProps>(
  () =>
    import("@selfxyz/qrcode").then((mod) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Component = mod.SelfQRcode as any
      return function SelfQRcodeWrapper(props: SelfQRcodeProps) {
        return <Component {...props} />
      }
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
  },
)

interface SelfVerificationProps {
  nearSignature: NearSignatureData
  onSuccess: () => void
  onError: (error: string) => void
}

export function SelfVerification({ nearSignature, onSuccess, onError }: SelfVerificationProps) {
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "scanning" | "verifying" | "success" | "error">(
    "idle",
  )

  useEffect(() => {
    const nonceBase64 = Buffer.from(nearSignature.nonce).toString("base64")

    const userDefinedData = JSON.stringify({
      accountId: nearSignature.accountId,
      publicKey: nearSignature.publicKey,
      signature: nearSignature.signature,
      nonce: nonceBase64,
      timestamp: nearSignature.timestamp,
    })

    const endpoint = SELF_CONFIG.endpoint

    if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
      throw new Error(
        "crypto.randomUUID() is not available. Please use a modern browser (Chrome 92+, Firefox 95+, Safari 15.4+) or Node.js 14.17+",
      )
    }
    const sessionId = crypto.randomUUID()

    const app = new SelfAppBuilder({
      version: 2,
      appName: SELF_CONFIG.appName,
      scope: SELF_CONFIG.scope,
      endpoint: endpoint,
      logoBase64: SELF_CONFIG.logoBase64,
      userId: sessionId,
      endpointType: SELF_CONFIG.endpointType,
      userIdType: "uuid",
      userDefinedData: userDefinedData,
      disclosures: SELF_CONFIG.disclosures,
    }).build()

    setSelfApp(app)
  }, [nearSignature])

  const handleSuccess = () => {
    setVerificationStatus("success")
    onSuccess()
  }

  const handleError = () => {
    setVerificationStatus("error")
    onError("Verification failed. Please try again.")
  }

  if (!selfApp) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <CardTitle>Scan QR Code</CardTitle>
        </div>
        <CardDescription>Use the Self mobile app to scan this QR code and generate your passport proof</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verificationStatus === "success" && (
          <Alert className="bg-primary/10 border-primary/20">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              Verification successful! Your identity has been verified and linked to your NEAR wallet.
            </AlertDescription>
          </Alert>
        )}

        {verificationStatus === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Verification failed. Please try again or contact support.</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-center p-4 bg-muted rounded-lg">
          <SelfQRcodeWrapper selfApp={selfApp} onSuccess={handleSuccess} onError={handleError} />
        </div>

        <div className="text-sm text-muted-foreground text-center space-y-1">
          <p>Download the Self app on your mobile device</p>
          <p className="text-xs">Your NEAR wallet signature is securely embedded in this verification</p>
        </div>
      </CardContent>
    </Card>
  )
}
