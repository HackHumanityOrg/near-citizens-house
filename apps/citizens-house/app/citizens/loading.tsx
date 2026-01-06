function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

export default function VerificationsLoading() {
  const rows = Array.from({ length: 5 })

  return (
    <div className="min-h-screen bg-background dark:bg-black">
      <div className="flex flex-col gap-[24px] items-center w-full pt-8 pb-12 md:pt-[80px] md:pb-[80px]">
        <div className="flex flex-col items-center w-full px-4 md:px-0">
          <Skeleton className="h-[32px] w-[180px] md:h-[48px] md:w-[240px]" />
        </div>

        <div className="flex items-center justify-center w-full px-4 md:px-0">
          <Skeleton className="h-[24px] w-[320px] md:h-[36px] md:w-[520px]" />
        </div>

        <div className="flex flex-col items-center pt-[40px] pb-[80px] w-full">
          <div className="flex flex-col items-center w-full">
            <div className="bg-secondary/50 dark:bg-black dark:border dark:border-white/10 flex flex-col items-start rounded-none md:rounded-[16px] w-full max-w-[1276px] md:mx-auto">
              <div className="bg-secondary dark:bg-white/5 flex flex-col gap-[8px] items-start px-4 py-3 md:px-[40px] md:py-[16px] rounded-none md:rounded-tl-[16px] md:rounded-tr-[16px] w-full">
                <div className="flex items-start px-0 py-[8px] w-full">
                  <Skeleton className="h-[24px] w-[240px]" />
                </div>
                <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between w-full">
                  <Skeleton className="h-[14px] w-[220px]" />
                  <Skeleton className="h-[16px] w-[220px]" />
                </div>
              </div>

              <div className="hidden md:block bg-secondary dark:bg-white/5 border-b border-border dark:border-white/10 px-[40px] py-[16px] w-full">
                <div className="grid grid-cols-[1fr_150px_220px_100px] items-center gap-4">
                  <Skeleton className="h-[16px] w-[160px]" />
                  <Skeleton className="h-[16px] w-[120px] justify-self-center" />
                  <Skeleton className="h-[14px] w-[160px] justify-self-center" />
                  <Skeleton className="h-[16px] w-[80px] justify-self-end" />
                </div>
              </div>

              {rows.map((_, index) => (
                <div
                  key={index}
                  className={`px-4 py-3 md:px-[40px] md:py-[16px] w-full ${index !== rows.length - 1 ? "border-b border-border dark:border-white/10" : ""}`}
                >
                  <div className="md:hidden flex flex-col gap-3">
                    <Skeleton className="h-[18px] w-[200px]" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-[28px] w-[120px] rounded-full" />
                      <Skeleton className="h-[36px] w-[96px] rounded-[4px]" />
                    </div>
                    <Skeleton className="h-[12px] w-[160px]" />
                  </div>

                  <div className="hidden md:grid grid-cols-[1fr_150px_220px_100px] items-center gap-4">
                    <Skeleton className="h-[18px] w-[220px]" />
                    <div className="flex justify-center">
                      <Skeleton className="h-[32px] w-[96px] rounded-full" />
                    </div>
                    <Skeleton className="h-[14px] w-[180px] justify-self-center" />
                    <div className="flex justify-end">
                      <Skeleton className="h-[40px] w-[96px] rounded-[4px]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
