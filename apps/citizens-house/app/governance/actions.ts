"use server"

import { unstable_cache, revalidateTag } from "next/cache"
import { nearAccountIdSchema } from "@/lib"
import { governanceReader } from "@/lib/contracts/governance/client"
import type { AccountViewRaw } from "@near-js/types"
import { createRpcProvider } from "@/lib/providers/rpc-provider"
import { paginationSchema, type Pagination } from "@/lib/schemas/core"
import type { ProposalView, VoteView, GovernanceConfig } from "@/lib/contracts/governance/governance-contract"

export type { ProposalView, VoteView, GovernanceConfig }

// =============================================================================
// Proposals
// =============================================================================

async function fetchProposals(pagination: Pagination) {
  return governanceReader.listProposalsNewestFirst(pagination)
}

const getCachedProposals = unstable_cache((pagination: Pagination) => fetchProposals(pagination), ["governance"], {
  tags: ["governance"],
  revalidate: 30,
})

export async function getProposals(page: number, pageSize: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { proposals: [], total: 0 }

  try {
    return await getCachedProposals(params.data)
  } catch {
    return { proposals: [], total: 0 }
  }
}

const getCachedProposal = unstable_cache(
  (proposalId: number) => governanceReader.getProposal(proposalId),
  ["governance-proposal"],
  { tags: ["governance"], revalidate: 15 },
)

export async function getProposal(proposalId: number): Promise<ProposalView | null> {
  try {
    return await getCachedProposal(proposalId)
  } catch {
    return null
  }
}

// =============================================================================
// Votes
// =============================================================================

const getCachedVotes = unstable_cache(
  (proposalId: number, fromIndex: number, limit: number) => governanceReader.listVotes(proposalId, fromIndex, limit),
  ["governance-votes"],
  { tags: ["governance"], revalidate: 15 },
)

export async function getProposalVotes(proposalId: number, page: number, pageSize: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { votes: [] as VoteView[], total: 0 }

  try {
    const fromIndex = params.data.page * params.data.pageSize
    const votes = await getCachedVotes(proposalId, fromIndex, params.data.pageSize)
    return { votes, total: -1 } // total unknown from list_votes
  } catch {
    return { votes: [] as VoteView[], total: 0 }
  }
}

export async function checkHasVoted(proposalId: number, accountId: string): Promise<boolean> {
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) return false

  try {
    return await governanceReader.hasVoted(proposalId, parsed.data)
  } catch {
    return false
  }
}

export async function getVote(proposalId: number, accountId: string) {
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) return null

  try {
    return await governanceReader.getVote(proposalId, parsed.data)
  } catch {
    return null
  }
}

// =============================================================================
// Admin & Config
// =============================================================================

export async function checkIsAdmin(accountId: string): Promise<boolean> {
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) return false

  try {
    return await governanceReader.isAdmin(parsed.data)
  } catch {
    return false
  }
}

const getCachedIsVoteFree = unstable_cache(() => governanceReader.isVoteFree(), ["governance-vote-free"], {
  tags: ["governance"],
  revalidate: 60,
})

export async function checkIsVoteFree(): Promise<boolean> {
  try {
    return await getCachedIsVoteFree()
  } catch {
    return false
  }
}

const getCachedConfig = unstable_cache(() => governanceReader.getConfig(), ["governance-config"], {
  tags: ["governance"],
  revalidate: 60,
})

export async function getGovernanceConfig(): Promise<GovernanceConfig | null> {
  try {
    return await getCachedConfig()
  } catch {
    return null
  }
}

const getCachedAdmins = unstable_cache(
  (fromIndex: number, limit: number) => governanceReader.listAdmins(fromIndex, limit),
  ["governance-admins"],
  { tags: ["governance"], revalidate: 30 },
)

export async function getAdminList(page: number, pageSize: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { admins: [] as string[], total: 0 }

  try {
    const fromIndex = params.data.page * params.data.pageSize
    const admins = await getCachedAdmins(fromIndex, params.data.pageSize)
    return { admins, total: -1 }
  } catch {
    return { admins: [] as string[], total: 0 }
  }
}

const getCachedBlocklist = unstable_cache(
  (fromIndex: number, limit: number) => governanceReader.listBlocklist(fromIndex, limit),
  ["governance-blocklist"],
  { tags: ["governance"], revalidate: 30 },
)

export async function getBlocklist(page: number, pageSize: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { accounts: [] as string[], total: 0 }

  try {
    const fromIndex = params.data.page * params.data.pageSize
    const accounts = await getCachedBlocklist(fromIndex, params.data.pageSize)
    return { accounts, total: -1 }
  } catch {
    return { accounts: [] as string[], total: 0 }
  }
}

export async function checkIsBlocklistLocked(): Promise<boolean> {
  try {
    return await governanceReader.isBlocklistLocked()
  } catch {
    return false
  }
}

export type BlocklistLockInfo = {
  locked: boolean
  hasActiveProposals: boolean
}

export async function getBlocklistLockInfo(): Promise<BlocklistLockInfo> {
  try {
    const locked = await governanceReader.isBlocklistLocked()
    if (!locked) return { locked: false, hasActiveProposals: false }

    // Determine lock reason by checking for pending/active proposals across all pages
    const pageSize = 100
    const firstPage = await governanceReader.listProposalsNewestFirst({ page: 0, pageSize })
    const hasActiveInPage = (pageProposals: typeof firstPage.proposals) =>
      pageProposals.some((p) => p.status === "pending" || p.status === "active")

    if (hasActiveInPage(firstPage.proposals)) {
      return { locked: true, hasActiveProposals: true }
    }

    const totalPages = Math.ceil(firstPage.total / pageSize)
    for (let page = 1; page < totalPages; page += 1) {
      const { proposals } = await governanceReader.listProposalsNewestFirst({ page, pageSize })
      if (hasActiveInPage(proposals)) {
        return { locked: true, hasActiveProposals: true }
      }
    }

    return { locked: true, hasActiveProposals: false }
  } catch {
    return { locked: false, hasActiveProposals: false }
  }
}

export async function getPendingVotesCount(proposalId: number): Promise<number> {
  try {
    return await governanceReader.getPendingVotesCount(proposalId)
  } catch {
    return 0
  }
}

// =============================================================================
// Account Balance
// =============================================================================

export async function checkAccountBalance(accountId: string): Promise<string> {
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) return "0"

  try {
    const provider = createRpcProvider()
    const response = await provider.query<AccountViewRaw>({
      request_type: "view_account",
      account_id: parsed.data,
      finality: "optimistic",
    })
    return response.amount
  } catch {
    return "0"
  }
}

// =============================================================================
// Cache Revalidation
// =============================================================================

export async function revalidateGovernance() {
  revalidateTag("governance", "max")
}
