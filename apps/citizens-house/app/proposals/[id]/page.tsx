import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@near-citizens/ui"
import { ArrowLeft } from "lucide-react"
import { governanceDb, verificationDb } from "@near-citizens/shared"
import { ProposalDetailWrapper } from "@/components/proposals/proposal-detail-wrapper"
import { GovernanceHeader } from "@/components/shared/governance-header"

interface ProposalPageProps {
  params: Promise<{
    id: string
  }>
}

export async function generateMetadata({ params }: ProposalPageProps) {
  const { id } = await params
  const proposalId = parseInt(id)

  if (isNaN(proposalId)) {
    return { title: "Invalid Proposal" }
  }

  const proposal = await governanceDb.getProposal(proposalId)

  if (!proposal) {
    return { title: "Proposal Not Found" }
  }

  return {
    title: `${proposal.title} | Citizens House`,
    description: proposal.description.substring(0, 160),
  }
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  const { id } = await params
  const proposalId = parseInt(id)

  if (isNaN(proposalId)) {
    notFound()
  }

  // Fetch proposal data server-side
  const proposal = await governanceDb.getProposal(proposalId)

  if (!proposal) {
    notFound()
  }

  // Fetch vote counts and total citizens in parallel
  const [voteCounts, { total: totalCitizens }] = await Promise.all([
    governanceDb.getVoteCounts(proposalId),
    verificationDb.getVerifiedAccounts(0, 1),
  ])

  // Calculate quorum (10% of verified citizens)
  const quorumRequired = Math.ceil(totalCitizens * 0.1)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      <GovernanceHeader />

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/proposals">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Proposals
            </Button>
          </Link>
        </div>

        {/* Proposal Detail with client-side wallet hydration */}
        <ProposalDetailWrapper
          proposal={proposal}
          voteCounts={voteCounts}
          quorumRequired={quorumRequired}
          totalCitizens={totalCitizens}
        />
      </div>
    </div>
  )
}
