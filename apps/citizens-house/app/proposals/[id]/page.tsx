import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@near-citizens/ui"
import { ProposalDetail } from "@/components/proposals/proposal-detail"
import { ArrowLeft, Loader2 } from "lucide-react"

interface ProposalPageProps {
  params: {
    id: string
  }
}

async function getProposal(id: string, accountId?: string) {
  const url = new URL(`/api/governance/proposals/${id}`, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001")

  if (accountId) {
    url.searchParams.set("accountId", accountId)
  }

  const response = await fetch(url.toString(), {
    cache: "no-store", // Always fetch fresh data for proposals
  })

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error("Failed to fetch proposal")
  }

  return response.json()
}

export async function generateMetadata({ params }: ProposalPageProps) {
  const data = await getProposal(params.id)

  if (!data) {
    return {
      title: "Proposal Not Found",
    }
  }

  return {
    title: `${data.proposal.title} | Citizens House`,
    description: data.proposal.description.substring(0, 160),
  }
}

export default async function ProposalPage({ params }: ProposalPageProps) {
  // TODO: Get actual wallet address from wallet connection
  // For now, we'll check cookies or session
  const accountId = undefined // Replace with actual wallet connection

  const data = await getProposal(params.id, accountId)

  if (!data) {
    notFound()
  }

  const { proposal, voteCounts, quorumRequired, totalCitizens, userVote } = data

  // TODO: Check if user is verified citizen
  // For now, assume false
  const canVote = false

  return (
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

      {/* Proposal Detail */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <ProposalDetail
          proposal={proposal}
          voteCounts={voteCounts}
          quorumRequired={quorumRequired}
          totalCitizens={totalCitizens}
          userVote={userVote}
          canVote={canVote}
        />
      </Suspense>
    </div>
  )
}
