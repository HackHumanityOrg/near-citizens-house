"use client"

import { useEffect } from "react"
import { getErrorTitle, getErrorMessage, isNonRetryableError } from "@/lib/verification-errors"

interface ErrorModalProps {
  isOpen: boolean
  errorMessage?: string
  errorCode?: string
  onClose: () => void
  onRetry: () => void
}

export function ErrorModal({ isOpen, errorMessage, errorCode, onClose, onRetry }: ErrorModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Check if this is a non-retryable error
  const isNonRetryable = isNonRetryableError(errorCode)

  // Default fallback message for the modal context
  const defaultFallback = "There was an error during the verification process. Please re-sign message and try again."

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[6px]" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-black border dark:border-white/20 flex flex-col items-end p-6 sm:p-[40px] rounded-[16px] w-full max-w-[600px]"
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
              <div className="flex flex-col font-inter font-semibold justify-center leading-[0] text-[20px] sm:text-[24px] text-[#090909] dark:text-white tracking-[0.48px]">
                <p className="leading-[1.2]">{getErrorTitle(errorCode)}</p>
              </div>
            </div>
          </div>

          {/* Error message */}
          <div className="flex flex-col font-inter font-normal justify-center text-[14px] text-[#090909] dark:text-neutral-200 w-full">
            <p className="leading-[1.5]">{getErrorMessage(errorCode, errorMessage || defaultFallback)}</p>
          </div>
        </div>

        {/* Button section */}
        <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
          {isNonRetryable ? (
            <button
              onClick={onClose}
              className="basis-0 bg-[#040404] dark:bg-white flex gap-[8px] grow h-[56px] items-center justify-center min-h-px min-w-px px-[24px] py-[14px] rounded-[4px] cursor-pointer hover:opacity-90 transition-opacity"
            >
              <p className="font-inter font-medium leading-[20px] text-[16px] text-[#d8d8d8] dark:text-[#040404] text-center text-nowrap">
                Close
              </p>
            </button>
          ) : (
            <button
              onClick={onRetry}
              className="basis-0 bg-[#040404] dark:bg-white flex gap-[8px] grow h-[56px] items-center justify-center min-h-px min-w-px px-[24px] py-[14px] rounded-[4px] cursor-pointer hover:opacity-90 transition-opacity"
            >
              <p className="font-inter font-medium leading-[20px] text-[16px] text-[#d8d8d8] dark:text-[#040404] text-center text-nowrap">
                Sign Message
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
