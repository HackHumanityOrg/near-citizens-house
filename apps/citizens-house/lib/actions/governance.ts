"use server"

import { governanceDb, verificationDb, type ProposalStatus, type Vote } from "@near-citizens/shared"

interface ProposalWithStats {
  proposal: {
    id: number
    title: string
    description: string
    proposer: string
    discourseUrl: string | null
    createdAt: number
    votingEndsAt: number
    status: ProposalStatus
  }
  voteCounts: {
    yesVotes: number
    noVotes: number
    totalVotes: number
  }
  quorumRequired: number
  totalCitizens: number
  userVote?: Vote | null
}

/**
 * Server action to fetch proposals with vote stats
 */
export async function getProposalsWithStats(
  from: number = 0,
  limit: number = 10,
  status?: ProposalStatus,
): Promise<{ proposals: ProposalWithStats[] }> {
  try {
    // Fetch proposals and total citizens count in parallel
    const [proposals, { total: totalCitizens }] = await Promise.all([
      governanceDb.getProposals(from, limit, status),
      verificationDb.getVerifiedAccounts(0, 1),
    ])

    // Calculate quorum (10% of verified citizens)
    const quorumRequired = Math.ceil(totalCitizens * 0.1)

    // Get vote counts for each proposal
    const proposalsWithStats = await Promise.all(
      proposals.map(async (proposal) => {
        const voteCounts = await governanceDb.getVoteCounts(proposal.id)
        return {
          proposal,
          voteCounts,
          quorumRequired,
          totalCitizens,
        }
      }),
    )

    return { proposals: proposalsWithStats }
  } catch (error) {
    console.error("[Server Action] Error fetching proposals:", error)
    return { proposals: [] }
  }
}

/**
 * Server action to fetch a single proposal with stats
 */
export async function getProposalWithStats(proposalId: number, accountId?: string): Promise<ProposalWithStats | null> {
  try {
    const proposal = await governanceDb.getProposal(proposalId)

    if (!proposal) {
      return null
    }

    // Fetch vote counts and total citizens in parallel
    const [voteCounts, { total: totalCitizens }] = await Promise.all([
      governanceDb.getVoteCounts(proposalId),
      verificationDb.getVerifiedAccounts(0, 1),
    ])

    // Calculate quorum (10% of verified citizens)
    const quorumRequired = Math.ceil(totalCitizens * 0.1)

    // Get user's vote if accountId provided
    let userVote: Vote | null = null
    if (accountId) {
      userVote = await governanceDb.getVote(proposalId, accountId)
    }

    return {
      proposal,
      voteCounts,
      quorumRequired,
      totalCitizens,
      userVote,
    }
  } catch (error) {
    console.error("[Server Action] Error fetching proposal:", error)
    return null
  }
}

/**
 * Server action to check if an account is verified
 */
export async function checkVerificationStatus(accountId: string): Promise<boolean> {
  try {
    return await verificationDb.isAccountVerified(accountId)
  } catch (error) {
    console.error("[Server Action] Error checking verification:", error)
    return false
  }
}

/**
 * Server action to get user's vote on a proposal
 */
export async function getUserVote(proposalId: number, accountId: string): Promise<Vote | null> {
  try {
    return await governanceDb.getVote(proposalId, accountId)
  } catch (error) {
    console.error("[Server Action] Error getting user vote:", error)
    return null
  }
}
