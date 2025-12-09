"use client"

import { useState, useEffect, useCallback } from "react"
import { useNearWallet, type SputnikProposal, type SputnikVote, type TransformedPolicy } from "@near-citizens/shared"
import { ProposalDetail } from "./proposal-detail"
import { getUserVote, getProposal } from "@/lib/actions/sputnik-dao"
import { Loader2 } from "lucide-react"

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
  const [proposal, setProposal] = useState<SputnikProposal>(initialProposal)
  const [userVote, setUserVote] = useState<SputnikVote | null>(null)
  const [isLoadingVote, setIsLoadingVote] = useState(false)

  // Fetch user's vote when wallet connects
  useEffect(() => {
    async function fetchUserVote() {
      if (!accountId || !isConnected) {
        setUserVote(null)
        return
      }

      setIsLoadingVote(true)
      try {
        const vote = await getUserVote(proposal.id, accountId)
        setUserVote(vote)
      } catch (error) {
        console.error("Error fetching user vote:", error)
      } finally {
        setIsLoadingVote(false)
      }
    }

    fetchUserVote()
  }, [accountId, isConnected, proposal.id])

  // Refresh proposal data after voting
  const handleVoteSuccess = useCallback(async () => {
    try {
      const [updatedProposal, vote] = await Promise.all([
        getProposal(proposal.id),
        accountId ? getUserVote(proposal.id, accountId) : Promise.resolve(null),
      ])

      if (updatedProposal) {
        setProposal(updatedProposal)
      }
      setUserVote(vote)
    } catch (error) {
      console.error("Error refreshing proposal:", error)
    }
  }, [proposal.id, accountId])

  // Check if user can vote: must be connected, a citizen, proposal in progress, and not already voted
  // Disable voting while loading to prevent premature votes
  const canVote =
    isConnected && !isLoadingVote && isCitizen(policy, accountId) && proposal.status === "InProgress" && !userVote

  return (
    <ProposalDetail
      proposal={proposal}
      policy={policy}
      userVote={userVote}
      canVote={canVote}
      isConnected={isConnected}
      onVoteSuccess={handleVoteSuccess}
      serverTime={serverTime}
    />
  )
}
