import { StarPattern } from "@/components/verification/icons/star-pattern"

export default function MaintenancePage() {
  return (
    <div className="bg-white dark:bg-[#181921]">
      {/* Hero Section - Fixed height with gradient background */}
      <section className="relative h-[320px] md:h-[400px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background - contained within hero */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_500px_320px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] md:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_500px_320px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)] md:dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[100px] md:top-[120px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" />
        </div>

        {/* Title and description - centered in hero */}
        <div className="relative flex flex-col gap-[16px] items-center justify-center h-full px-12 md:px-6 z-10">
          <h1 className="text-[36px] leading-[44px] md:text-[62px] md:leading-[72px] font-fk-grotesk font-medium text-black dark:text-white text-center">
            Under Maintenance
          </h1>
          <p className="text-[22px] leading-[30px] font-fk-grotesk font-normal text-black dark:text-white text-center">
            Citizens House is temporarily unavailable. We appreciate your patience.
          </p>
        </div>
      </section>
    </div>
  )
}
