import { Skeleton } from "@/components/ui/skeleton"
import { StarPattern } from "@/components/verification/icons/star-pattern"

function ProposalCardSkeleton() {
  return (
    <div className="h-full bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-5 md:p-6">
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-[26px] md:h-[28px] w-[82%]" />
            <Skeleton className="h-[26px] md:h-[28px] w-[62%] mt-1" />
            <Skeleton className="h-[16px] w-[150px] mt-2" />
          </div>
          <Skeleton className="h-[24px] w-[84px] rounded-full" />
        </div>

        <div className="rounded-[12px] border border-[#e2e8f0] dark:border-white/10 p-4 mt-auto">
          <Skeleton className="h-[20px] w-[140px] mb-3" />
          <Skeleton className="h-2 w-full rounded-full" />

          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex min-h-6 items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-[15px] w-[52px]" />
                </div>
                <Skeleton className="h-[15px] w-[48px]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GovernanceLoading() {
  const cards = Array.from({ length: 9 })

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
            Proposals
          </h1>
        </div>
      </section>

      {/* Proposals list skeleton */}
      <div className="relative z-10 -mt-[240px] md:-mt-[280px] pb-[80px]">
        <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
          <div className="w-full max-w-[1276px] flex flex-col gap-4">
            <div className="flex justify-end">
              <Skeleton className="h-[28px] w-[112px]" />
            </div>
            <Skeleton className="h-[14px] w-[240px]" />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cards.map((_, index) => (
                <ProposalCardSkeleton key={index} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 items-center md:flex-row md:justify-between mt-6 w-full max-w-[1276px]">
            <Skeleton className="h-[14px] w-[92px] order-2 md:order-1" />
            <div className="flex gap-3 order-1 md:order-2">
              <Skeleton className="h-[36px] w-[114px] rounded-[4px]" />
              <Skeleton className="h-[36px] w-[92px] rounded-[4px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
