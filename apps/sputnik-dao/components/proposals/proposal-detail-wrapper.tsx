"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { useNearWallet, type SputnikProposal, type TransformedPolicy } from "@near-citizens/shared"
import { ProposalDetail } from "./proposal-detail"
import { getUserVote, getProposal } from "@/lib/actions/sputnik-dao"
import { useVerification } from "@/hooks/verification"

/** Check if the account is a citizen (member of the citizen role in the DAO policy) */
function isCitizen(policy: TransformedPolicy, accountId: string | null | undefined): boolean {
  if (!accountId) return false

  const citizenRole = policy.roles.find((r) => r.name === "citizen")
  if (!citizenRole) return false

  if (typeof citizenRole.kind === "object" && "Group" in citizenRole.kind) {
    return citizenRole.kind.Group.includes(accountId)
  }

  return false
}

interface ProposalDetailWrapperProps {
  initialProposal: SputnikProposal
  policy: TransformedPolicy
  serverTime: number
}

export function ProposalDetailWrapper({ initialProposal, policy, serverTime }: ProposalDetailWrapperProps) {
  const { accountId, isConnected } = useNearWallet()
  const { isVerified, loading: isLoadingVerification } = useVerification()

  // SWR for user vote - keyed by proposal ID and account
  const {
    data: userVote,
    isLoading: isLoadingVote,
    mutate: mutateVote,
  } = useSWR(accountId && isConnected ? ["sputnik-user-vote", initialProposal.id, accountId] : null, () =>
    getUserVote(initialProposal.id, accountId!),
  )

  // SWR for proposal data - can be revalidated after voting
  const { data: proposal, mutate: mutateProposal } = useSWR(
    ["sputnik-proposal", initialProposal.id],
    () => getProposal(initialProposal.id),
    { fallbackData: initialProposal },
  )

  // Refresh proposal data after voting
  const handleVoteSuccess = useCallback(async () => {
    await Promise.all([mutateProposal(), mutateVote()])
  }, [mutateProposal, mutateVote])

  const userIsCitizen = isCitizen(policy, accountId)

  // canVote focuses on proposal state: in progress, not already voted, and data loaded
  const canVote =
    isConnected && !isLoadingVote && userIsCitizen && (proposal ?? initialProposal).status === "InProgress" && !userVote

  return (
    <ProposalDetail
      proposal={proposal ?? initialProposal}
      policy={policy}
      userVote={userVote ?? null}
      canVote={canVote}
      isConnected={isConnected}
      isVerified={isVerified}
      isLoadingVerification={isLoadingVerification}
      isCitizen={userIsCitizen}
      onVoteSuccess={handleVoteSuccess}
      serverTime={serverTime}
    />
  )
}
