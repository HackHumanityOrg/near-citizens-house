"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { trackEvent } from "@/lib/analytics"
import type { ProposalView, VoteView } from "@/lib/schemas/governance-contract"
import { VotePanel } from "./vote-panel"
import { VotesTable } from "./votes-table"
import { ProposalTimeline, VotingProgressCard } from "./proposal-detail"
import type { OptimisticVote, VoteLifecyclePayload } from "./optimistic-vote"
import { shouldApplyOptimisticAggregates, type OptimisticVoteBaseline } from "./optimistic-vote-reconciliation"

interface Props {
  proposal: ProposalView
  proposalId: number
  initialVotes: VoteView[]
  totalVotes: number
}

export function ProposalVotingSidebar({ proposal, proposalId, initialVotes, totalVotes }: Props) {
  const [optimisticVote, setOptimisticVote] = useState<OptimisticVote | null>(null)
  const [optimisticBaseline, setOptimisticBaseline] = useState<OptimisticVoteBaseline | null>(null)

  useEffect(() => {
    const now = Date.now()
    const isScheduled = proposal.status === "active" && proposal.startAt > now
    const isFinished = proposal.status === "active" && proposal.endsAt < now
    const proposalStatus = isScheduled ? "scheduled" : isFinished ? "finished" : proposal.status

    trackEvent({
      domain: "governance",
      action: "proposal_detail_view",
      proposalId,
      proposalStatus,
      totalVotes,
    })
  }, [proposal.endsAt, proposal.startAt, proposal.status, proposalId, totalVotes])

  const handleVoteProcessing = useCallback(
    (payload: VoteLifecyclePayload) => {
      setOptimisticVote({ ...payload, status: "pending" })
      setOptimisticBaseline({ yesVotes: proposal.yesVotes, noVotes: proposal.noVotes })
    },
    [proposal.noVotes, proposal.yesVotes],
  )

  const handleVoteSuccess = useCallback(
    (payload: VoteLifecyclePayload) => {
      setOptimisticVote((prev) => {
        if (!prev) return { ...payload, status: "confirmed" }
        return { ...prev, ...payload, status: "confirmed" }
      })
      setOptimisticBaseline((prev) => prev ?? { yesVotes: proposal.yesVotes, noVotes: proposal.noVotes })
    },
    [proposal.noVotes, proposal.yesVotes],
  )

  const handleVoteFailure = useCallback(() => {
    setOptimisticVote(null)
    setOptimisticBaseline(null)
  }, [])

  const shouldApplyAggregates = useMemo(
    () => shouldApplyOptimisticAggregates(optimisticVote, initialVotes, optimisticBaseline, proposal),
    [initialVotes, optimisticBaseline, optimisticVote, proposal],
  )

  const optimisticVoteForPanel = optimisticVote
  const optimisticVoteForAggregates = shouldApplyAggregates ? optimisticVote : null
  const optimisticTotalDelta = optimisticVoteForAggregates ? 1 : 0
  const proposalForProgress = useMemo(() => {
    if (!optimisticVoteForAggregates) return proposal

    if (optimisticVoteForAggregates.status === "pending") return proposal

    if (optimisticVoteForAggregates.choice === "yes") {
      return {
        ...proposal,
        yesVotes: proposal.yesVotes + 1,
      }
    }

    return {
      ...proposal,
      noVotes: proposal.noVotes + 1,
    }
  }, [proposal, optimisticVoteForAggregates])
  const initialVotesSignature = initialVotes.map((vote) => `${vote.voter}:${vote.choice}:${vote.votedAt}`).join("|")
  const votesTableKey = `${proposalId}:${totalVotes}:${initialVotesSignature}`

  return (
    <>
      <VotePanel
        proposal={proposal}
        optimisticVote={optimisticVoteForPanel}
        onVoteProcessing={handleVoteProcessing}
        onVoteSuccess={handleVoteSuccess}
        onVoteFailure={handleVoteFailure}
      />
      <VotingProgressCard proposal={proposalForProgress} />
      <ProposalTimeline proposal={proposal} />
      <VotesTable
        key={votesTableKey}
        proposalId={proposalId}
        initialVotes={initialVotes}
        totalVotes={totalVotes}
        optimisticVote={optimisticVoteForAggregates}
        optimisticTotalDelta={optimisticTotalDelta}
      />
    </>
  )
}
