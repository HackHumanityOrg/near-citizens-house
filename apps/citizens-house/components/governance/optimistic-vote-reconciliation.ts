import type { ProposalView, VoteView } from "@/lib/schemas/governance-contract"
import type { OptimisticVote } from "./optimistic-vote"

export interface OptimisticVoteBaseline {
  yesVotes: number
  noVotes: number
}

export function isOptimisticVotePresentInServerVotes(optimisticVote: OptimisticVote | null, initialVotes: VoteView[]) {
  if (!optimisticVote) return false

  return initialVotes.some(
    (vote) => vote.proposalId === optimisticVote.proposalId && vote.voter === optimisticVote.voter,
  )
}

export function doesServerTallyIncludeConfirmedVote(
  optimisticVote: OptimisticVote | null,
  optimisticBaseline: OptimisticVoteBaseline | null,
  proposal: Pick<ProposalView, "yesVotes" | "noVotes">,
) {
  if (!optimisticVote || optimisticVote.status !== "confirmed" || !optimisticBaseline) return false

  return optimisticVote.choice === "yes"
    ? proposal.yesVotes > optimisticBaseline.yesVotes
    : proposal.noVotes > optimisticBaseline.noVotes
}

export function shouldApplyOptimisticAggregates(
  optimisticVote: OptimisticVote | null,
  initialVotes: VoteView[],
  optimisticBaseline: OptimisticVoteBaseline | null,
  proposal: Pick<ProposalView, "yesVotes" | "noVotes">,
) {
  if (!optimisticVote) return false

  const presentInServerVotes = isOptimisticVotePresentInServerVotes(optimisticVote, initialVotes)
  if (presentInServerVotes) return false

  const tallyIncludesVote = doesServerTallyIncludeConfirmedVote(optimisticVote, optimisticBaseline, proposal)
  if (tallyIncludesVote) return false

  return true
}
