import { notFound } from "next/navigation"
import Link from "next/link"
import { SputnikHeader } from "@/components/shared/sputnik-header"
import { ProposalDetailWrapper } from "@/components/proposals/proposal-detail-wrapper"
import { getProposal } from "@/lib/actions/sputnik-dao"
import { Button } from "@near-citizens/ui"
import { ArrowLeft } from "lucide-react"

export const dynamic = "force-dynamic"

interface ProposalPageProps {
  params: Promise<{ id: string }>
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { id } = await params
  const proposalId = parseInt(id, 10)

  if (isNaN(proposalId)) {
    notFound()
  }

  const proposal = await getProposal(proposalId)

  if (!proposal) {
    notFound()
  }

  return (
    <div className="min-h-screen">
      <SputnikHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Link href="/proposals">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Proposals
          </Button>
        </Link>

        <ProposalDetailWrapper initialProposal={proposal} />
      </main>
    </div>
  )
}
