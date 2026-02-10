import { StarPattern } from "@/components/verification/icons/star-pattern"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e2e8f0] dark:bg-white/10 ${className}`} />
}

export default function GovernanceLoading() {
  const rows = Array.from({ length: 5 })

  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[480px] md:h-[560px] -mt-32 pt-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        <div
          className="absolute top-[140px] md:top-[160px] w-[372px] h-[246px] pointer-events-none z-0"
          style={{ left: "min(calc(50% + 360px), calc(100% - 200px))" }}
        >
          <StarPattern
            className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30"
            idPrefix="governanceLoadingStar"
          />
        </div>

        <div className="relative flex flex-col items-center justify-start pt-[24px] md:pt-[40px] h-full px-4 md:px-8 z-10">
          <h1 className="font-fk-grotesk font-medium text-[36px] md:text-[62px] leading-[40px] md:leading-[72px] text-black dark:text-white text-center">
            Governance
          </h1>
        </div>
      </section>

      {/* Skeleton Table */}
      <div className="relative z-10 -mt-[240px] md:-mt-[280px] pb-[80px]">
        <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
          <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex flex-col items-start rounded-[16px] w-full max-w-[1276px]">
            {/* Header skeleton */}
            <div className="flex flex-col gap-2 items-start px-4 py-4 md:px-10 w-full">
              <Skeleton className="h-7 w-[120px]" />
              <Skeleton className="h-3.5 w-[220px]" />
            </div>

            {/* Desktop header */}
            <div className="hidden md:block bg-[#e2e8f0] dark:bg-white/10 border-b border-[#cbd5e1] dark:border-white/10 px-10 py-4 w-full">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_140px_140px] gap-4">
                <Skeleton className="h-7 w-[60px]" />
                <Skeleton className="h-7 w-[60px] mx-auto" />
                <Skeleton className="h-7 w-[60px] mx-auto" />
                <Skeleton className="h-7 w-[60px] mx-auto" />
              </div>
            </div>

            {/* Row skeletons */}
            {rows.map((_, i) => (
              <div
                key={i}
                className={`px-4 py-4 md:px-10 w-full ${i !== rows.length - 1 ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
              >
                <div className="md:hidden flex flex-col gap-3">
                  <Skeleton className="h-5 w-[200px]" />
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-[80px] rounded-full" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                </div>
                <div className="hidden md:grid grid-cols-[minmax(0,1fr)_120px_140px_140px] gap-4 items-center">
                  <div>
                    <Skeleton className="h-5 w-[240px]" />
                    <Skeleton className="h-3 w-[100px] mt-1" />
                  </div>
                  <Skeleton className="h-6 w-[80px] mx-auto rounded-full" />
                  <Skeleton className="h-3 w-[100px] mx-auto" />
                  <Skeleton className="h-3 w-[80px] mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
