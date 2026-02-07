"use client"

import { useEffect, useRef } from "react"
import * as Sentry from "@sentry/nextjs"
import { Clock, Info } from "lucide-react"
import { Button } from "@near-citizens/ui"
import { getErrorTitle, getErrorMessage, type VerificationErrorCode } from "@/lib/schemas/errors"
import { verificationStatusResponseSchema } from "@/lib/schemas/api/verification"
import { trackEvent, getPlatform } from "@/lib/analytics"
import { StarPattern } from "../icons/star-pattern"

interface StepHoldProps {
  errorCode?: VerificationErrorCode
  errorMessage?: string
  isConnected?: boolean
  accountId?: string
  onDisconnect: () => void
  onStatusRecovered?: () => void
}

export function StepHold({
  errorCode = "VERIFICATION_ON_HOLD",
  errorMessage,
  isConnected,
  accountId,
  onDisconnect,
  onStatusRecovered,
}: StepHoldProps) {
  const title = getErrorTitle(errorCode)
  const message = getErrorMessage(errorCode, errorMessage)

  // Store callback in ref to avoid restarting interval on callback changes
  const onStatusRecoveredRef = useRef(onStatusRecovered)
  useEffect(() => {
    onStatusRecoveredRef.current = onStatusRecovered
  }, [onStatusRecovered])

  // Track hold page displayed on mount
  const hasTrackedDisplay = useRef(false)
  useEffect(() => {
    if (!hasTrackedDisplay.current && accountId) {
      hasTrackedDisplay.current = true
      trackEvent({
        domain: "verification",
        action: "hold_page_view",
        platform: getPlatform(),
        accountId,
        errorCode,
      })
    }
  }, [accountId, errorCode])

  // Poll for status recovery (manual approval, webhook arrived late, etc.)
  useEffect(() => {
    if (!accountId || !onStatusRecoveredRef.current) return

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/verification/status?accountId=${encodeURIComponent(accountId)}`)
        const data = await response.json()
        const parsed = verificationStatusResponseSchema.safeParse(data)
        if (parsed.success && parsed.data.state === "approved") {
          trackEvent({
            domain: "verification",
            action: "status_recover",
            platform: getPlatform(),
            accountId,
            recoveredFrom: "hold",
          })
          onStatusRecoveredRef.current?.()
        } else if (!parsed.success) {
          Sentry.logger.warn("hold_status_poll_invalid_response", {
            account_id: accountId,
            validation_error: parsed.error.message,
          })
        }
      } catch (err) {
        // Track polling errors
        trackEvent({
          domain: "verification",
          action: "hold_polling_fail",
          platform: getPlatform(),
          accountId,
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        })
        Sentry.logger.warn("hold_status_poll_failed", {
          account_id: accountId,
          error_message: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    // Check immediately, then every 30 seconds
    checkStatus()
    const interval = setInterval(checkStatus, 30000)
    return () => clearInterval(interval)
  }, [accountId])

  // Handle disconnect with tracking
  const handleDisconnect = () => {
    if (accountId) {
      trackEvent({
        domain: "verification",
        action: "hold_page_disconnect_click",
        platform: getPlatform(),
        accountId,
      })
    }
    onDisconnect()
  }

  return (
    <div className="w-full" data-testid="hold-section">
      {/* Hero Section with yellow gradient background - extends behind header */}
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="stepHoldStar" />
        </div>

        {/* Content in hero */}
        <div className="relative flex flex-col items-center justify-start -mt-[8px] md:pt-[16px] h-full px-8 md:px-4 z-10">
          {/* Container - consistent width */}
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px] relative h-[160px]">
            <div className="absolute inset-0 flex flex-col items-center">
              {/* Circle container - same height as success step */}
              <div className="relative w-full flex items-center justify-center h-[40px]">
                {/* Yellow clock circle (centered) */}
                <div
                  className="absolute left-1/2 top-1/2 flex items-center justify-center"
                  style={{ transform: "translate(-50%, -50%)" }}
                >
                  <div className="border-2 border-[#FFDA1E] bg-[#FFDA1E] flex items-center justify-center rounded-full w-[60px] h-[60px] md:w-[80px] md:h-[80px]">
                    <Clock className="w-8 h-8 md:w-10 md:h-10 text-black" strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* Hold title - same positioning as success message */}
              <h1
                className="absolute top-[80px] md:top-[100px] left-0 right-0 font-fk-grotesk font-medium text-[20px] md:text-[24px] leading-[28px] md:leading-[32px] text-[#B8860B] dark:text-[#FFDA1E] text-center"
                data-testid="hold-heading"
              >
                {title}
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* Card Section - overlaps with hero via negative margin */}
      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4 md:px-6">
        <div className="flex flex-col items-center w-full">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center py-[24px] md:py-[40px] px-0 w-full max-w-[650px]">
            <div className="flex flex-col gap-[24px] md:gap-[40px] items-center w-full max-w-[520px] px-[24px] md:px-0">
              {/* Hold message */}
              <div className="flex flex-col gap-[16px] items-start w-full">
                <p
                  className="font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200 w-full"
                  data-testid="hold-message"
                >
                  {message}
                </p>
              </div>

              {/* Disconnect Wallet button - only show if connected */}
              {isConnected && (
                <>
                  <Button
                    onClick={handleDisconnect}
                    variant="outline"
                    className="h-[48px] px-[24px] py-[14px] border-black dark:border-white text-[#040404] dark:text-white font-medium rounded-[4px]"
                    data-testid="disconnect-wallet-button-hold"
                  >
                    Disconnect Wallet
                  </Button>

                  {/* Info text */}
                  <div className="flex gap-[8px] items-start w-full">
                    <Info className="mt-[2px] h-[22px] w-[22px] text-black dark:text-white shrink-0" />
                    <p className="font-fk-grotesk text-[16px] leading-[28px] text-[#757575] dark:text-neutral-400 w-full">
                      You will be redirected to the home page after disconnecting.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
