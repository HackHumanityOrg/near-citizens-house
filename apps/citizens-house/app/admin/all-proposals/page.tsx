import { Suspense } from "react"
import { ProposalList } from "@/components/proposals/proposal-list"
import { getProposalsReversed } from "@/lib/actions/sputnik-dao"
import { Loader2 } from "lucide-react"

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
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ProposalListLoader />
      </Suspense>
    </div>
  )
}
