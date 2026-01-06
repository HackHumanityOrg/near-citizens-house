"use server"

import { z } from "zod"
import { sputnikDaoDb, nearAccountIdSchema, type SputnikProposal, type TransformedPolicy } from "@near-citizens/shared"
import { createServerActionEvent } from "@/lib/logger"

const paginationSchema = z.object({
  page: z.number().int().min(0).max(100000),
  pageSize: z.number().int().min(1).max(100),
})

const proposalIdSchema = z.number().int().min(0)

/**
 * Get a single proposal by ID
 */
export async function getProposal(id: number): Promise<SputnikProposal | null> {
  const event = createServerActionEvent("sputnik.getProposal")
  event.set("proposal_id", id)

  const parsed = proposalIdSchema.safeParse(id)
  if (!parsed.success) {
    event.setError({ code: "INVALID_PROPOSAL_ID", message: "Invalid proposal ID" })
    event.error("Invalid proposal ID")
    return null
  }

  const proposal = await sputnikDaoDb.getProposal(parsed.data)
  event.set("proposal_found", !!proposal)
  event.info("Proposal fetched")
  return proposal
}

/**
 * Get paginated list of proposals
 * @param fromIndex Starting index (0-based)
 * @param limit Maximum number of proposals to return
 */
export async function getProposals(fromIndex: number = 0, limit: number = 20): Promise<SputnikProposal[]> {
  const event = createServerActionEvent("sputnik.getProposals")
  event.set("from_index", fromIndex)
  event.set("limit", limit)

  const params = paginationSchema.safeParse({ page: fromIndex, pageSize: limit })
  if (!params.success) {
    event.setError({ code: "INVALID_PAGINATION", message: "Invalid pagination parameters" })
    event.error("Invalid pagination")
    return []
  }

  const proposals = await sputnikDaoDb.getProposals(params.data.page, params.data.pageSize)
  event.set("proposals_count", proposals.length)
  event.info("Proposals fetched")
  return proposals
}

/**
 * Get the last proposal ID (total proposals - 1)
 */
export async function getLastProposalId(): Promise<number> {
  const event = createServerActionEvent("sputnik.getLastProposalId")
  const lastId = await sputnikDaoDb.getLastProposalId()
  event.set("last_proposal_id", lastId)
  event.info("Last proposal ID fetched")
  return lastId
}

/**
 * Get the DAO policy configuration
 */
export async function getPolicy(): Promise<TransformedPolicy> {
  const event = createServerActionEvent("sputnik.getPolicy")
  const policy = await sputnikDaoDb.getPolicy()
  event.set("roles_count", policy.roles.length)
  event.info("DAO policy fetched")
  return policy
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
  const event = createServerActionEvent("sputnik.getProposalsReversed")
  event.set("page", page)
  event.set("page_size", pageSize)

  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) {
    event.setError({ code: "INVALID_PAGINATION", message: "Invalid pagination parameters" })
    event.error("Invalid pagination")
    return { proposals: [], hasMore: false, total: 0 }
  }

  // get_last_proposal_id returns the next proposal ID to be used, which equals total count
  const total = await sputnikDaoDb.getLastProposalId()
  event.set("total_proposals", total)

  if (total === 0) {
    event.info("No proposals found")
    return { proposals: [], hasMore: false, total: 0 }
  }

  const lastExistingId = total - 1

  // Calculate starting index for this page (from end) using validated params
  const startFromEnd = params.data.page * params.data.pageSize
  const endIndex = lastExistingId - startFromEnd
  const startIndex = Math.max(0, endIndex - params.data.pageSize + 1)
  const count = endIndex - startIndex + 1

  if (endIndex < 0) {
    event.info("Page out of range")
    return { proposals: [], hasMore: false, total }
  }

  // Fetch proposals and reverse them so newest is first
  const proposals = await sputnikDaoDb.getProposals(startIndex, count)
  proposals.reverse()

  const hasMore = startIndex > 0

  event.set("proposals_returned", proposals.length)
  event.set("has_more", hasMore)
  event.info("Proposals fetched in reverse order")

  return { proposals, hasMore, total }
}

/**
 * Check if an account has voted on a proposal
 */
export async function hasVoted(proposalId: number, accountId: string): Promise<boolean> {
  const event = createServerActionEvent("sputnik.hasVoted")
  event.set("proposal_id", proposalId)
  event.setUser({ account_id: accountId })

  const idResult = proposalIdSchema.safeParse(proposalId)
  const accountResult = nearAccountIdSchema.safeParse(accountId)

  if (!idResult.success || !accountResult.success) {
    event.setError({ code: "INVALID_PARAMS", message: "Invalid proposal ID or account ID" })
    event.error("Invalid params")
    return false
  }

  const proposal = await sputnikDaoDb.getProposal(idResult.data)
  if (!proposal) {
    event.set("proposal_found", false)
    event.info("Proposal not found")
    return false
  }

  const voted = accountResult.data in proposal.votes
  event.set("has_voted", voted)
  event.info("Vote status checked")
  return voted
}

/**
 * Get the user's vote on a proposal
 */
export async function getUserVote(
  proposalId: number,
  accountId: string,
): Promise<"Approve" | "Reject" | "Remove" | null> {
  const event = createServerActionEvent("sputnik.getUserVote")
  event.set("proposal_id", proposalId)
  event.setUser({ account_id: accountId })

  const idResult = proposalIdSchema.safeParse(proposalId)
  const accountResult = nearAccountIdSchema.safeParse(accountId)

  if (!idResult.success || !accountResult.success) {
    event.setError({ code: "INVALID_PARAMS", message: "Invalid proposal ID or account ID" })
    event.error("Invalid params")
    return null
  }

  const proposal = await sputnikDaoDb.getProposal(idResult.data)
  if (!proposal) {
    event.set("proposal_found", false)
    event.info("Proposal not found")
    return null
  }

  const vote = proposal.votes[accountResult.data] ?? null
  event.set("vote", vote)
  event.info("User vote retrieved")
  return vote
}
