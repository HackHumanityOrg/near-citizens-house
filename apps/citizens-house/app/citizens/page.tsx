import { getVerificationsWithStatus } from "./actions"
import { VerificationsTable } from "@/components/citizens/verifications-table"
import { StarPattern } from "@/components/verification/icons/star-pattern"

const PAGE_SIZE = 10

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function VerificationsPage({ searchParams }: Props) {
  const params = await searchParams
  const rawPage = parseInt(params.page || "0", 10)
  const requestedPage = Number.isNaN(rawPage) ? 0 : Math.max(0, rawPage)

  let { accounts, total } = await getVerificationsWithStatus(requestedPage, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // If requested page is out of range and there's data, re-fetch the last valid page
  const clampedPage = Math.min(requestedPage, totalPages - 1)
  if (clampedPage !== requestedPage && total > 0) {
    const result = await getVerificationsWithStatus(clampedPage, PAGE_SIZE)
    accounts = result.accounts
    total = result.total
  }
  const page = clampedPage

  return (
    <div className="w-full">
      {/* Hero Section with gradient background */}
      <section className="relative h-[480px] md:h-[560px] -mt-32 pt-32 overflow-hidden">
        {/* Yellow gradient background - extends downward */}
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
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="citizensStar" />
        </div>

        {/* Title - less space above */}
        <div className="relative flex flex-col items-center justify-start pt-[24px] md:pt-[40px] h-full px-4 md:px-8 z-10">
          <h1 className="font-fk-grotesk font-medium text-[36px] md:text-[62px] leading-[40px] md:leading-[72px] text-black dark:text-white text-center">
            Citizens
          </h1>
        </div>
      </section>

      {/* Table Section - more space from title, header aligns with gradient edge */}
      <div className="relative z-10 -mt-[240px] md:-mt-[280px] pb-[80px]">
        <VerificationsTable
          accounts={accounts}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          totalPages={totalPages}
        />
      </div>
    </div>
  )
}
