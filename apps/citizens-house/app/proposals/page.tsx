import { Suspense } from "react"
import { ProposalList } from "@/components/proposals/proposal-list"
import { ProposalTabs } from "@/components/proposals/proposal-tabs"
import { Loader2 } from "lucide-react"
import { GovernanceHeader } from "@/components/shared/governance-header"
import { type ProposalStatus } from "@near-citizens/shared"

export const metadata = {
  title: "Proposals | Citizens House",
  description: "View and vote on community proposals",
}

interface ProposalsPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function ProposalsPage({ searchParams }: ProposalsPageProps) {
  const params = await searchParams
  const statusFilter = params.status as ProposalStatus | undefined

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <GovernanceHeader />

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Page Description */}
        <div className="mb-8">
          <p className="text-lg text-muted-foreground">Community proposals for the Citizens House DAO</p>
        </div>

        {/* Filter Tabs */}
        <ProposalTabs currentStatus={statusFilter} />

        {/* Proposals List */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ProposalList key={statusFilter || "all"} statusFilter={statusFilter} />
        </Suspense>
      </div>
    </div>
  )
}
