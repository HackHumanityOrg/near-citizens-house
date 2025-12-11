"use server"

import { z } from "zod"
import {
  sputnikDaoDb,
  paginationSchema,
  nearAccountIdSchema,
  type SputnikProposal,
  type TransformedPolicy,
} from "@near-citizens/shared"

// Local schema - only used in this file
const proposalIdSchema = z.number().int("Proposal ID must be an integer").min(0, "Proposal ID must be non-negative")

/**
 * Get a single proposal by ID
 */
export async function getProposal(id: number): Promise<SputnikProposal | null> {
  const parsed = proposalIdSchema.safeParse(id)
  if (!parsed.success) {
    console.error("[SputnikDAO] Invalid proposal ID:", parsed.error.format())
    return null
  }
  return sputnikDaoDb.getProposal(parsed.data)
}

/**
 * Get paginated list of proposals
 * @param fromIndex Starting index (0-based)
 * @param limit Maximum number of proposals to return
 */
export async function getProposals(fromIndex: number = 0, limit: number = 20): Promise<SputnikProposal[]> {
  const params = paginationSchema.safeParse({ page: fromIndex, pageSize: limit })
  if (!params.success) {
    console.error("[SputnikDAO] Invalid pagination:", params.error.format())
    return []
  }
  return sputnikDaoDb.getProposals(params.data.page, params.data.pageSize)
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
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) {
    console.error("[SputnikDAO] Invalid pagination:", params.error.format())
    return { proposals: [], hasMore: false, total: 0 }
  }

  // get_last_proposal_id returns the next proposal ID to be used, which equals total count
  const total = await sputnikDaoDb.getLastProposalId()

  if (total === 0) {
    return { proposals: [], hasMore: false, total: 0 }
  }

  const lastExistingId = total - 1

  // Calculate starting index for this page (from end) using validated params
  const startFromEnd = params.data.page * params.data.pageSize
  const endIndex = lastExistingId - startFromEnd
  const startIndex = Math.max(0, endIndex - params.data.pageSize + 1)
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
  const idResult = proposalIdSchema.safeParse(proposalId)
  const accountResult = nearAccountIdSchema.safeParse(accountId)

  if (!idResult.success || !accountResult.success) {
    console.error("[SputnikDAO] Invalid params:", {
      proposalId: idResult.error?.format(),
      accountId: accountResult.error?.format(),
    })
    return false
  }

  const proposal = await sputnikDaoDb.getProposal(idResult.data)
  if (!proposal) return false

  return accountResult.data in proposal.votes
}

/**
 * Get the user's vote on a proposal
 */
export async function getUserVote(
  proposalId: number,
  accountId: string,
): Promise<"Approve" | "Reject" | "Remove" | null> {
  const idResult = proposalIdSchema.safeParse(proposalId)
  const accountResult = nearAccountIdSchema.safeParse(accountId)

  if (!idResult.success || !accountResult.success) {
    console.error("[SputnikDAO] Invalid params:", {
      proposalId: idResult.error?.format(),
      accountId: accountResult.error?.format(),
    })
    return null
  }

  const proposal = await sputnikDaoDb.getProposal(idResult.data)
  if (!proposal) return null

  return proposal.votes[accountResult.data] ?? null
}
