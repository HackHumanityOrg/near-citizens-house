import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@near-citizens/ui"
import { ProposalList } from "@/components/proposals/proposal-list"
import { Loader2 } from "lucide-react"
import { GovernanceHeader } from "@/components/shared/governance-header"

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <GovernanceHeader />

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Page Description */}
        <div className="mb-8">
          <p className="text-lg text-muted-foreground">Community proposals for the Citizens House DAO</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <Link href="/">
            <Button variant="ghost" className="border-b-2 border-primary rounded-none">
              All
            </Button>
          </Link>
          <Link href="/?status=Active">
            <Button variant="ghost" className="rounded-none">
              Active
            </Button>
          </Link>
          <Link href="/?status=Passed">
            <Button variant="ghost" className="rounded-none">
              Passed
            </Button>
          </Link>
          <Link href="/?status=Failed">
            <Button variant="ghost" className="rounded-none">
              Failed
            </Button>
          </Link>
        </div>

        {/* Proposals List */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ProposalList />
        </Suspense>
      </div>
    </div>
  )
}
