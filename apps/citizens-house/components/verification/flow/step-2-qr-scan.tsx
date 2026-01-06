"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { SelfAppBuilder } from "@selfxyz/qrcode"
import { SELF_CONFIG, getUniversalLink, type NearSignatureData } from "@near-citizens/shared"
import { Loader2, Info, Ban } from "lucide-react"
import { Button } from "@near-citizens/ui"
import { useAnalytics } from "@/lib/analytics"

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
      <div className="flex items-center justify-center size-[296px]">
        <Loader2 className="h-12 w-12 animate-spin text-[#ffda1e]" />
      </div>
    ),
  },
)

interface Step2QrScanProps {
  nearSignature: NearSignatureData
  sessionId: string
  onSuccess: () => void
  onError: (error: string, code?: string) => void
}

export function Step2QrScan({ nearSignature, sessionId, onSuccess, onError }: Step2QrScanProps) {
  const analytics = useAnalytics()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "scanning" | "verifying" | "success" | "error">(
    "idle",
  )
  const trackedStartRef = useRef(false)
  const trackedQrDisplayRef = useRef(false)

  // Track verification started and QR code displayed
  useEffect(() => {
    if (!trackedStartRef.current) {
      const method = window.innerWidth < 768 ? "deeplink" : "qr"
      analytics.trackVerificationStarted(nearSignature.accountId, method)
      trackedStartRef.current = true
    }

    if (!trackedQrDisplayRef.current) {
      const method = window.innerWidth < 768 ? "deeplink" : "qr"
      analytics.trackQrCodeDisplayed(nearSignature.accountId, method)
      trackedQrDisplayRef.current = true
    }
  }, [nearSignature.accountId, analytics])

  // Build SelfApp for QR code (desktop)
  const selfAppDesktop = useMemo(() => {
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
    }).build()
  }, [nearSignature, sessionId])

  // Build SelfApp for deeplink (mobile)
  const selfAppMobile = useMemo(() => {
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

  const deeplink = useMemo(() => getUniversalLink(selfAppMobile), [selfAppMobile])

  // Store session ID in localStorage for mobile flow
  useEffect(() => {
    try {
      localStorage.setItem(
        `self-session-${sessionId}`,
        JSON.stringify({
          status: "pending",
          accountId: nearSignature.accountId,
          timestamp: Date.now(),
        }),
      )
    } catch {
      // Storage may be restricted in private browsing or embedded webviews
    }
  }, [sessionId, nearSignature.accountId])

  const handleOpenSelfApp = () => {
    analytics.trackDeeplinkOpened(nearSignature.accountId)
    window.open(deeplink, "_blank")
  }

  const handleSuccess = () => {
    const method = window.innerWidth < 768 ? "deeplink" : "qr"
    analytics.trackVerificationCompleted(nearSignature.accountId, method)
    setVerificationStatus("success")
    onSuccess()
  }

  const handleError = () => {
    analytics.trackVerificationFailed(nearSignature.accountId, "QR_SCAN_FAILED", "QR scan verification failed")
    setVerificationStatus("error")
    onError("Verification failed. Please try again.", "QR_SCAN_FAILED")
  }

  return (
    <div className="flex flex-col items-center pb-0 pt-[40px] w-full px-4">
      <div className="flex flex-col items-center w-full">
        <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex items-center justify-center p-4 sm:p-[40px]">
          <div className="flex flex-col items-center w-full">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-[80px] items-start justify-center w-full">
              {/* Left Column: QR Code or Deep Link */}
              <div className="flex flex-col items-center pt-0 lg:pt-[40px] w-full lg:w-auto">
                {/* Mobile: Open Self App button */}
                <div className="md:hidden flex flex-col items-center w-full">
                  <p className="text-[18px] sm:text-[22px] leading-[28px] font-medium text-black dark:text-white text-center mb-[24px]">
                    Open the Self app to verify
                  </p>
                  <Button
                    onClick={handleOpenSelfApp}
                    size="lg"
                    className="w-full bg-[#ffda1e] hover:bg-[#e5c41a] text-black"
                  >
                    Open Self App
                  </Button>
                </div>

                {/* Desktop: QR Code */}
                <div className="hidden md:flex flex-col items-center">
                  <p className="text-[18px] sm:text-[22px] leading-[28px] font-medium text-black dark:text-white text-center mb-4">
                    Scan the QR code to use the Self app.
                  </p>
                  <div className="size-[240px] sm:size-[296px]">
                    <SelfQRcodeWrapper selfApp={selfAppDesktop} onSuccess={handleSuccess} onError={handleError} />
                  </div>
                </div>
              </div>

              {/* Right Column: Instructions Panel */}
              <div className="bg-[rgba(242,242,247,0.8)] dark:bg-white/5 w-full lg:w-[503px] p-6 sm:p-[32px] flex flex-col gap-[24px] items-center">
                {/* How to verify */}
                <div className="flex flex-col gap-[16px] items-start w-full max-w-[428px]">
                  <p className="text-[22px] leading-[28px] font-medium text-black dark:text-white">How to verify?</p>
                  <div className="flex flex-col justify-center text-[16px] font-fk-grotesk text-black dark:text-neutral-200 text-center leading-[0]">
                    <p className="leading-[24px]">To get verified, you need to follow these steps:</p>
                  </div>
                </div>

                {/* Numbered Steps */}
                <div className="flex flex-col gap-[16px] items-start w-full">
                  <div className="flex gap-[8px] items-start w-full">
                    <p className="text-[24px] leading-[32px] font-medium text-[#090909] dark:text-white shrink-0 min-w-[40px]">
                      01
                    </p>
                    <p className="text-[16px] leading-[24px] font-fk-grotesk text-black dark:text-neutral-200 pt-[4px]">
                      Download the Self app on your mobile device
                    </p>
                  </div>
                  <div className="flex gap-[8px] items-start w-full">
                    <p className="text-[24px] leading-[32px] font-medium text-[#090909] dark:text-white shrink-0 min-w-[40px]">
                      02
                    </p>
                    <p className="text-[16px] leading-[24px] font-fk-grotesk text-black dark:text-neutral-200 pt-[4px]">
                      Open the app and complete your ID verification
                    </p>
                  </div>
                  <div className="flex gap-[8px] items-start w-full">
                    <p className="text-[24px] leading-[32px] font-medium text-[#090909] dark:text-white shrink-0 min-w-[40px]">
                      03
                    </p>
                    {/* Mobile text */}
                    <p className="md:hidden text-[16px] leading-[24px] font-fk-grotesk text-black dark:text-neutral-200 pt-[4px]">
                      Tap the button above to open Self and complete verification
                    </p>
                    {/* Desktop text */}
                    <p className="hidden md:block text-[16px] leading-[24px] font-fk-grotesk text-black dark:text-neutral-200 pt-[4px]">
                      Return here and scan the QR code with Self app
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full relative">
                  <div className="absolute h-0 left-0 right-0 top-[calc(50%+0.5px)] translate-y-[-50%]">
                    <div className="absolute inset-[-1px_0_0_0] border-t border-black dark:border-white" />
                  </div>
                </div>

                {/* Privacy Info */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="flex gap-[8px] items-center">
                    <Info className="w-[22px] h-[22px] text-black dark:text-white" />
                    <div className="flex flex-col justify-center text-[16px] font-fk-grotesk text-black dark:text-neutral-200 text-center leading-[0]">
                      <p className="leading-[24px]">Your Privacy is Protected</p>
                    </div>
                  </div>
                  <p className="text-[16px] leading-[24px] font-fk-grotesk text-[#757575] dark:text-[#a3a3a3] w-full">
                    Your ID documents are never stored. Only a cryptographic proof of uniqueness is retained.
                  </p>
                </div>

                {/* Failed Verification Info */}
                <div className="flex flex-col gap-[8px] items-start w-full">
                  <div className="flex gap-[8px] items-center">
                    <Ban className="w-[22px] h-[22px] text-black dark:text-white" />
                    <div className="flex flex-col justify-center text-[16px] font-fk-grotesk text-black dark:text-neutral-200 text-center leading-[0]">
                      <p className="leading-[24px]">Verification Failed</p>
                    </div>
                  </div>
                  {/* Mobile text */}
                  <p className="md:hidden text-[16px] leading-[24px] font-fk-grotesk text-[#757575] dark:text-[#a3a3a3] w-full">
                    If verification fails, simply redo the signature.
                  </p>
                  {/* Desktop text */}
                  <p className="hidden md:block text-[16px] leading-[24px] font-fk-grotesk text-[#757575] dark:text-[#a3a3a3] w-full">
                    If your QR code scan returns &quot;Failed verification,&quot; simply redo the signature.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
