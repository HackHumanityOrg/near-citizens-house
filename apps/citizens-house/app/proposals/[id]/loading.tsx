import { Skeleton } from "@/components/ui/skeleton"
import { StarPattern } from "@/components/verification/icons/star-pattern"

function ProposalHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-[20px] w-[76px]" />
        <Skeleton className="h-[20px] w-[10px]" />
        <Skeleton className="h-[20px] w-[64px]" />
      </div>

      <Skeleton className="h-[32px] md:h-[40px] w-[92%]" />
      <Skeleton className="h-[32px] md:h-[40px] w-[70%]" />

      <div className="flex items-center gap-2">
        <Skeleton className="h-[20px] w-[192px]" />
        <Skeleton className="h-[20px] w-[10px]" />
        <Skeleton className="h-[20px] w-[86px]" />
        <Skeleton className="h-[20px] w-[152px]" />
      </div>
    </div>
  )
}

function ProposalDescriptionSkeleton() {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-[24px] w-[40%]" />
        <Skeleton className="h-[20px] w-full" />
        <Skeleton className="h-[20px] w-[94%]" />
        <Skeleton className="h-[20px] w-[85%]" />
        <Skeleton className="h-[20px] w-[88%]" />
        <Skeleton className="h-[20px] w-[74%]" />
        <Skeleton className="h-[20px] w-[68%]" />
      </div>
    </div>
  )
}

function VotePanelSkeleton() {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <Skeleton className="h-[24px] w-[126px] mb-4" />
      <div className="flex gap-3">
        <Skeleton className="h-[36px] flex-1 rounded-[4px]" />
        <Skeleton className="h-[36px] flex-1 rounded-[4px]" />
      </div>
      <Skeleton className="h-[16px] w-[190px] mt-3" />
    </div>
  )
}

function VotingProgressSkeleton() {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <Skeleton className="h-[24px] w-[140px]" />
        <Skeleton className="h-[24px] w-[88px] rounded-full" />
      </div>

      <Skeleton className="h-2 w-full rounded-full" />

      <div className="mt-5 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex min-h-6 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-[15px] w-[58px]" />
            </div>
            <Skeleton className="h-[15px] w-[84px]" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ProposalTimelineSkeleton() {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <Skeleton className="h-[24px] w-[82px] mb-4" />

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <Skeleton className="h-[20px] w-[104px]" />
            <Skeleton className="h-[20px] w-[126px]" />
          </div>
        ))}

        <div className="border-t border-[#e2e8f0] dark:border-white/10 mt-1 pt-3 flex items-center justify-between gap-3">
          <Skeleton className="h-[20px] w-[124px]" />
          <Skeleton className="h-[20px] w-[92px]" />
        </div>
      </div>
    </div>
  )
}

function VotesTableSkeleton() {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] w-full">
      <div className="px-4 py-4">
        <Skeleton className="h-[24px] w-[96px]" />
      </div>

      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="px-4 py-3 flex flex-col gap-2 border-t border-[#cbd5e1] dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-[16px] w-[172px]" />
            <Skeleton className="h-[20px] w-[70px] rounded-full" />
          </div>
          <Skeleton className="h-[16px] w-[136px]" />
        </div>
      ))}

      <div className="flex items-center justify-center px-4 py-3 border-t border-[#cbd5e1] dark:border-white/10">
        <Skeleton className="h-8 w-[130px] rounded-[8px]" />
      </div>
    </div>
  )
}

export default function ProposalDetailLoading() {
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
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="proposalLoadingStar" />
        </div>
      </section>

      {/* Content overlapping hero */}
      <div className="relative z-10 -mt-[320px] md:-mt-[380px] pb-[80px] px-4 md:px-[82px]">
        <div className="flex flex-col gap-6 lg:gap-8 max-w-[1140px] mx-auto">
          <ProposalHeaderSkeleton />

          <div className="flex flex-col-reverse lg:flex-row lg:gap-8 gap-6 lg:items-start">
            <div className="flex-1 min-w-0">
              <ProposalDescriptionSkeleton />
            </div>

            <div className="w-full lg:w-[380px] lg:shrink-0 flex flex-col gap-6">
              <VotePanelSkeleton />
              <VotingProgressSkeleton />
              <ProposalTimelineSkeleton />
              <VotesTableSkeleton />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
