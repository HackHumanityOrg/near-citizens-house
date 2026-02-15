import { StarPattern } from "@/components/verification/icons/star-pattern"
import { VerificationQA } from "@/components/verification/verification-qa"

export default function WaitingPage() {
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

          <div className="relative z-10 flex flex-col gap-[16px] md:gap-[20px] items-center text-center w-full max-w-[960px]">
            <h1 className="font-fk-grotesk font-medium text-[#111] dark:text-[#f5f7fa] text-[30px] leading-[36px] md:text-[52px] md:leading-[60px]">
              Thank you for creating your NEAR Verified Account
            </h1>
            <h2 className="font-fk-grotesk font-medium text-[#111] dark:text-[#f5f7fa] text-[24px] leading-[30px] md:text-[36px] md:leading-[44px]">
              The NEAR Verification is now closed.
            </h2>
            <p className="font-fk-grotesk font-normal text-[#111] dark:text-[#f5f7fa] text-[18px] leading-[26px] md:text-[24px] md:leading-[34px]">
              It&apos;s your time to read and analyze the proposal on the forum.
            </p>
          </div>
        </div>
      </section>
      <VerificationQA />
    </>
  )
}
