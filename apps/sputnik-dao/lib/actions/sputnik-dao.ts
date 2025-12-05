"use server"

import { sputnikDaoDb, type SputnikProposal, type TransformedPolicy } from "@near-citizens/shared"

/**
 * Get a single proposal by ID
 */
export async function getProposal(id: number): Promise<SputnikProposal | null> {
  return sputnikDaoDb.getProposal(id)
}

/**
 * Get paginated list of proposals
 * @param fromIndex Starting index (0-based)
 * @param limit Maximum number of proposals to return
 */
export async function getProposals(fromIndex: number = 0, limit: number = 20): Promise<SputnikProposal[]> {
  return sputnikDaoDb.getProposals(fromIndex, limit)
}

/**
 * Get the last proposal ID (total proposals - 1)
 */
export async function getLastProposalId(): Promise<number> {
  return sputnikDaoDb.getLastProposalId()
}

/**
 * Get the DAO policy configuration
 */
export async function getPolicy(): Promise<TransformedPolicy> {
  return sputnikDaoDb.getPolicy()
}

/**
 * Get proposals in reverse order (newest first)
 * SputnikDAO stores proposals with 0 as oldest, so we fetch from end
 * @param page Page number (0-based)
 * @param pageSize Number of proposals per page
 */
export async function getProposalsReversed(
  page: number = 0,
  pageSize: number = 10,
): Promise<{ proposals: SputnikProposal[]; hasMore: boolean; total: number }> {
  const lastId = await sputnikDaoDb.getLastProposalId()
  const total = lastId + 1 // IDs are 0-indexed

  if (total === 0) {
    return { proposals: [], hasMore: false, total: 0 }
  }

  // Calculate starting index for this page (from end)
  const startFromEnd = page * pageSize
  const endIndex = lastId - startFromEnd
  const startIndex = Math.max(0, endIndex - pageSize + 1)
  const count = endIndex - startIndex + 1

  if (endIndex < 0) {
    return { proposals: [], hasMore: false, total }
  }

  // Fetch proposals and reverse them so newest is first
  const proposals = await sputnikDaoDb.getProposals(startIndex, count)
  proposals.reverse()

  const hasMore = startIndex > 0

  return { proposals, hasMore, total }
}

/**
 * Check if an account has voted on a proposal
 */
export async function hasVoted(proposalId: number, accountId: string): Promise<boolean> {
  const proposal = await sputnikDaoDb.getProposal(proposalId)
  if (!proposal) return false

  return accountId in proposal.votes
}

/**
 * Get the user's vote on a proposal
 */
export async function getUserVote(
  proposalId: number,
  accountId: string,
): Promise<"Approve" | "Reject" | "Remove" | null> {
  const proposal = await sputnikDaoDb.getProposal(proposalId)
  if (!proposal) return null

  return proposal.votes[accountId] ?? null
}
