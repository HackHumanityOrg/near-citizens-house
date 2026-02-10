import { notFound } from "next/navigation"
import { getProposal, getProposalVotes } from "../actions"
import { VotePanel } from "@/components/governance/vote-panel"
import { VotesTable } from "@/components/governance/votes-table"
import { ProposalWithAdmin } from "./admin-check"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProposalPage({ params }: Props) {
  const { id } = await params
  const proposalId = parseInt(id, 10)

  if (Number.isNaN(proposalId) || proposalId < 0) {
    notFound()
  }

  const [proposal, votesResult] = await Promise.all([getProposal(proposalId), getProposalVotes(proposalId, 0, 20)])

  if (!proposal) {
    notFound()
  }

  const totalVotes = proposal.yesVotes + proposal.noVotes

  return (
    <div className="w-full px-4 md:px-[82px] py-8 md:py-12">
      <div className="flex flex-col gap-8">
        <ProposalWithAdmin proposal={proposal} />
        <VotePanel proposal={proposal} />
        <VotesTable proposalId={proposalId} initialVotes={votesResult.votes} totalVotes={totalVotes} />
      </div>
    </div>
  )
}
