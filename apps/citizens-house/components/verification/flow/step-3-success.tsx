"use client"

import { useState, useEffect } from "react"
import { Check } from "lucide-react"
import { Button } from "@near-citizens/ui"
import { StarPattern } from "../icons/star-pattern"
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useTransform } from "framer-motion"

interface Step3SuccessProps {
  accountId: string
  onDisconnect?: () => void
}

type AnimationPhase = "initial" | "labelsOut" | "merging" | "checkmark" | "complete"

export function Step3Success({ accountId, onDisconnect }: Step3SuccessProps) {
  const shouldReduceMotion = useReducedMotion()
  const [phase, setPhase] = useState<AnimationPhase>(shouldReduceMotion ? "complete" : "initial")

  // Motion value for checkmark path - prevents flash by linking opacity to pathLength
  const pathLength = useMotionValue(0)
  // Opacity fades in quickly once pathLength starts (prevents initial flash)
  const checkmarkOpacity = useTransform(pathLength, [0, 0.05, 0.15], [0, 0, 1])

  useEffect(() => {
    if (shouldReduceMotion) {
      return
    }

    const timers = [
      setTimeout(() => setPhase("labelsOut"), 500),
      setTimeout(() => setPhase("merging"), 800),
      setTimeout(() => setPhase("checkmark"), 1600),
      setTimeout(() => setPhase("complete"), 2100),
    ]

    return () => timers.forEach(clearTimeout)
  }, [shouldReduceMotion])

  const showMerging = phase === "merging" || phase === "checkmark" || phase === "complete"
  const showFinalCircle = phase === "checkmark" || phase === "complete"

  return (
    <div className="w-full" data-testid="success-section">
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
          {/* Animation container - consistent width */}
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px] relative h-[160px]">
            {/* Two-step stepper with morphing circles */}
            <div className="absolute inset-0 flex flex-col items-center">
              {/* Circles and line container */}
              <div className="relative w-full flex items-center justify-between h-[40px]">
                {/* Left circle (Step 1) - uses CSS for positioning, JS for scale/opacity */}
                <motion.div
                  className="absolute left-0 flex items-center justify-center"
                  style={{ willChange: "transform, opacity" }}
                  initial={false}
                  animate={{
                    scale: showMerging ? 0 : 1,
                    opacity: showMerging ? 0 : 1,
                    x: showMerging ? "50%" : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                  }}
                >
                  <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full w-[40px] h-[40px]">
                    <motion.div
                      animate={{ opacity: phase === "labelsOut" || showMerging ? 0 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="w-5 h-5 text-white dark:text-black" strokeWidth={3} />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Connecting line */}
                <motion.div
                  className="absolute left-[40px] right-[40px] h-[40px] flex items-center px-[16px] md:px-[24px]"
                  initial={false}
                  animate={{
                    opacity: phase === "labelsOut" ? 0.5 : showMerging ? 0 : 1,
                    scaleX: showMerging ? 0 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="w-full h-[1px] bg-black dark:bg-white/40" />
                </motion.div>

                {/* Right circle (Step 2) - uses CSS for positioning, JS for scale/opacity */}
                <motion.div
                  className="absolute right-0 flex items-center justify-center"
                  style={{ willChange: "transform, opacity" }}
                  initial={false}
                  animate={{
                    scale: showMerging ? 0 : 1,
                    opacity: showMerging ? 0 : 1,
                    x: showMerging ? "-50%" : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 18,
                  }}
                >
                  <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full w-[40px] h-[40px]">
                    <motion.div
                      animate={{ opacity: phase === "labelsOut" || showMerging ? 0 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="w-5 h-5 text-white dark:text-black" strokeWidth={3} />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Large merged circle (appears at center) */}
                <AnimatePresence>
                  {showMerging && (
                    <motion.div
                      className="absolute left-1/2 top-1/2 flex items-center justify-center"
                      style={{
                        willChange: "transform, opacity",
                        x: "-50%",
                        y: "-50%",
                      }}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 180,
                        damping: 18,
                        delay: 0.2,
                      }}
                    >
                      {/* Pulse/glow effect - uses same size as circle */}
                      {phase === "complete" && (
                        <motion.div
                          className="absolute rounded-full bg-verified w-[60px] h-[60px] md:w-[80px] md:h-[80px]"
                          initial={{ scale: 1, opacity: 0.4 }}
                          animate={{
                            scale: [1, 1.4, 1.4],
                            opacity: [0.4, 0, 0],
                          }}
                          transition={{
                            duration: 0.8,
                            ease: "easeOut",
                          }}
                        />
                      )}

                      <div className="border-2 border-verified bg-verified flex items-center justify-center rounded-full w-[60px] h-[60px] md:w-[80px] md:h-[80px]">
                        {/* Animated SVG checkmark that draws itself */}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="w-8 h-8 md:w-10 md:h-10 text-white dark:text-black"
                          style={{ overflow: "visible" }}
                        >
                          <motion.path
                            d="M4.5 12.75l6 6 9-13.5"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            // Use 0.9 instead of 1 to prevent Safari flash at end
                            animate={{ pathLength: showFinalCircle ? 0.9 : 0 }}
                            style={{
                              pathLength,
                              opacity: checkmarkOpacity,
                              strokeDashoffset: 0,
                            }}
                            transition={{
                              type: "tween",
                              duration: 0.5,
                              ease: "easeOut",
                            }}
                          />
                        </svg>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Labels - fade out before merge */}
              <motion.div
                className="w-full flex justify-between mt-[16px]"
                initial={false}
                animate={{
                  opacity: phase === "initial" ? 1 : 0,
                  y: phase === "initial" ? 0 : -10,
                }}
                transition={{ duration: 0.3 }}
              >
                <span className="font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-verified whitespace-nowrap text-center">
                  NEAR Wallet Verified
                </span>
                <span className="font-fk-grotesk text-[16px] md:text-[20px] leading-[28px] text-verified whitespace-nowrap text-center">
                  Identity Verified
                </span>
              </motion.div>

              {/* Success message - slides up and fades in */}
              <AnimatePresence>
                {phase === "complete" && (
                  <motion.h1
                    className="absolute top-[80px] md:top-[100px] left-0 right-0 font-fk-grotesk font-medium text-[20px] md:text-[24px] leading-[28px] md:leading-[32px] text-verified text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 24,
                    }}
                    data-testid="success-heading"
                  >
                    NEAR Verified Account successfully created
                  </motion.h1>
                )}
              </AnimatePresence>
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
              <div
                className="flex flex-col items-start w-full rounded-[8px] overflow-hidden"
                data-testid="verification-status-box"
              >
                {/* NEAR Wallet row */}
                <div
                  className="bg-[#f8fafc] dark:bg-white/5 border-b border-[#cbd5e1] dark:border-white/10 flex items-center justify-between px-[8px] md:px-[16px] py-[16px] w-full"
                  data-testid="wallet-verified-row"
                >
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
                  <div className="md:hidden bg-[#f8fafc] dark:bg-transparent border border-verified flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-verified shrink-0">
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
                      <div className="bg-[#f8fafc] dark:bg-transparent border border-verified flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-verified">
                        <Check className="w-5 h-5" strokeWidth={2} />
                        <span className="font-poppins text-[12px] leading-[1.4] tracking-[0.24px]">Verified</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Identity row */}
                <div
                  className="bg-[#f8fafc] dark:bg-white/5 flex items-center justify-between px-[8px] md:px-[16px] py-[16px] w-full"
                  data-testid="identity-verified-row"
                >
                  {/* Mobile: stacked layout */}
                  <div className="flex md:hidden flex-col gap-[16px]">
                    <span className="font-fk-grotesk font-semibold text-[14px] leading-[14px] text-black dark:text-white">
                      Identity
                    </span>
                    {/* Passport badge */}
                    <div className="bg-verified-badge-bg flex h-[32px] items-center px-[8px] rounded-[40px] w-fit">
                      <span className="font-poppins text-[12px] leading-[1.4] text-verified-badge-text tracking-[0.24px]">
                        Passport
                      </span>
                    </div>
                  </div>
                  {/* Mobile: Verified badge */}
                  <div className="md:hidden bg-[#f8fafc] dark:bg-transparent border border-verified flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-verified shrink-0">
                    <Check className="w-5 h-5" strokeWidth={2} />
                    <span className="font-poppins text-[12px] leading-[1.4] tracking-[0.24px]">Verified</span>
                  </div>
                  {/* Desktop: 3-column grid */}
                  <div className="hidden md:grid grid-cols-3 items-center w-full">
                    <span className="font-fk-grotesk font-semibold text-[16px] leading-[28px] text-black dark:text-white">
                      Identity
                    </span>
                    <div className="flex justify-center">
                      <div className="bg-verified-badge-bg flex h-[32px] items-center px-[8px] rounded-[40px]">
                        <span className="font-poppins text-[12px] leading-[1.4] text-verified-badge-text tracking-[0.24px]">
                          Passport
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-[#f8fafc] dark:bg-transparent border border-verified flex gap-[4px] h-[32px] items-center px-[8px] rounded-[40px] text-verified">
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
                  data-testid="disconnect-wallet-button-success"
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
