import { Skeleton } from "@/components/ui/skeleton"

export default function VerificationStartLoading() {
  return (
    <div className="w-full">
      <section className="relative h-[320px] md:h-[380px] -mt-32 pt-32 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 w-full h-full bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.4)_0%,_rgba(253,221,57,0.3)_25%,_rgba(249,230,136,0.2)_45%,_rgba(245,236,189,0.14)_60%,_rgba(242,242,242,0.06)_75%,_transparent_100%)] dark:bg-[radial-gradient(ellipse_650px_420px_at_center_30%,_rgba(255,218,30,0.28)_0%,_rgba(253,221,57,0.2)_30%,_rgba(249,230,136,0.14)_55%,_transparent_80%)]" />
        </div>

        <div className="relative flex flex-col items-center justify-start pt-[40px] md:pt-[60px] h-full px-8 md:px-4 z-10">
          <div className="w-full max-w-[600px] px-[40px] md:px-[60px]">
            <div className="grid w-full grid-cols-[40px_1fr_40px] grid-rows-[40px_auto] items-start gap-y-[16px]">
              <div className="col-start-1 row-start-1 flex items-center justify-center">
                <Skeleton className="size-[40px] rounded-full" />
              </div>
              <div className="col-start-2 row-start-1 h-[40px] flex items-center px-[16px] md:px-[24px]">
                <div className="w-full h-[1px] bg-black/20 dark:bg-white/20" />
              </div>
              <div className="col-start-3 row-start-1 flex items-center justify-center">
                <Skeleton className="size-[40px] rounded-full" />
              </div>
              <div className="col-start-1 row-start-2 justify-self-center">
                <Skeleton className="h-[28px] w-[120px] md:w-[160px]" />
              </div>
              <div className="col-start-3 row-start-2 justify-self-center">
                <Skeleton className="h-[28px] w-[100px] md:w-[120px]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 flex flex-col items-center pb-[80px] -mt-[40px] w-full px-4">
        <div className="flex flex-col items-start w-full max-w-[650px]">
          <div className="bg-white dark:bg-black border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[24px] flex items-center justify-center py-[40px] px-4 md:px-0 w-full">
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-col gap-[16px] items-start pb-[8px] pt-0 px-0 w-full max-w-[520px]">
                <Skeleton className="h-[32px] w-[280px]" />

                <div className="flex flex-col gap-2 w-full">
                  <Skeleton className="h-[28px] w-full" />
                  <Skeleton className="h-[28px] w-5/6" />
                </div>

                <div className="flex flex-col gap-[16px] items-start py-[8px] px-0 w-full">
                  <div className="flex gap-[16px] items-center pt-[24px] pb-0 px-0 w-full">
                    <Skeleton className="h-[48px] w-full rounded-[4px]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
