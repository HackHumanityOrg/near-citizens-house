import { Skeleton } from "@/components/ui/skeleton"

export function ProposalCardSkeleton() {
  return (
    <div
      data-testid="proposal-card-skeleton"
      className="block h-full bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Skeleton className="h-[26px] md:h-[28px] w-[82%]" />
            <Skeleton className="h-[16px] w-[150px] mt-2" />
          </div>
          <Skeleton className="h-[24px] w-[84px] rounded-full" />
        </div>

        <div
          data-testid="proposal-card-progress"
          className="rounded-[12px] border border-[#e2e8f0] dark:border-white/10 p-4 mt-auto"
        >
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

          <Skeleton className="h-[12px] w-[168px] mt-3" />
        </div>
      </div>
    </div>
  )
}
