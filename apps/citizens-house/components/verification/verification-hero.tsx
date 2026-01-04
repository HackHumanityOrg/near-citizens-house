import Image from "next/image"
import { VerificationCtaButton } from "./verification-cta-button"

export function VerificationHero() {
  return (
    <section
      className="relative -mt-32 bg-[#f2f2f2] pt-32 dark:bg-neutral-900"
      style={{
        transform: "translateZ(0)",
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
        isolation: "isolate",
      }}
    >
      {/* Background gradient - full width, extended slightly beyond section */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          transform: "translateZ(0)",
          bottom: "-4px", // Extend 4px beyond to cover SVG drop shadow (2px offset + 2px blur)
        }}
      >
        <Image
          src="/verification-hero-gradient.svg"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="100vw"
          style={{ transform: "translateZ(0)" }}
        />
        {/* Dark overlay - high opacity to hide the light-mode gradient */}
        <div className="absolute inset-0 hidden bg-neutral-900/95 dark:block" />
      </div>

      {/* Plus pattern - positioned on right side, lower and more visible */}
      <div className="pointer-events-none absolute right-[100px] top-[200px] hidden xl:block">
        <Image
          src="/verification-plus-pattern.png"
          alt=""
          width={624}
          height={412}
          className="opacity-90 dark:opacity-30"
        />
      </div>

      {/* Content */}
      <div className="relative mx-auto flex w-full max-w-[1440px] flex-col gap-[56px] px-6 pb-[80px] pt-[24px] lg:px-10 xl:px-[189px]">
        {/* Tag + Title + Description */}
        <div className="flex flex-col gap-[24px] font-fk-grotesk">
          {/* Identity Verification tag */}
          <div className="inline-flex w-fit items-center gap-[8px] px-0 py-[7px]">
            <div className="flex h-[32px] items-center rounded-[40px] bg-[#ffda1e] px-[8px] py-0">
              <p
                className="text-nowrap text-[12px] leading-[1.4] tracking-[0.24px] text-[#090909]"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                Identity Verification
              </p>
            </div>
          </div>

          {/* Main heading */}
          <div className="w-full max-w-[845px]">
            <h1 className="text-[48px] leading-[52px] text-[#111] dark:text-neutral-100 md:text-[64px] md:leading-[68px] xl:text-[80px] xl:leading-[80px] font-fk-grotesk font-normal">
              Create a NEAR Verified Account
            </h1>
          </div>

          {/* Description */}
          <div className="w-full max-w-[845px]">
            <p className="text-[18px] leading-[26px] text-[#111] dark:text-neutral-100 md:text-[20px] md:leading-[28px] font-fk-grotesk font-normal">
              Complete the verification process to participate in NEAR governance with enhanced trust and credibility.
              Takes less than 15 minutes.
            </p>
          </div>
        </div>

        {/* Connect Wallet section */}
        <div className="flex w-full flex-col gap-[24px] font-fk-grotesk">
          <div className="flex w-full flex-col">
            <div className="flex w-full flex-col gap-[8px] text-[#111] dark:text-neutral-100">
              {/* Connect Wallet heading */}
              <div className="w-full max-w-[846px]">
                <h2 className="text-[32px] leading-[36px] md:text-[44px] md:leading-[48px] font-fk-grotesk font-medium">
                  Connect Wallet
                </h2>
              </div>

              {/* Connect Wallet description */}
              <div className="w-full max-w-[845px]">
                <p className="text-[16px] leading-[24px] font-fk-grotesk font-normal">
                  First, connect your NEAR wallet to begin the Verified NEAR Account creation process.
                </p>
              </div>
            </div>
          </div>

          {/* CTA button */}
          <div className="flex">
            <VerificationCtaButton size="hero" />
          </div>
        </div>
      </div>
    </section>
  )
}
