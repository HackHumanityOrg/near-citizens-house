"use client"

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { trackEvent } from "@/lib/analytics"
import type { ProposalView, VoteView } from "@/lib/schemas/governance-contract"
import { VotePanel } from "./vote-panel"
import { VotesTable } from "./votes-table"
import { ProposalTimeline, VotingProgressCard } from "./proposal-detail"
import type { OptimisticVote, VoteLifecyclePayload } from "./optimistic-vote"
import { shouldApplyOptimisticAggregates, type OptimisticVoteBaseline } from "./optimistic-vote-reconciliation"

interface ProposalVotingData {
  proposal: ProposalView
  proposalId: number
  initialVotes: VoteView[]
  totalVotes: number
}

interface ProposalVotingProviderProps extends ProposalVotingData {
  children: ReactNode
}

interface ProposalVotingContextValue extends ProposalVotingData {
  optimisticVoteForPanel: OptimisticVote | null
  optimisticVoteForAggregates: OptimisticVote | null
  optimisticTotalDelta: number
  proposalForProgress: ProposalView
  votesTableKey: string
  onVoteProcessing: (payload: VoteLifecyclePayload) => void
  onVoteSuccess: (payload: VoteLifecyclePayload) => void
  onVoteFailure: () => void
}

const ProposalVotingContext = createContext<ProposalVotingContextValue | null>(null)

function useProposalVotingContext() {
  const context = useContext(ProposalVotingContext)
  if (!context) {
    throw new Error("Proposal voting components must be used inside ProposalVotingProvider")
  }
  return context
}

export function ProposalVotingProvider({
  proposal,
  proposalId,
  initialVotes,
  totalVotes,
  children,
}: ProposalVotingProviderProps) {
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
  const contextValue = useMemo<ProposalVotingContextValue>(
    () => ({
      proposal,
      proposalId,
      initialVotes,
      totalVotes,
      optimisticVoteForPanel,
      optimisticVoteForAggregates,
      optimisticTotalDelta,
      proposalForProgress,
      votesTableKey,
      onVoteProcessing: handleVoteProcessing,
      onVoteSuccess: handleVoteSuccess,
      onVoteFailure: handleVoteFailure,
    }),
    [
      proposal,
      proposalId,
      initialVotes,
      totalVotes,
      optimisticVoteForPanel,
      optimisticVoteForAggregates,
      optimisticTotalDelta,
      proposalForProgress,
      votesTableKey,
      handleVoteProcessing,
      handleVoteSuccess,
      handleVoteFailure,
    ],
  )

  return <ProposalVotingContext.Provider value={contextValue}>{children}</ProposalVotingContext.Provider>
}

export function ProposalVotingTop() {
  const { proposal, proposalForProgress, optimisticVoteForPanel, onVoteProcessing, onVoteSuccess, onVoteFailure } =
    useProposalVotingContext()

  return (
    <>
      <VotePanel
        proposal={proposal}
        optimisticVote={optimisticVoteForPanel}
        onVoteProcessing={onVoteProcessing}
        onVoteSuccess={onVoteSuccess}
        onVoteFailure={onVoteFailure}
      />
      <VotingProgressCard proposal={proposalForProgress} />
      <ProposalTimeline proposal={proposal} />
    </>
  )
}

export function ProposalVotesList() {
  const { proposalId, initialVotes, totalVotes, optimisticVoteForAggregates, optimisticTotalDelta, votesTableKey } =
    useProposalVotingContext()

  return (
    <>
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
