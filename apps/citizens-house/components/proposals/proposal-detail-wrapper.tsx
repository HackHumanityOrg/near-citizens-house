"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { type Proposal, type VoteCounts, useNearWallet } from "@near-citizens/shared"
import { ProposalDetail } from "./proposal-detail"
import { getUserVote, getProposalWithStats } from "@/lib/actions/governance"
import { useVerification } from "@/hooks/verification"

interface ProposalDetailWrapperProps {
  proposal: Proposal
  voteCounts: VoteCounts
  quorumRequired: number
  totalCitizens: number
  serverTime: number
}

/**
 * Client-side wrapper for ProposalDetail that handles wallet hydration.
 * Uses SWR for caching user vote data across navigation.
 */
export function ProposalDetailWrapper({
  proposal: initialProposal,
  voteCounts: initialVoteCounts,
  quorumRequired,
  totalCitizens,
  serverTime,
}: ProposalDetailWrapperProps) {
  const { accountId, isConnected, isLoading: walletLoading } = useNearWallet()
  const { isVerified, loading: verificationLoading } = useVerification()

  // SWR for user vote - keyed by proposal ID and account
  const {
    data: voteData,
    isLoading: voteLoading,
    mutate: mutateVote,
  } = useSWR(accountId ? ["user-vote", initialProposal.id, accountId] : null, () =>
    getUserVote(initialProposal.id, accountId!),
  )

  // SWR for vote counts - can be revalidated after voting
  const { data: voteCounts, mutate: mutateVoteCounts } = useSWR(
    ["vote-counts", initialProposal.id],
    () =>
      getProposalWithStats(initialProposal.id, accountId || undefined).then((d) => d?.voteCounts ?? initialVoteCounts),
    { fallbackData: initialVoteCounts },
  )

  // Callback to refresh vote counts after voting
  const handleVoteSuccess = useCallback(async () => {
    await Promise.all([mutateVote(), mutateVoteCounts()])
  }, [mutateVote, mutateVoteCounts])

  // Determine if user can vote
  const loading = walletLoading || verificationLoading || voteLoading
  const canVote = isConnected && isVerified && !loading

  return (
    <ProposalDetail
      proposal={initialProposal}
      voteCounts={voteCounts ?? initialVoteCounts}
      quorumRequired={quorumRequired}
      totalCitizens={totalCitizens}
      userVote={voteData ?? null}
      canVote={canVote}
      onVoteSuccess={handleVoteSuccess}
      serverTime={serverTime}
    />
  )
}
