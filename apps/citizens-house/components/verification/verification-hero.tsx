"use client"

import { ShieldCheckIcon } from "./icons/shield-check-icon"
import { ClockIcon } from "./icons/clock-icon"
import { WalletIcon } from "./icons/wallet-icon"
import { IdCardIcon } from "./icons/id-card-icon"
import { StarPattern } from "./icons/star-pattern"
import { VerificationCtaButton } from "./verification-cta-button"

export function VerificationHero() {
  return (
    <section
      className="relative -mt-32 bg-white pt-32 dark:bg-black flex flex-col items-center justify-center pb-[80px] overflow-hidden"
      style={{
        transform: "translateZ(0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Background gradient - responsive, covers all screen sizes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_2400px_2000px_at_center_bottom,_rgba(255,218,30,0.45)_0%,_rgba(255,244,204,0.25)_40%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_2400px_2000px_at_center_bottom,_rgba(255,218,30,0.25)_0%,_rgba(255,218,30,0.15)_40%,_transparent_70%)]" />
      </div>

      {/* Content Container */}
      <div className="relative flex flex-col gap-[32px] md:gap-[56px] items-center w-full px-6 md:px-[80px] py-[16px] md:py-[40px]">
        {/* Plus pattern - positioned near title, z-index below card */}
        <div
          className="absolute top-[120px] w-[480px] h-[320px] pointer-events-none z-0"
          style={{
            // Position near title (50% + 320px) but never beyond right edge (100% - 480px)
            left: "min(calc(50% + 320px), calc(100% - 480px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" />
        </div>

        {/* Header: Tag + Title + Description + Time */}
        <div className="relative flex flex-col gap-[16px] md:gap-[14px] items-center shrink-0 w-full max-w-[932px] z-10">
          {/* Identity Verification tag */}
          <div className="flex gap-[8px] items-center justify-center min-w-[97px] px-0 py-[7px] w-full shrink-0">
            <div
              data-testid="identity-verification-tag"
              className="bg-[rgba(255,218,30,0.9)] flex gap-[8px] items-center px-[16px] py-[8px] rounded-[40px] shrink-0"
            >
              <ShieldCheckIcon className="h-[24px] w-[24px] shrink-0" />
              <p className="text-[14px] font-medium leading-[14px] text-[#5e4f02] font-fk-grotesk whitespace-nowrap">
                Identity Verification
              </p>
            </div>
          </div>

          {/* Main heading - Figma: 62px/72px desktop, 30px/36px mobile */}
          <div className="flex flex-col justify-center font-fk-grotesk font-medium text-[#111] dark:text-[#f5f7fa] text-center w-full shrink-0">
            <h1
              data-testid="verification-hero-heading"
              className="text-[30px] leading-[36px] md:text-[62px] md:leading-[72px]"
            >
              Create your
              <br aria-hidden="true" />
              NEAR Verified Account
            </h1>
          </div>

          {/* Description - Figma: 20px/28px */}
          <div className="flex flex-col justify-center font-fk-grotesk font-normal text-[#111] dark:text-[#f5f7fa] text-center w-full shrink-0">
            <p className="text-[20px] leading-[28px]">
              Verify your account to participate in NEAR governance with enhanced trust and credibility.
            </p>
          </div>

          {/* Time indicator - Figma: 20px/28px, "Takes less than 7 minutes" */}
          <div
            data-testid="verification-time-estimate"
            className="flex gap-[8px] h-[36px] items-center justify-center w-full shrink-0"
          >
            <ClockIcon className="h-[24px] w-[24px] text-[#111] dark:text-white shrink-0" />
            <div className="flex flex-col justify-center font-fk-grotesk font-normal text-[20px] text-[#090909] dark:text-white whitespace-nowrap shrink-0">
              <p className="leading-[28px]">Takes less than 7 minutes</p>
            </div>
          </div>
        </div>

        {/* Steps Container - Figma: rounded-[24px], p-[40px], white/dark background, w-[1000px] */}
        <div className="relative z-10 bg-white dark:bg-[#191a23] flex items-start justify-center p-[24px] xl:p-[40px] rounded-[24px] shrink-0 w-full max-w-[1000px]">
          {/* Inner container with fixed width to match Figma 920px */}
          <div className="flex flex-col gap-[24px] items-start w-full xl:w-[920px]">
            {/* Step Number Indicators - Desktop only - aligned with content columns below */}
            <div className="hidden xl:flex justify-center w-full">
              {/* Container width matches content: 400 + 56 + 400 = 856px */}
              <div className="relative flex items-center" style={{ width: "856px", height: "40px" }}>
                {/* Circle 1 - at position 0 (aligned with Step 1 content) */}
                <div className="absolute left-0 border-2 border-solid border-black dark:border-white flex items-center justify-center rounded-full w-[40px] h-[40px]">
                  <span className="font-fk-grotesk font-medium text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    1
                  </span>
                </div>

                {/* Horizontal Divider - connects the two circles */}
                <div className="absolute h-[1px] bg-black dark:bg-white" style={{ left: "64px", width: "368px" }} />

                {/* Circle 2 - at position 456px (aligned with Step 2 content: 400 + 56) */}
                <div
                  className="absolute border-2 border-solid border-black dark:border-white flex items-center justify-center rounded-full w-[40px] h-[40px]"
                  style={{ left: "456px" }}
                >
                  <span className="font-fk-grotesk font-medium text-[20px] leading-[28px] text-[#090909] dark:text-white">
                    2
                  </span>
                </div>
              </div>
            </div>

            {/* Steps Content - Desktop: horizontal, Mobile: vertical with connecting line */}
            <div className="flex flex-col xl:flex-row gap-[24px] xl:gap-[56px] items-start justify-center w-full">
              {/* Mobile Steps - timeline pattern with line inside each step */}
              <div className="flex xl:hidden flex-col w-full">
                {/* Step 1 - Mobile */}
                <div className="flex gap-[16px]">
                  {/* Timeline column: dot + line that spans remaining height */}
                  <div className="flex flex-col items-center">
                    <div className="w-[12px] h-[12px] rounded-full border border-black dark:border-white bg-white dark:bg-[#191a23] mt-[6px] shrink-0" />
                    {/* Line uses flex-1 to fill remaining space, mb-[-6px] extends to meet dot 2's mt-[6px] */}
                    <div className="w-[1px] flex-1 bg-black dark:bg-white mb-[-6px]" />
                  </div>
                  {/* Content with bottom padding for gap */}
                  <div className="flex flex-col gap-[8px] flex-1 pb-[56px]">
                    <WalletIcon className="w-[24px] h-[24px] text-black dark:text-white shrink-0" />
                    <h3
                      data-testid="step1-heading-mobile"
                      className="text-[20px] leading-[28px] text-black dark:text-white font-fk-grotesk font-medium"
                    >
                      Verify NEAR Wallet
                    </h3>
                    <p className="text-[16px] leading-[28px] text-[#8e8e93] font-fk-grotesk font-normal">
                      First, connect your NEAR wallet to begin the identity verification process
                    </p>
                    <div className="mt-[8px]">
                      <VerificationCtaButton
                        labelDisconnected="Connect Wallet "
                        testId="connect-wallet-button-mobile"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2 - Mobile (last item, no line after dot) */}
                <div className="flex gap-[16px]">
                  {/* Timeline column: just the dot */}
                  <div className="flex flex-col items-center">
                    <div className="w-[12px] h-[12px] rounded-full border border-black dark:border-white bg-white dark:bg-[#191a23] mt-[6px] shrink-0" />
                  </div>
                  {/* Content */}
                  <div className="flex flex-col gap-[8px] flex-1">
                    <IdCardIcon className="w-[24px] h-[24px] text-black dark:text-white shrink-0" />
                    <h3
                      data-testid="step2-heading-mobile"
                      className="text-[20px] leading-[28px] text-black dark:text-white font-fk-grotesk font-medium"
                    >
                      Verify Identity
                    </h3>
                    <p className="text-[16px] leading-[28px] text-[#8e8e93] font-fk-grotesk font-normal">
                      Use the Self mobile app to generate proof of your Passport or other biometric ID document
                    </p>
                  </div>
                </div>
              </div>

              {/* Desktop Steps - Hidden on mobile */}
              {/* Step 1 - Desktop */}
              <div className="hidden xl:flex flex-col gap-[8px] items-start w-[400px] shrink-0">
                <div className="flex gap-[8px] items-center text-black dark:text-white">
                  <div className="w-[40px] h-[24px] flex items-center justify-center shrink-0">
                    <WalletIcon className="w-[24px] h-[24px]" />
                  </div>
                  <h3
                    data-testid="step1-heading-desktop"
                    className="text-[30px] leading-[36px] font-fk-grotesk font-medium whitespace-nowrap"
                  >
                    Verify NEAR Wallet
                  </h3>
                </div>
                <p className="text-[16px] leading-[28px] text-[#757575] dark:text-[#8a8f98] font-fk-grotesk font-normal w-[400px]">
                  First, connect your NEAR wallet to begin the identity
                  <br aria-hidden="true" />
                  verification process
                </p>
                <div className="mt-[8px]">
                  <VerificationCtaButton labelDisconnected="Connect Wallet " testId="connect-wallet-button-desktop" />
                </div>
              </div>

              {/* Step 2 - Desktop */}
              <div className="hidden xl:flex flex-col gap-[8px] items-start w-[400px] shrink-0">
                <div className="flex gap-[8px] items-center text-black dark:text-white w-full">
                  <div className="w-[40px] h-[24px] flex items-center justify-center shrink-0">
                    <IdCardIcon className="w-[24px] h-[24px]" />
                  </div>
                  <h3
                    data-testid="step2-heading-desktop"
                    className="text-[30px] leading-[36px] font-fk-grotesk font-medium whitespace-nowrap"
                  >
                    Verify Identity
                  </h3>
                </div>
                <p className="text-[16px] leading-[28px] text-[#8e8e93] dark:text-[#8a8f98] font-fk-grotesk font-normal">
                  Use the Self mobile app to generate proof of your Passport or other biometric ID document
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
