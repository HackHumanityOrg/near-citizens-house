"use client"

import { useState, useEffect, useCallback } from "react"
import { type Proposal, type VoteCounts, type Vote, useNearWallet } from "@near-citizens/shared"
import { ProposalDetail } from "./proposal-detail"
import { getUserVote, checkVerificationStatus, getProposalWithStats } from "@/lib/actions/governance"

interface ProposalDetailWrapperProps {
  proposal: Proposal
  voteCounts: VoteCounts
  quorumRequired: number
  totalCitizens: number
}

/**
 * Client-side wrapper for ProposalDetail that handles wallet hydration.
 * Fetches user vote and verification status when wallet is connected.
 */
export function ProposalDetailWrapper({
  proposal: initialProposal,
  voteCounts: initialVoteCounts,
  quorumRequired,
  totalCitizens,
}: ProposalDetailWrapperProps) {
  const { accountId, isConnected, isLoading: walletLoading } = useNearWallet()
  const [userVote, setUserVote] = useState<Vote | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [voteCounts, setVoteCounts] = useState(initialVoteCounts)
  const [loading, setLoading] = useState(false)

  // Fetch user vote and verification status when wallet connects
  useEffect(() => {
    const abortController = new AbortController()

    const fetchUserData = async () => {
      if (!accountId) {
        setUserVote(null)
        setIsVerified(false)
        return
      }

      setLoading(true)
      try {
        const [vote, verified] = await Promise.all([
          getUserVote(initialProposal.id, accountId),
          checkVerificationStatus(accountId),
        ])

        // Only update state if this effect hasn't been cleaned up
        if (!abortController.signal.aborted) {
          setUserVote(vote)
          setIsVerified(verified)
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error("Error fetching user data:", error)
          setUserVote(null)
          setIsVerified(false)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    }

    if (!walletLoading) {
      fetchUserData()
    }

    return () => abortController.abort()
  }, [accountId, walletLoading, initialProposal.id])

  // Callback to refresh vote counts after voting
  const handleVoteSuccess = useCallback(async () => {
    try {
      const data = await getProposalWithStats(initialProposal.id, accountId || undefined)
      if (data) {
        setVoteCounts(data.voteCounts)
        setUserVote(data.userVote || null)
      }
    } catch (error) {
      console.error("Error refreshing proposal data:", error)
    }
  }, [initialProposal.id, accountId])

  // Determine if user can vote
  const canVote = isConnected && isVerified && !loading

  return (
    <ProposalDetail
      proposal={initialProposal}
      voteCounts={voteCounts}
      quorumRequired={quorumRequired}
      totalCitizens={totalCitizens}
      userVote={userVote}
      canVote={canVote}
      onVoteSuccess={handleVoteSuccess}
    />
  )
}
