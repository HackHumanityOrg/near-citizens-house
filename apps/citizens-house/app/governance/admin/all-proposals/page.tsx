import { Suspense } from "react"
import { ProposalList, ProposalListSkeleton } from "@/components/proposals/proposal-list"
import { getProposalsReversed } from "@/lib/actions/sputnik-dao"

export const dynamic = "force-dynamic"

async function ProposalListLoader() {
  const { proposals, hasMore } = await getProposalsReversed(0, 10)

  return <ProposalList initialProposals={proposals} initialHasMore={hasMore} showAllKinds />
}

export default function AdminAllProposalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">All Proposals</h1>
        <p className="text-muted-foreground">View all proposal types including membership changes and policy updates</p>
      </div>

      <Suspense
        fallback={
          <div role="status" aria-live="polite">
            <ProposalListSkeleton showAllKinds />
            <span className="sr-only">Loading proposals...</span>
          </div>
        }
      >
        <ProposalListLoader />
      </Suspense>
    </div>
  )
}
