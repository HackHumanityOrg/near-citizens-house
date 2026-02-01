import { ShieldCheckIcon } from "@/components/verification/icons/shield-check-icon"
import { StarPattern } from "@/components/verification/icons/star-pattern"
import { VerificationQA } from "@/components/verification/verification-qa"

export default function MaintenancePage() {
  return (
    <>
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
          {/* Star pattern - positioned near title */}
          <div
            className="absolute top-[120px] w-[480px] h-[320px] pointer-events-none z-0"
            style={{
              left: "min(calc(50% + 320px), calc(100% - 480px))",
            }}
          >
            <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" />
          </div>

          {/* Header: Tag + Title + Description */}
          <div className="relative flex flex-col gap-[16px] md:gap-[14px] items-center shrink-0 w-full max-w-[932px] z-10">
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

            <div className="flex flex-col justify-center font-fk-grotesk font-normal text-[#111] dark:text-[#f5f7fa] text-center w-full shrink-0">
              <p className="text-[20px] leading-[28px]">
                Verify your account to participate in NEAR governance with enhanced trust and credibility.
              </p>
            </div>
          </div>

          {/* Maintenance Message Card */}
          <div
            data-testid="maintenance-message"
            className="relative z-10 bg-white dark:bg-[#191a23] flex items-center justify-center p-[24px] xl:p-[40px] rounded-[24px] shrink-0 w-full max-w-[1000px]"
          >
            <div className="flex flex-col gap-[12px] items-center text-center w-full max-w-[720px]">
              <p className="text-[20px] leading-[28px] text-[#090909] dark:text-white font-fk-grotesk font-medium">
                Verification is temporarily unavailable.
              </p>
              <p className="text-[16px] leading-[26px] text-[#757575] dark:text-[#8a8f98] font-fk-grotesk font-normal">
                Please check back soon. We appreciate your patience while we perform maintenance.
              </p>
            </div>
          </div>
        </div>
      </section>
      <VerificationQA />
    </>
  )
}
