"use client"

import { useMemo, useEffect } from "react"
import { SelfAppBuilder } from "@selfxyz/qrcode"
import { SELF_CONFIG, getUniversalLink, type NearSignatureData } from "@near-citizens/shared"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@near-citizens/ui"
import { Smartphone, LogOut } from "lucide-react"

interface PassportDeepLinkProps {
  nearSignature: NearSignatureData
  sessionId: string
  onDisconnect: () => void
}

export function PassportDeepLink({ nearSignature, sessionId, onDisconnect }: PassportDeepLinkProps) {
  const selfApp = useMemo(() => {
    const nonceBase64 = Buffer.from(nearSignature.nonce).toString("base64")

    const userDefinedData = JSON.stringify({
      accountId: nearSignature.accountId,
      publicKey: nearSignature.publicKey,
      signature: nearSignature.signature,
      nonce: nonceBase64,
      timestamp: nearSignature.timestamp,
    })

    return new SelfAppBuilder({
      version: 2,
      appName: SELF_CONFIG.appName,
      scope: SELF_CONFIG.scope,
      endpoint: SELF_CONFIG.endpoint,
      logoBase64: SELF_CONFIG.logoBase64,
      userId: sessionId,
      endpointType: SELF_CONFIG.endpointType,
      userIdType: "uuid",
      userDefinedData: userDefinedData,
      disclosures: SELF_CONFIG.disclosures,
      deeplinkCallback: `${SELF_CONFIG.deeplinkCallback}?sessionId=${sessionId}`,
    }).build()
  }, [nearSignature, sessionId])

  const deeplink = useMemo(() => getUniversalLink(selfApp), [selfApp])

  // Store session ID in localStorage so the callback page can check status
  useEffect(() => {
    localStorage.setItem(
      `self-session-${sessionId}`,
      JSON.stringify({
        status: "pending",
        accountId: nearSignature.accountId,
        timestamp: Date.now(),
      }),
    )
  }, [sessionId, nearSignature.accountId])

  const handleOpenSelfApp = () => {
    window.open(deeplink, "_blank")
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <CardTitle>Verify with Self App</CardTitle>
        </div>
        <CardDescription>Open the Self app to scan your passport and verify your identity</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted rounded-lg text-center">
          <Smartphone className="h-12 w-12 mx-auto mb-3 text-primary" />
          <p className="text-sm text-muted-foreground mb-4">
            Tap the button below to open the Self app and verify your passport
          </p>
          <Button onClick={handleOpenSelfApp} size="lg" className="w-full">
            <Smartphone className="h-5 w-5 mr-2" />
            Open Self App
          </Button>
        </div>

        <div className="text-sm text-muted-foreground text-center space-y-2">
          <p className="font-medium">How to verify:</p>
          <ol className="text-left list-decimal list-inside space-y-1 text-xs">
            <li>
              Make sure you have the <span className="font-semibold">Self</span> app installed
            </li>
            <li>Tap &quot;Open Self App&quot; above</li>
            <li>Scan your passport with the Self app</li>
            <li>You&apos;ll be redirected back here after verification</li>
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
