"use client"

import { VerificationCtaButton } from "./verification-cta-button"

export function VerificationSteps() {
  return (
    <div className="flex w-full flex-col gap-[40px] bg-white px-6 py-[80px] dark:bg-neutral-800 lg:px-[80px] xl:pl-[112px] xl:pr-[80px] font-fk-grotesk">
      {/* Header */}
      <div className="flex flex-col gap-[24px]">
        <h3 className="text-[32px] leading-[36px] text-[#111] dark:text-white md:text-[44px] md:leading-[48px] font-medium">
          Let&apos;s get started
        </h3>
        <p className="text-[16px] leading-[24px] text-[#111] dark:text-white">Estimated time: 8-12 minutes.</p>

        {/* Progress line with dots - hidden on mobile, visible on desktop */}
        <div className="relative hidden h-[16px] w-full max-w-[1084px] lg:block">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-black dark:bg-white" />
          <div className="absolute left-0 top-1/2 h-[16px] w-[16px] -translate-y-1/2 bg-[#d9d9d9] dark:bg-[#333]" />
          <div className="absolute left-1/2 top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 bg-[#d9d9d9] dark:bg-[#333]" />
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-[32px] lg:flex-row lg:gap-[56px]">
        <div className="flex flex-1 flex-col gap-[8px]">
          <span className="text-[16px] leading-[24px] text-[#090909] dark:text-[#a3a3a3]">STEP 1</span>
          <h4 className="text-[24px] leading-[32px] text-[#111] dark:text-white font-medium">Verify NEAR wallet</h4>
          <p className="text-[16px] leading-[24px] text-[#757575] dark:text-[#a3a3a3]">
            First, connect your NEAR wallet to begin the identity verification process.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-[8px]">
          <span className="text-[16px] leading-[24px] text-[#090909] dark:text-[#a3a3a3]">STEP 2</span>
          <h4 className="text-[24px] leading-[32px] text-[#111] dark:text-white font-medium">Verify Identity</h4>
          <p className="text-[16px] leading-[24px] text-[#8e8e93] dark:text-[#a3a3a3]">
            Use the Self mobile app to scan the QR code and generate your ID proof.
          </p>
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex">
        <VerificationCtaButton />
      </div>
    </div>
  )
}
