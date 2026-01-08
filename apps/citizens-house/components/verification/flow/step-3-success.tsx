"use client"

import { useState, useEffect } from "react"
import { Check } from "lucide-react"
import { Button } from "@near-citizens/ui"
import { StarPattern } from "../icons/star-pattern"

interface Step3SuccessProps {
  accountId: string
  onDisconnect?: () => void
  onVoteForProposals?: () => void
}

export function Step3Success({ accountId, onDisconnect }: Step3SuccessProps) {
  const [animationPhase, setAnimationPhase] = useState<"initial" | "animating" | "complete">("initial")

  useEffect(() => {
    // Start animation after 500ms
    const timer1 = setTimeout(() => {
      setAnimationPhase("animating")
    }, 500)

    // Complete animation after 1000ms (500ms delay + 500ms animation)
    const timer2 = setTimeout(() => {
      setAnimationPhase("complete")
    }, 1000)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  return (
    <div className="w-full">
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
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="step3Star" />
        </div>

        {/* Content in hero */}
        <div className="relative flex flex-col items-center justify-start -mt-[8px] md:pt-[16px] h-full px-8 md:px-4 z-10">
          {/* Stepper container - consistent width */}
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px] relative">
            {/* Two-step stepper (initial state) */}
            <div
              className={`grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px] transition-all duration-500 ease-out ${
                animationPhase === "initial" ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Step 1 circle - completed */}
              <div className="col-start-1 row-start-1 flex items-center justify-center">
                <div className="border-2 border-[#007a4d] bg-[#007a4d] flex items-center justify-center rounded-full size-[40px]">
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
              </div>

              {/* Connecting line */}
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black dark:bg-white/40" />
              </div>

              {/* Step 2 circle - completed */}
              <div className="col-start-3 row-start-1 flex items-center justify-center">
                <div className="border-2 border-[#007a4d] bg-[#007a4d] flex items-center justify-center rounded-full size-[40px]">
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
              </div>

              {/* Labels */}
              <span className="col-start-1 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-[#007a4d] whitespace-nowrap text-center">
                NEAR Wallet Verified
              </span>
              <span className="col-start-3 row-start-2 justify-self-center font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-[#007a4d] whitespace-nowrap text-center">
                Identity Verified
              </span>
            </div>

            {/* Merged single circle (final state) */}
            <div
              className={`absolute inset-0 flex flex-col items-center justify-start gap-[24px] md:gap-[32px] transition-opacity duration-500 ease-out ${
                animationPhase === "initial" ? "opacity-0" : "opacity-100"
              }`}
            >
              {/* Large green checkmark */}
              <div
                className={`border-2 border-[#007a4d] bg-[#007a4d] flex items-center justify-center rounded-full shrink-0 transition-transform duration-500 ease-out ${
                  animationPhase === "initial"
                    ? "w-[40px] min-w-[40px] h-[40px] min-h-[40px] scale-50"
                    : "w-[60px] min-w-[60px] h-[60px] min-h-[60px] md:w-[80px] md:min-w-[80px] md:h-[80px] md:min-h-[80px] scale-100"
                }`}
              >
                <Check
                  className={`text-white ${animationPhase === "initial" ? "w-5 h-5" : "w-8 h-8 md:w-10 md:h-10"}`}
                  strokeWidth={3}
                />
              </div>

              {/* Success message - fades in after merge */}
              <h1
                className={`font-fk-grotesk font-medium text-[20px] md:text-[24px] leading-[28px] md:leading-[32px] text-[#007a4d] text-center transition-opacity duration-500 ease-out ${
                  animationPhase === "complete" ? "opacity-100" : "opacity-0"
                }`}
                style={{ transitionDelay: animationPhase === "complete" ? "200ms" : "0ms" }}
              >
                NEAR Verified Account successfully created
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
              {/* Mobile title */}
              <h2 className="md:hidden font-fk-grotesk font-medium text-[24px] leading-[32px] text-[#090909] dark:text-white w-full">
                NEAR Verified Account Complete
              </h2>

              {/* Desktop welcome message */}
              <p className="hidden md:block font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200 w-full">
                Welcome to Citizens House! You are now eligible to participate in governance decisions.
              </p>

              {/* Verification status box */}
              <div className="flex flex-col items-start w-full rounded-[8px] overflow-hidden">
                {/* NEAR Wallet row */}
                <div className="bg-[#f8fafc] dark:bg-white/5 border-b border-[#cbd5e1] dark:border-white/10 flex items-center justify-between px-[8px] md:px-[16px] py-[16px] w-full">
                  {/* Mobile: stacked layout */}
                  <div className="flex md:hidden flex-col gap-[16px] flex-1 min-w-0">
                    <span className="font-fk-grotesk font-semibold text-[14px] leading-[14px] text-black dark:text-white">
                      NEAR Wallet
                    </span>
                    <span className="font-fk-grotesk text-[14px] leading-[14px] text-black dark:text-neutral-200 truncate">
                      {accountId}
                    </span>
                  </div>
                  {/* Mobile: Verified badge */}
                  <div className="md:hidden bg-[#f8fafc] dark:bg-transparent border border-[#007a4d] flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-[#007a4d] shrink-0">
                    <Check className="w-5 h-5" strokeWidth={2} />
                    <span className="font-poppins text-[12px] leading-[1.4] tracking-[0.24px]">Verified</span>
                  </div>
                  {/* Desktop: 3-column grid */}
                  <div className="hidden md:grid grid-cols-3 items-center w-full">
                    <span className="font-fk-grotesk font-semibold text-[16px] leading-[28px] text-black dark:text-white">
                      NEAR Wallet
                    </span>
                    <span className="font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200 text-center">
                      {accountId}
                    </span>
                    <div className="flex justify-end">
                      <div className="bg-[#f8fafc] dark:bg-transparent border border-[#007a4d] flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-[#007a4d]">
                        <Check className="w-5 h-5" strokeWidth={2} />
                        <span className="font-poppins text-[12px] leading-[1.4] tracking-[0.24px]">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Identity row */}
                <div className="bg-[#f8fafc] dark:bg-white/5 flex items-center justify-between px-[8px] md:px-[16px] py-[16px] w-full">
                  {/* Mobile: stacked layout */}
                  <div className="flex md:hidden flex-col gap-[16px]">
                    <span className="font-fk-grotesk font-semibold text-[14px] leading-[14px] text-black dark:text-white">
                      Identity
                    </span>
                    {/* Passport badge */}
                    <div className="bg-[#79d1ac] flex h-[32px] items-center px-[8px] rounded-[40px] w-fit">
                      <span className="font-poppins text-[12px] leading-[1.4] text-[#002716] tracking-[0.24px]">
                        Passport
                      </span>
                    </div>
                  </div>
                  {/* Mobile: Verified badge */}
                  <div className="md:hidden bg-[#f8fafc] dark:bg-transparent border border-[#007a4d] flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-[#007a4d] shrink-0">
                    <Check className="w-5 h-5" strokeWidth={2} />
                    <span className="font-poppins text-[12px] leading-[1.4] tracking-[0.24px]">Verified</span>
                  </div>
                  {/* Desktop: 3-column grid */}
                  <div className="hidden md:grid grid-cols-3 items-center w-full">
                    <span className="font-fk-grotesk font-semibold text-[16px] leading-[28px] text-black dark:text-white">
                      Identity
                    </span>
                    <div className="flex justify-center">
                      <div className="bg-[#79d1ac] flex h-[32px] items-center px-[8px] rounded-[40px]">
                        <span className="font-poppins text-[12px] leading-[1.4] text-[#002716] tracking-[0.24px]">
                          Passport
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-[#f8fafc] dark:bg-transparent border border-[#007a4d] flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-[#007a4d]">
                        <Check className="w-5 h-5" strokeWidth={2} />
                        <span className="font-poppins text-[12px] leading-[1.4] tracking-[0.24px]">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disconnect Wallet button */}
              {onDisconnect && (
                <Button
                  onClick={onDisconnect}
                  variant="outline"
                  className="h-[48px] px-[24px] py-[14px] border-black dark:border-white text-[#040404] dark:text-white font-medium rounded-[4px]"
                >
                  Disconnect Wallet
                </Button>
              )}

              {/* Desktop: bottom message */}
              <p className="hidden md:block font-fk-grotesk text-[16px] leading-[28px] text-black dark:text-neutral-200 w-full">
                You can safely disconnect your wallet and reconnect it when you come back to vote on an open proposal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
