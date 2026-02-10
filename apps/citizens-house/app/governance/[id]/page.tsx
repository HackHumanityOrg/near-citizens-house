import { notFound } from "next/navigation"
import { getProposal, getProposalVotes } from "../actions"
import { ProposalPageLayout } from "./admin-check"
import { StarPattern } from "@/components/verification/icons/star-pattern"

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
          <StarPattern className="w-full h-full text-[#FFDA1E] dark:text-[#FFDA1E]/30" idPrefix="proposalDetailStar" />
        </div>
      </section>

      {/* Content overlapping hero */}
      <div className="relative z-10 -mt-[320px] md:-mt-[380px] pb-[80px] px-4 md:px-[82px]">
        <ProposalPageLayout
          proposal={proposal}
          proposalId={proposalId}
          initialVotes={votesResult.votes}
          totalVotes={totalVotes}
        />
      </div>
    </div>
  )
}
