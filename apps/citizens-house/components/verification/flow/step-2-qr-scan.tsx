"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { SelfAppBuilder } from "@selfxyz/qrcode"
import { SELF_CONFIG, getUniversalLink, type NearSignatureData } from "@near-citizens/shared"
import { Loader2, Info, Ban, Check } from "lucide-react"
import { Button } from "@near-citizens/ui"
import { useAnalytics } from "@/lib/analytics"
import { getErrorMessage } from "@/lib/verification-errors"
import { StarPattern } from "../icons/star-pattern"

type SelfApp = ReturnType<SelfAppBuilder["build"]>

interface SelfQRcodeProps {
  selfApp: SelfApp
  onSuccess: () => void
  onError: () => void
  size?: number
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
      <div className="flex items-center justify-center size-[260px]">
        <Loader2 className="h-12 w-12 animate-spin text-[#ffda1e]" />
      </div>
    ),
  },
)

interface Step2QrScanProps {
  nearSignature: NearSignatureData
  sessionId: string
  onSuccess: (attestationId?: string | number) => void
  onError: (error: string, code?: string) => void
}

export function Step2QrScan({ nearSignature, sessionId, onSuccess, onError }: Step2QrScanProps) {
  const analytics = useAnalytics()
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "scanning" | "verifying" | "success" | "error">(
    "idle",
  )
  const trackedStartRef = useRef(false)
  const trackedQrDisplayRef = useRef(false)
  const confirmationInProgressRef = useRef(false)

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

  const finalizeWithError = (message: string, code?: string) => {
    confirmationInProgressRef.current = false
    analytics.trackVerificationFailed(nearSignature.accountId, code || "VERIFICATION_FAILED", message)
    setVerificationStatus("error")
    onError(message, code)
  }

  const confirmBackendStatus = async () => {
    const maxPolls = 60 // 2 minutes at 2s interval
    const pollIntervalMs = 2000

    for (let pollCount = 0; pollCount < maxPolls; pollCount++) {
      try {
        const response = await fetch(`/api/verification/status?sessionId=${encodeURIComponent(sessionId)}`)

        if (response.ok) {
          const data = await response.json()

          if (data.status === "success") {
            const method = window.innerWidth < 768 ? "deeplink" : "qr"
            analytics.trackVerificationCompleted(nearSignature.accountId, method)
            confirmationInProgressRef.current = false
            setVerificationStatus("success")
            onSuccess(data.attestationId)
            return
          }

          if (data.status === "error") {
            const code = data.errorCode || data.error
            const message = getErrorMessage(code, data.error)
            finalizeWithError(message, code)
            return
          }

          if (data.status === "expired") {
            finalizeWithError("Verification timed out. Please try again.", "TIMEOUT")
            return
          }
        } else if (response.status >= 400 && response.status < 500 && response.status !== 404) {
          finalizeWithError("Verification session expired. Please try again.", "TIMEOUT")
          return
        }
      } catch (error) {
        console.warn("Failed to check verification status", error)
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    finalizeWithError("Verification timed out. Please try again.", "TIMEOUT")
  }

  const handleSuccess = () => {
    if (confirmationInProgressRef.current) return
    confirmationInProgressRef.current = true
    setVerificationStatus("verifying")
    void confirmBackendStatus()
  }

  const handleError = () => {
    finalizeWithError("Verification failed. Please try again.", "QR_SCAN_FAILED")
  }

  return (
    <div className="w-full" data-testid="step2-section">
      {/* Hero Section with gradient background - extends behind header */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.5)_0%,_rgba(253,221,57,0.4)_20%,_rgba(249,230,136,0.3)_40%,_rgba(245,236,189,0.15)_60%,_rgba(242,242,242,0.05)_80%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_1200px_800px_at_center_center,_rgba(255,218,30,0.3)_0%,_rgba(253,221,57,0.2)_20%,_rgba(249,230,136,0.15)_40%,_transparent_70%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="step2Star" />
        </div>

        {/* Step indicator - positioned in upper area of hero */}
        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          {/* Stepper - consistent width across all steps */}
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            {/* Fixed-width columns for circles (40px each), flexible middle for line */}
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              {/* Step 1 circle - completed (green with checkmark) */}
              <div
                className="col-start-1 row-start-1 flex items-center justify-center"
                data-testid="step2-indicator-completed"
                data-step-state="completed"
              >
                <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full size-[40px]">
                  <Check className="w-5 h-5 text-white dark:text-black" strokeWidth={3} />
                </div>
              </div>

              {/* Connecting line - equidistant from both circles, vertically centered */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black dark:bg-white/40" />
              </div>

              {/* Step 2 circle - active (black border, bold number) */}
              <div
                className="col-start-3 row-start-1 flex items-center justify-center"
                data-testid="step2-indicator-active"
                data-step-state="active"
              >
                <div className="border-2 border-[#090909] dark:border-white bg-white dark:bg-black flex items-center justify-center rounded-full size-[40px]">
                  <span className="font-fk-grotesk font-bold text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    2
                  </span>
                </div>
              </div>

              {/* Labels row - overflow their 40px columns, centered under circles */}
              <span
                data-testid="step2-label-1"
                className="col-start-1 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-verified whitespace-nowrap text-center"
              >
                NEAR Wallet Verified
              </span>
              <span
                data-testid="step2-label-2"
                className="col-start-3 row-start-2 justify-self-center font-fk-grotesk font-bold text-[16px] md:text-[20px] leading-[28px] text-[#090909] dark:text-white whitespace-nowrap text-center"
              >
                Verify Identity
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section - overlaps with hero via negative margin */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4 md:px-6">
        <div className="flex flex-col items-center w-full">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center p-0 md:p-[40px] w-full max-w-[1032px] overflow-hidden">
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col md:flex-row items-start justify-center w-full gap-[36px] md:gap-[40px]">
                {/* Left Column: QR Code (Desktop) or Deep Link Button (Mobile) */}
                <div className="flex flex-col gap-[16px] items-start pt-[40px] md:pt-[40px] w-full md:w-auto md:flex-1 px-[24px] md:px-0">
                  {/* Mobile: Title, description, and button */}
                  <div className="md:hidden flex flex-col gap-[16px] items-start w-full">
                    <h2 className="font-fk-grotesk font-medium text-[24px] leading-[32px] text-[#090909] dark:text-white">
                      Verify in Self app
                    </h2>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#090909] dark:text-neutral-200">
                      Install and use the Self app to generate your proof of identity.
                    </p>
                    <Button
                      onClick={handleOpenSelfApp}
                      variant="citizens-primary"
                      className="w-full h-[56px] text-[16px]"
                      data-testid="open-self-app-button"
                    >
                      Open Self app
                    </Button>
                  </div>

                  {/* Desktop: QR Code */}
                  <div className="hidden md:flex flex-col items-center w-full" data-testid="qr-code-container">
                    <div className="flex flex-col gap-[24px] items-start w-[260px]">
                      <p className="font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-white">
                        Scan this QR code to install and use the Self app to generate your proof of identity.
                      </p>
                      <SelfQRcodeWrapper
                        selfApp={selfAppDesktop}
                        onSuccess={handleSuccess}
                        onError={handleError}
                        size={260}
                      />
                    </div>
                  </div>

                  {verificationStatus === "verifying" && (
                    <div className="mt-[16px] flex items-center gap-[8px] text-[14px] text-[#757575] dark:text-[#a3a3a3]">
                      <Loader2 className="h-[16px] w-[16px] animate-spin" />
                      <span className="font-fk-grotesk">Finalizing verification on-chain...</span>
                    </div>
                  )}
                </div>

                {/* Right Column: Instructions Panel */}
                <div className="bg-[#f8fafc] dark:bg-white/5 w-full md:w-[503px] p-[20px] px-[40px] md:p-[40px] md:rounded-[16px] flex flex-col gap-[24px] items-center">
                  {/* How to verify */}
                  <div className="flex flex-col gap-[16px] items-start w-full">
                    <p
                      className="font-fk-grotesk font-medium text-[24px] leading-[32px] text-black dark:text-white"
                      data-testid="how-to-verify-heading"
                    >
                      How to verify?
                    </p>
                    {/* Mobile subtitle */}
                    <p className="md:hidden font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200">
                      Click the &quot;Open Self app&quot; button to follow these steps:
                    </p>
                    {/* Desktop subtitle */}
                    <p className="hidden md:block font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200">
                      Scan the QR code to follow these steps:
                    </p>
                  </div>

                  {/* Numbered Steps */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[12px] items-start leading-[28px] text-[16px]">
                      <span className="font-fk-grotesk font-medium text-[#090909] dark:text-white flex-shrink-0">
                        01
                      </span>
                      <span className="font-fk-grotesk text-black dark:text-neutral-200">
                        Install the Self app on your mobile device
                      </span>
                    </div>
                    <div className="flex gap-[12px] items-start leading-[28px] text-[16px]">
                      <span className="font-fk-grotesk font-medium text-[#090909] dark:text-white flex-shrink-0">
                        02
                      </span>
                      <span className="font-fk-grotesk text-black dark:text-neutral-200">
                        Open the app and complete your ID verification
                      </span>
                    </div>
                    <div className="flex gap-[12px] items-start leading-[28px] text-[16px]">
                      <span className="font-fk-grotesk font-medium text-[#090909] dark:text-white flex-shrink-0">
                        03
                      </span>
                      {/* Mobile text */}
                      <span className="md:hidden font-fk-grotesk text-black dark:text-neutral-200">
                        Return here and click the button again to verify your identity
                      </span>
                      {/* Desktop text */}
                      <span className="hidden md:inline font-fk-grotesk text-black dark:text-neutral-200">
                        Return here and scan this QR code with the Self app
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px w-full bg-black dark:bg-white/10" />

                  {/* Privacy Info */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[8px] items-center">
                      <Info className="w-[22px] h-[22px] text-black dark:text-white flex-shrink-0" />
                      <span className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-black dark:text-white">
                        Your Privacy is Protected
                      </span>
                    </div>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#757575] dark:text-[#a3a3a3]">
                      Your ID documents are never stored. Only a cryptographic proof of uniqueness is retained.
                    </p>
                  </div>

                  {/* Failed Verification Info */}
                  <div className="flex flex-col gap-[8px] items-start w-full">
                    <div className="flex gap-[8px] items-center">
                      <Ban className="w-[22px] h-[22px] text-black dark:text-white flex-shrink-0" />
                      <span className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-black dark:text-white">
                        Verification Failed
                      </span>
                    </div>
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#757575] dark:text-[#a3a3a3]">
                      If you get a &quot;Verification Failed&quot; message, simply redo the signature. The retry
                      function might take longer than usual.
                    </p>
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
