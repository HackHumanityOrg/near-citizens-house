import { Skeleton } from "@/components/ui/skeleton"

export function ProposalHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-[20px] w-[16px]" />
        <Skeleton className="h-[20px] w-[76px]" />
        <Skeleton className="h-[20px] w-[10px]" />
        <Skeleton className="h-[20px] w-[64px]" />
      </div>

      <Skeleton className="h-[32px] md:h-[40px] w-[92%]" />

      <div className="flex items-center gap-2">
        <Skeleton className="h-[20px] w-[192px]" />
        <Skeleton className="h-[20px] w-[10px]" />
        <Skeleton className="h-[20px] w-[86px]" />
        <Skeleton className="h-[20px] w-[152px]" />
      </div>
    </div>
  )
}

export function ProposalDescriptionSkeleton() {
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

function ProposalVotePanelSkeleton() {
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

function ProposalVotingProgressSkeleton() {
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

function ProposalVotesListSkeleton() {
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

function ProposalVotingTopSkeleton() {
  return (
    <>
      <ProposalVotePanelSkeleton />
      <ProposalVotingProgressSkeleton />
      <ProposalTimelineSkeleton />
    </>
  )
}

interface ProposalSidebarSkeletonProps {
  includeMobileDescription?: boolean
}

export function ProposalSidebarSkeleton({ includeMobileDescription = false }: ProposalSidebarSkeletonProps) {
  return (
    <div className="w-full lg:w-[380px] lg:shrink-0 flex flex-col gap-6">
      <ProposalVotingTopSkeleton />
      {includeMobileDescription ? (
        <div className="lg:hidden">
          <ProposalDescriptionSkeleton />
        </div>
      ) : null}
      <ProposalVotesListSkeleton />
    </div>
  )
}
