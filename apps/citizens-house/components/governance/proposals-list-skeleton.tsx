import { Skeleton } from "@/components/ui/skeleton"
import { ProposalCardSkeleton } from "./proposal-card-skeleton"

interface ProposalsGridSkeletonProps {
  cardCount?: number
  preserveDesktopGridSpace?: boolean
}

function ProposalsListHeaderSkeleton() {
  return (
    <>
      <div className="flex justify-end">
        <Skeleton className="h-[28px] w-[112px]" />
      </div>
      <Skeleton className="h-[14px] w-[240px]" />
    </>
  )
}

function ProposalsGridSkeleton({ cardCount = 3, preserveDesktopGridSpace = true }: ProposalsGridSkeletonProps) {
  const cards = Array.from({ length: cardCount })

  return (
    <div
      className={[
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4",
        preserveDesktopGridSpace ? "xl:grid-rows-3 xl:min-h-[992px]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {cards.map((_, index) => (
        <ProposalCardSkeleton key={index} />
      ))}
    </div>
  )
}

function ProposalsPaginationSkeleton() {
  return (
    <div className="flex flex-col gap-3 items-center md:flex-row md:justify-between mt-6 w-full max-w-[1276px]">
      <Skeleton className="h-[14px] w-[92px] order-2 md:order-1" />
      <div className="flex gap-3 order-1 md:order-2">
        <Skeleton className="h-[36px] w-[114px] rounded-[4px]" />
        <Skeleton className="h-[36px] w-[92px] rounded-[4px]" />
      </div>
    </div>
  )
}

interface ProposalsListSkeletonProps {
  cardCount?: number
  showPagination?: boolean
  preserveDesktopGridSpace?: boolean
}

export function ProposalsListSkeleton({
  cardCount = 3,
  showPagination = true,
  preserveDesktopGridSpace = true,
}: ProposalsListSkeletonProps) {
  return (
    <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
      <div className="w-full max-w-[1276px] flex flex-col gap-4">
        <ProposalsListHeaderSkeleton />
        <ProposalsGridSkeleton cardCount={cardCount} preserveDesktopGridSpace={preserveDesktopGridSpace} />
      </div>
      {showPagination ? <ProposalsPaginationSkeleton /> : null}
    </div>
  )
}
