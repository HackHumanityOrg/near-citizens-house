"use client"

import { useState, useEffect, useCallback } from "react"
import { useNearWallet, type SputnikProposal, type SputnikVote, type TransformedPolicy } from "@near-citizens/shared"
import { ProposalDetail } from "./proposal-detail"
import { getUserVote, getProposal } from "@/lib/actions/sputnik-dao"
import { Loader2 } from "lucide-react"

interface ProposalDetailWrapperProps {
  initialProposal: SputnikProposal
  policy: TransformedPolicy
}

export function ProposalDetailWrapper({ initialProposal, policy }: ProposalDetailWrapperProps) {
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

  // Check if user can vote (for now, assume they can if connected and proposal is InProgress)
  // In a real implementation, you'd check the DAO policy to see if user has voting permissions
  const canVote = isConnected && proposal.status === "InProgress" && !userVote

  if (isLoadingVote) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ProposalDetail
      proposal={proposal}
      policy={policy}
      userVote={userVote}
      canVote={canVote}
      isConnected={isConnected}
      onVoteSuccess={handleVoteSuccess}
    />
  )
}
