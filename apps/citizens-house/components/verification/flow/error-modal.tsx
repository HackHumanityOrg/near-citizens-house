"use client"

import { useEffect, useRef } from "react"
import { Button } from "@near-citizens/ui"
import { trackEvent } from "@/lib/analytics"
import { getErrorTitle, getErrorMessage, isNonRetryableError } from "@/lib/schemas/errors"

type ErrorStage = "wallet_connect" | "message_sign" | "qr_scan" | "polling" | "unknown"

function determineErrorStage(errorCode?: string): ErrorStage {
  if (!errorCode) return "unknown"
  const code = errorCode.toUpperCase()
  if (code.includes("WALLET") || code.includes("CONNECT")) return "wallet_connect"
  if (code.includes("SIGN") || code.includes("SIGNATURE")) return "message_sign"
  if (code.includes("QR") || code.includes("SCAN")) return "qr_scan"
  if (code.includes("TIMEOUT") || code.includes("POLL") || code.includes("EXPIRED")) return "polling"
  return "unknown"
}

interface ErrorModalProps {
  isOpen: boolean
  errorMessage?: string
  errorCode?: string
  onClose: () => void
  onRetry: () => void
}

export function ErrorModal({ isOpen, errorMessage, errorCode, onClose, onRetry }: ErrorModalProps) {
  const hasTrackedErrorShown = useRef(false)
  const lastErrorCode = useRef<string | undefined>(undefined)

  // Track error_shown when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasTrackedErrorShown.current = false
      lastErrorCode.current = undefined
      return
    }

    // Only track if we haven't tracked this error yet
    if (hasTrackedErrorShown.current && lastErrorCode.current === errorCode) return
    hasTrackedErrorShown.current = true
    lastErrorCode.current = errorCode

    trackEvent({
      domain: "verification",
      action: "error_shown",
      errorCode: errorCode || "unknown",
      stage: determineErrorStage(errorCode),
    })
  }, [isOpen, errorCode])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        // Track abandonment only for retryable errors
        if (!isNonRetryableError(errorCode)) {
          trackEvent({
            domain: "verification",
            action: "error_abandoned",
            errorCode: errorCode || "unknown",
          })
        }
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose, errorCode])

  if (!isOpen) return null

  // Check if this is a non-retryable error
  const isNonRetryable = isNonRetryableError(errorCode)

  // Default fallback message for the modal context
  const defaultFallback = "There was an error during the verification process. Please re-sign message and try again."

  const handleBackdropClose = () => {
    // Track abandonment only for retryable errors (user chose to dismiss instead of retry)
    if (!isNonRetryable) {
      trackEvent({
        domain: "verification",
        action: "error_abandoned",
        errorCode: errorCode || "unknown",
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" data-testid="error-modal">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[6px]"
        onClick={handleBackdropClose}
        aria-hidden="true"
        data-testid="error-modal-backdrop"
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-black border dark:border-white/20 flex flex-col items-end p-6 md:p-[40px] rounded-[16px] w-full max-w-[600px]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full">
          {/* Header with icon and title */}
          <div className="flex gap-[16px] items-start w-full">
            {/* Red error icon */}
            <p className="text-[22px] leading-[28px] text-[#ff3b30] text-nowrap tracking-[0px]" aria-hidden="true">
              {isNonRetryable ? "⚠" : "ⓘ"}
            </p>
            {/* Title */}
            <div className="flex items-center">
              <div className="flex flex-col font-inter font-semibold justify-center leading-[0] text-[20px] md:text-[24px] text-[#090909] dark:text-white tracking-[0.48px]">
                <p className="leading-[1.2]" data-testid="error-title">
                  {getErrorTitle(errorCode)}
                </p>
              </div>
            </div>
          </div>

          {/* Error message */}
          <div className="flex flex-col font-inter font-normal justify-center text-[14px] text-[#090909] dark:text-neutral-200 w-full">
            <p className="leading-[1.5]" data-testid="error-message">
              {getErrorMessage(errorCode, errorMessage || defaultFallback)}
            </p>
          </div>
        </div>

        {/* Button section */}
        <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
          {isNonRetryable ? (
            <Button
              onClick={onClose}
              variant="citizens-primary"
              size="citizens-3xl"
              data-testid="error-close-button"
              className="flex-1"
            >
              Close
            </Button>
          ) : (
            <Button
              onClick={() => {
                trackEvent({
                  domain: "verification",
                  action: "error_retry_clicked",
                  errorCode: errorCode || "unknown",
                })
                onRetry()
              }}
              variant="citizens-primary"
              size="citizens-3xl"
              data-testid="error-retry-button"
              className="flex-1"
            >
              Sign Message
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
