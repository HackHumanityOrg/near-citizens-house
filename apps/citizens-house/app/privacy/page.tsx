import { StarPattern } from "@/components/verification/icons/star-pattern"

export default function PrivacyPage() {
  return (
    <div className="bg-white dark:bg-[#181921]">
      {/* Hero Section - Fixed height with gradient background */}
      <section className="relative h-[280px] md:h-[400px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background - contained within hero */}
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
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" />
        </div>

        {/* Title and Last Updated - centered in hero */}
        <div className="relative flex flex-col gap-[16px] items-center justify-center h-full px-6 z-10">
          <h1 className="text-[30px] leading-[36px] md:text-[62px] md:leading-[72px] font-fk-grotesk font-medium text-black dark:text-white text-center">
            Privacy Policy
          </h1>
          <p className="text-[20px] leading-[1.4] font-fk-grotesk font-normal text-black dark:text-white text-center">
            Last updated: January 7, 2026
          </p>
        </div>
      </section>

      {/* Content Section - White background */}
      <section className="flex justify-center w-full px-6 md:px-0 py-[40px] md:py-[80px]">
        <div className="flex flex-col gap-[40px] md:gap-[61px] items-start w-full max-w-[1055px]">
          {/* Introduction Section */}
          <h2 className="text-[30px] leading-[36px] font-fk-grotesk font-medium text-black dark:text-white">
            Introduction
          </h2>

          <div className="flex flex-col gap-[24px] items-start w-full opacity-[0.88] pb-[44px]">
            <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5] w-full">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
              mollit anim id est laborum.
            </p>
            <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5] w-full">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
              mollit anim id est laborum.
            </p>
            <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5] w-full">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
              mollit anim id est laborum.
            </p>
            <p className="text-[16px] leading-[28px] font-fk-grotesk font-normal text-[#171717] dark:text-[#e5e5e5] w-full">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
              ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
              mollit anim id est laborum.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
