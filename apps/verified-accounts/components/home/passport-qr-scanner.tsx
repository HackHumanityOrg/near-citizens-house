"use client"

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { SelfAppBuilder } from "@selfxyz/qrcode"
import { SELF_CONFIG, type NearSignatureData } from "@near-citizens/shared"
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
import { Loader2, QrCode, CheckCircle2, AlertCircle, LogOut } from "lucide-react"

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

interface PassportQrScannerProps {
  nearSignature: NearSignatureData
  sessionId: string
  onSuccess: () => void
  onError: (error: string) => void
  onDisconnect: () => void
}

export function PassportQrScanner({ nearSignature, sessionId, onSuccess, onError, onDisconnect }: PassportQrScannerProps) {
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "scanning" | "verifying" | "success" | "error">(
    "idle",
  )

  // Build SelfApp during render using useMemo instead of useEffect + setState
  // This avoids the synchronous setState in effect anti-pattern
  const selfApp = useMemo(() => {
    const nonceBase64 = Buffer.from(nearSignature.nonce).toString("base64")

    const userDefinedData = JSON.stringify({
      accountId: nearSignature.accountId,
      publicKey: nearSignature.publicKey,
      signature: nearSignature.signature,
      nonce: nonceBase64,
      timestamp: nearSignature.timestamp,
    })

    const endpoint = SELF_CONFIG.endpoint

    return new SelfAppBuilder({
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
  }, [nearSignature, sessionId])

  const handleSuccess = () => {
    setVerificationStatus("success")
    onSuccess()
  }

  const handleError = () => {
    setVerificationStatus("error")
    onError("Verification failed. Please try again.")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <CardTitle>Scan QR Code</CardTitle>
        </div>
        <CardDescription>Use the Self mobile app to scan this QR code and generate your passport proof</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verificationStatus === "success" && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
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

        <div className="text-sm text-muted-foreground text-center space-y-2">
          <p className="font-medium">How to verify:</p>
          <ol className="text-left list-decimal list-inside space-y-1 text-xs">
            <li>
              Download the <span className="font-semibold">Self</span> app on your mobile device
            </li>
            <li>Open the app and complete your ID verification</li>
            <li>Return here and scan this QR code with the Self app</li>
          </ol>
          <p className="text-xs mt-2 text-muted-foreground/80">
            Your NEAR wallet signature is securely embedded in this verification
          </p>
        </div>

        <Button onClick={onDisconnect} variant="outline" size="sm" className="w-full">
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          Disconnect Wallet
        </Button>
      </CardContent>
    </Card>
  )
}
