import { StarPattern } from "@/components/verification/icons/star-pattern"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e2e8f0] dark:bg-white/10 ${className}`} />
}

export default function VerificationsLoading() {
  const rows = Array.from({ length: 5 })

  return (
    <div className="w-full">
      {/* Hero Section with gradient background */}
      <section className="relative h-[480px] md:h-[560px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_1200px_800px_at_center_top,_rgba(255,218,30,0.5)_0%,_rgba(253,221,57,0.4)_20%,_rgba(249,230,136,0.3)_40%,_rgba(245,236,189,0.15)_60%,_rgba(242,242,242,0.05)_80%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_1200px_800px_at_center_top,_rgba(255,218,30,0.3)_0%,_rgba(253,221,57,0.2)_20%,_rgba(249,230,136,0.15)_40%,_transparent_70%)]" />
        </div>

        {/* Star pattern - positioned near right edge */}
        <div
          className="absolute top-[140px] md:top-[160px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{
            left: "min(calc(50% + 360px), calc(100% - 200px))",
          }}
        >
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="citizensLoadingStar" />
        </div>

        {/* Title */}
        <div className="relative flex flex-col items-center justify-start pt-[24px] md:pt-[40px] h-full px-4 md:px-8 z-10">
          <h1 className="font-fk-grotesk font-medium text-[36px] md:text-[62px] leading-[40px] md:leading-[72px] text-black dark:text-white text-center">
            Citizens
          </h1>
        </div>
      </section>

      {/* Table Section - overlaps hero */}
      <div className="relative z-10 -mt-[240px] md:-mt-[280px] pb-[80px]">
        <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
          {/* Table Card */}
          <div className="bg-[#f8fafc] dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex flex-col items-start rounded-[16px] w-full max-w-[1276px]">
            {/* Card Header */}
            <div className="flex flex-col gap-[8px] items-start px-[16px] py-[16px] md:px-[40px] rounded-t-[16px] w-full">
              <div className="flex items-start px-0 py-[8px]">
                <Skeleton className="h-[28px] w-[200px]" />
              </div>
              <div className="flex flex-col gap-[8px] md:flex-row md:items-center md:justify-between w-full">
                <Skeleton className="h-[14px] w-[260px]" />
                <Skeleton className="h-[28px] w-[120px]" />
              </div>
            </div>

            {/* Table Header - Desktop only */}
            <div className="hidden md:block bg-[#e2e8f0] dark:bg-white/10 border-b border-[#cbd5e1] dark:border-white/10 px-[40px] py-[16px] w-full">
              <div className="flex items-center justify-between w-full">
                <div className="flex-1 flex items-center justify-between">
                  <Skeleton className="h-[28px] w-[120px]" />
                  <Skeleton className="h-[28px] w-[130px]" />
                  <Skeleton className="h-[28px] w-[90px]" />
                  <Skeleton className="h-[28px] w-[50px]" />
                </div>
              </div>
            </div>

            {/* Table Body */}
            {rows.map((_, index) => (
              <div
                key={index}
                className={`px-[16px] py-[16px] md:px-[40px] w-full ${index !== rows.length - 1 ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
              >
                {/* Mobile Card Layout */}
                <div className="md:hidden flex flex-col gap-[12px]">
                  <Skeleton className="h-[28px] w-[200px]" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-[32px] w-[80px] rounded-full" />
                    <Skeleton className="h-[32px] w-[77px] rounded-[4px]" />
                  </div>
                  <Skeleton className="h-[20px] w-[180px]" />
                </div>

                {/* Desktop Row Layout */}
                <div className="hidden md:flex items-center justify-between w-full">
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex gap-[8px] items-center w-[373.5px]">
                      <Skeleton className="h-[28px] w-[200px]" />
                    </div>
                    <div className="flex items-center justify-between w-[792px]">
                      <div className="flex gap-[8px] items-center justify-center min-w-[97px] px-[8px] py-[7px]">
                        <Skeleton className="h-[32px] w-[80px] rounded-full" />
                      </div>
                      <div className="flex gap-[8px] items-center justify-center min-w-[97px] pl-[8px] pr-0 py-[7px]">
                        <Skeleton className="h-[20px] w-[200px]" />
                      </div>
                      <Skeleton className="h-[32px] w-[77px] rounded-[4px]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
