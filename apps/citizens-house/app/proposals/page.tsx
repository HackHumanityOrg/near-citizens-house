import { getPublicProposals } from "./actions"
import { ProposalsList } from "@/components/governance/proposals-list"
import { StarPattern } from "@/components/verification/icons/star-pattern"

const PAGE_SIZE = 9

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function GovernancePage({ searchParams }: Props) {
  const params = await searchParams
  const rawPage = parseInt(params.page || "0", 10)
  const requestedPage = Number.isNaN(rawPage) ? 0 : Math.max(0, rawPage)

  let { proposals, total } = await getPublicProposals(requestedPage, PAGE_SIZE)
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const clampedPage = Math.min(requestedPage, totalPages - 1)
  if (clampedPage !== requestedPage && total > 0) {
    const result = await getPublicProposals(clampedPage, PAGE_SIZE)
    proposals = result.proposals
    total = result.total
  }
  const page = clampedPage

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
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="governanceStar" />
        </div>

        <div className="relative flex flex-col items-center justify-start pt-[24px] md:pt-[40px] h-full px-4 md:px-8 z-10">
          <h1 className="font-fk-grotesk font-medium text-[36px] md:text-[62px] leading-[40px] md:leading-[72px] text-black dark:text-white text-center">
            Proposals
          </h1>
        </div>
      </section>

      {/* Proposals List */}
      <div className="relative z-10 -mt-[240px] md:-mt-[280px] pb-[80px]">
        <ProposalsList proposals={proposals} total={total} page={page} pageSize={PAGE_SIZE} totalPages={totalPages} />
      </div>
    </div>
  )
}
