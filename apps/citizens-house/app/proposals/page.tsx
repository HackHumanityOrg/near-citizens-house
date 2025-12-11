import { Suspense } from "react"
import { SputnikHeader } from "@/components/shared/sputnik-header"
import { ProposalList } from "@/components/proposals/proposal-list"
import { getProposalsReversed } from "@/lib/actions/sputnik-dao"
import { Loader2 } from "lucide-react"

export const dynamic = "force-dynamic"

async function ProposalListLoader() {
  const { proposals, hasMore } = await getProposalsReversed(0, 10)

  return <ProposalList initialProposals={proposals} initialHasMore={hasMore} />
}

export default function ProposalsPage() {
  return (
    <div className="min-h-screen">
      <SputnikHeader />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Proposals</h1>
          <p className="text-muted-foreground">View and vote on community proposals</p>
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
      </main>
    </div>
  )
}
