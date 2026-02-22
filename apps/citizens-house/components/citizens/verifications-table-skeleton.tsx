import { Skeleton } from "@/components/ui/skeleton"

interface VerificationsTableSkeletonProps {
  rowCount?: number
}

export function VerificationsTableSkeleton({ rowCount = 5 }: VerificationsTableSkeletonProps) {
  return (
    <div className="flex flex-col items-center w-full px-4 md:px-[82px]">
      {/* Table Card */}
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 flex flex-col items-start rounded-[16px] w-full max-w-[1276px]">
        {/* Card Header */}
        <div className="flex flex-col gap-[8px] items-start px-[16px] py-[16px] md:px-[40px] rounded-t-[16px] w-full">
          <div className="flex items-start px-0 py-[8px]">
            <Skeleton className="h-[28px] w-[200px]" />
          </div>
          <div className="flex flex-col gap-[8px] md:flex-row md:items-center md:justify-between w-full">
            <Skeleton className="h-[14px] w-[280px]" />
            <div className="flex items-start py-[8px] md:py-0">
              <Skeleton className="h-[28px] w-[120px]" />
            </div>
          </div>
        </div>

        {/* Table Header - Desktop only */}
        <div className="hidden md:block bg-[#e2e8f0] dark:bg-white/10 border-b border-[#cbd5e1] dark:border-white/10 px-[40px] py-[16px] w-full">
          <div className="grid items-center w-full grid-cols-[minmax(0,1fr)_180px_240px_77px] gap-[16px]">
            <Skeleton className="h-[28px] w-[120px]" />
            <div className="flex justify-center">
              <Skeleton className="h-[28px] w-[130px]" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="h-[28px] w-[110px]" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="h-[28px] w-[50px]" />
            </div>
          </div>
        </div>

        {/* Table Body */}
        {Array.from({ length: rowCount }).map((_, index) => {
          const isLastRow = index === rowCount - 1
          return (
            <div
              key={index}
              className={`px-[16px] py-[16px] md:px-[40px] w-full ${!isLastRow ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
            >
              {/* Mobile Card Layout */}
              <div className="md:hidden flex flex-col gap-[12px]">
                <Skeleton className="h-[28px] w-[220px]" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-[32px] w-[86px] rounded-full" />
                  <Skeleton className="h-[32px] w-[77px] rounded-[4px]" />
                </div>
                <Skeleton className="h-[20px] w-[180px]" />
              </div>

              {/* Desktop Row Layout */}
              <div className="hidden md:grid items-center w-full grid-cols-[minmax(0,1fr)_180px_240px_77px] gap-[16px]">
                <Skeleton className="h-[28px] w-full max-w-[320px]" />
                <div className="flex justify-center">
                  <Skeleton className="h-[32px] w-[86px] rounded-full" />
                </div>
                <div className="flex justify-center">
                  <Skeleton className="h-[20px] w-[180px]" />
                </div>
                <div className="flex justify-center">
                  <Skeleton className="h-[32px] w-[77px] rounded-[4px]" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
