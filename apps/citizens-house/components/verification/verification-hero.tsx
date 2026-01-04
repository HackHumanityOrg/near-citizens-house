import Image from "next/image"
import { ShieldCheckIcon } from "./icons/shield-check-icon"
import { ClockIcon } from "./icons/clock-icon"
import { WalletIcon } from "./icons/wallet-icon"
import { PassportIcon } from "./icons/passport-icon"
import { VerificationCtaButton } from "./verification-cta-button"

export function VerificationHero() {
  return (
    <section
      className="relative -mt-32 bg-white pt-32 dark:bg-black flex flex-col gap-[10px] items-center justify-center pb-[80px]"
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

      {/* Plus pattern - visible on larger screens, positioned relative to centered 1440px container */}
      <div className="absolute inset-0 pointer-events-none hidden xl:block">
        <div className="relative w-full max-w-[1440px] h-full mx-auto">
          {/* Plus pattern - Figma: x=1076, y=162, w=372px, h=246px within 1440px frame */}
          <div className="absolute left-[1076px] top-[162px] w-[372px] h-[246px]">
            <Image
              src="/verification-plus-pattern.png"
              alt=""
              fill
              className="object-cover opacity-90 dark:opacity-30"
            />
          </div>
        </div>
      </div>

      {/* Content Container - Responsive: mobile stacked, desktop with fixed height */}
      <div className="relative flex flex-col gap-[32px] lg:gap-[56px] min-h-[600px] lg:h-[744px] items-center w-full px-4 py-[16px] md:px-[80px] xl:px-[189px]">
        {/* Header: Tag + Title + Description + Time */}
        <div className="flex flex-col gap-[12px] lg:gap-[16px] items-start shrink-0 w-full max-w-[932px]">
          {/* Identity Verification tag */}
          <div className="flex gap-[8px] items-center justify-center min-w-[97px] px-0 py-[7px] w-full shrink-0">
            <div className="bg-[rgba(255,218,30,0.9)] flex gap-[8px] items-center px-[16px] py-[8px] rounded-[40px] shrink-0">
              <ShieldCheckIcon className="h-[24px] w-[24px] shrink-0" />
              <p className="text-[12px] font-medium leading-[16px] tracking-[0.4px] text-[#5e4f02] font-fk-grotesk whitespace-nowrap">
                Identity Verification
              </p>
            </div>
          </div>

          {/* Main heading - responsive font sizes */}
          <div className="flex flex-col justify-center leading-[0] font-fk-grotesk font-normal text-[#111] dark:text-[#f5f7fa] text-center w-full shrink-0">
            <h1 className="text-[32px] leading-[36px] sm:text-[48px] sm:leading-[52px] md:text-[64px] md:leading-[68px] xl:text-[80px] xl:leading-[80px]">
              Create your
              <br aria-hidden="true" />
              NEAR Verified Account
            </h1>
          </div>

          {/* Description - responsive font sizes */}
          <div className="flex flex-col justify-center leading-[0] font-fk-grotesk font-normal text-[#111] dark:text-[#f5f7fa] text-center w-full shrink-0">
            <p className="text-[14px] leading-[20px] sm:text-[16px] sm:leading-[24px] md:text-[20px] md:leading-[28px]">
              Verify your account to participate in NEAR governance with enhanced trust and credibility.
            </p>
          </div>

          {/* Time indicator */}
          <div className="flex gap-[8px] h-[36px] items-center justify-center w-full shrink-0">
            <ClockIcon className="h-[20px] w-[20px] md:h-[24px] md:w-[24px] text-[#111] dark:text-[#f5f5f5] shrink-0" />
            <div className="flex flex-col justify-center leading-[0] font-fk-grotesk font-normal text-[14px] md:text-[16px] text-[#090909] dark:text-white whitespace-nowrap shrink-0">
              <p className="leading-[20px] md:leading-[24px]">Takes less than 15 minutes</p>
            </div>
          </div>
        </div>

        {/* Steps Container - Mobile: stacked, Desktop (1024px+): side-by-side - Figma node 461:4727 */}
        <div className="bg-white dark:bg-black border-t-[4px] border-[#ffda1e] border-solid flex flex-col lg:flex-row gap-[32px] lg:gap-[56px] items-start justify-center p-[40px] shrink-0 w-full max-w-full">
          {/* Step 1 - Mobile: full width, Desktop (1024px+): w-400px */}
          <div className="flex flex-col gap-[8px] items-start w-full lg:w-[400px] shrink-0">
            {/* Icon + Step label */}
            <div className="flex gap-[8px] h-[40px] items-center shrink-0">
              <WalletIcon className="w-[20px] h-[20px] md:w-[24px] md:h-[24px] text-black dark:text-white shrink-0" />
              <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-[24px] text-[#090909] dark:text-white font-fk-grotesk font-normal whitespace-nowrap">
                STEP 1
              </p>
            </div>

            {/* Title */}
            <h3 className="text-[20px] md:text-[24px] leading-[28px] md:leading-[32px] text-black dark:text-white font-fk-grotesk font-medium">
              Verify NEAR wallet ownership
            </h3>

            {/* Description */}
            <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-[24px] text-[#757575] dark:text-[rgba(255,255,255,0.8)] font-fk-grotesk font-normal">
              First, connect your NEAR wallet to begin the identity verification process
            </p>

            {/* CTA Button */}
            <div className="flex mt-[8px]">
              <VerificationCtaButton labelDisconnected="Connect Wallet " />
            </div>
          </div>

          {/* Step 2 - Mobile: full width, Desktop (1024px+): w-400px */}
          <div className="flex flex-col gap-[8px] items-start w-full lg:w-[400px] shrink-0">
            {/* Icon + Step label */}
            <div className="flex gap-[8px] h-[40px] items-center shrink-0">
              <PassportIcon className="w-[20px] h-[20px] md:w-[24px] md:h-[24px] text-black dark:text-white shrink-0" />
              <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-[24px] text-[#090909] dark:text-white font-fk-grotesk font-normal whitespace-nowrap">
                STEP 2
              </p>
            </div>

            {/* Title */}
            <h3 className="text-[20px] md:text-[24px] leading-[28px] md:leading-[32px] text-black dark:text-white font-fk-grotesk font-medium">
              Verify identity using your Biometric ID
            </h3>

            {/* Description */}
            <p className="text-[14px] md:text-[16px] leading-[20px] md:leading-[24px] text-[#8e8e93] dark:text-[rgba(255,255,255,0.8)] font-fk-grotesk font-normal">
              Use the Self mobile app to scan the QR code on your Passport or other Biometric ID document and generate
              your ID proof
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
