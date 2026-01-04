"use client"

import { useEffect } from "react"

interface ErrorModalProps {
  isOpen: boolean
  errorMessage?: string
  onClose: () => void
  onRetry: () => void
}

export function ErrorModal({ isOpen, errorMessage: _errorMessage, onClose, onRetry }: ErrorModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-[6px]" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-neutral-800 flex flex-col items-end p-[40px] rounded-[16px] w-[600px]"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full">
          {/* Header with icon and title */}
          <div className="flex gap-[16px] items-start w-full">
            {/* Red error icon - using Font Awesome character or emoji */}
            <p className="text-[22px] leading-[28px] text-[#ff3b30] text-nowrap tracking-[0px]" aria-hidden="true">
              ⓘ
            </p>
            {/* Title */}
            <div className="flex h-[29.815px] items-center justify-center w-[218.107px]">
              <div className="flex flex-col font-inter font-semibold justify-center leading-[0] text-[24px] text-[#090909] dark:text-white text-nowrap tracking-[0.48px]">
                <p className="leading-[1.2]">Verification Failed</p>
              </div>
            </div>
          </div>

          {/* Error message */}
          <div className="flex flex-col font-inter font-normal justify-center leading-[0] text-[14px] text-[#090909] dark:text-neutral-200 w-full">
            <p className="leading-[1.4]">There was an error during the verification process. Please re-sgin message</p>
          </div>
        </div>

        {/* Button section */}
        <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
          <button
            onClick={onRetry}
            className="basis-0 bg-[#040404] dark:bg-white flex gap-[8px] grow h-[56px] items-center justify-center min-h-px min-w-px px-[24px] py-[14px] rounded-[4px] hover:opacity-90 transition-opacity"
          >
            <p className="font-inter font-medium leading-[20px] text-[16px] text-[#d8d8d8] dark:text-[#040404] text-center text-nowrap">
              Sign Message
            </p>
          </button>
        </div>
      </div>
    </div>
  )
}
