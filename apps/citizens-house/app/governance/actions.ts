"use server"

import { unstable_cache, updateTag } from "next/cache"
import { nearAccountIdSchema, NEAR_CONFIG } from "@/lib"
import { governanceReader } from "@/lib/contracts/governance/client"
import { superAdmin } from "@/flags"
import type { AccountViewRaw } from "@near-js/types"
import { createRpcProvider } from "@/lib/providers/rpc-provider"
import { paginationSchema, type Pagination } from "@/lib/schemas/core"
import type { ProposalView, VoteView, GovernanceConfig } from "@/lib/contracts/governance/governance-contract"

export type { ProposalView, VoteView, GovernanceConfig }

const governanceContractId = NEAR_CONFIG.governanceContractId ?? ""
const GOVERNANCE_BATCH_SIZE = 100

// =============================================================================
// Proposals
// =============================================================================

async function fetchProposals(pagination: Pagination) {
  return governanceReader.listProposalsNewestFirst(pagination)
}

const getCachedProposals = unstable_cache(
  (pagination: Pagination) => fetchProposals(pagination),
  ["governance", governanceContractId],
  {
    tags: ["governance"],
    revalidate: 30,
  },
)

export async function getProposals(page: number, pageSize: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { proposals: [], total: 0 }

  try {
    return await getCachedProposals(params.data)
  } catch {
    return { proposals: [], total: 0 }
  }
}

async function fetchPublicProposals() {
  const total = await governanceReader.getProposalCount()
  if (total <= 0) return [] as ProposalView[]

  const totalBatches = Math.ceil(total / GOVERNANCE_BATCH_SIZE)
  const proposals: ProposalView[] = []

  for (let batch = 0; batch < totalBatches; batch += 1) {
    const remaining = Math.max(total - batch * GOVERNANCE_BATCH_SIZE, 0)
    if (remaining === 0) break

    const limit = Math.min(GOVERNANCE_BATCH_SIZE, remaining)
    const fromIndex = Math.max(total - (batch + 1) * GOVERNANCE_BATCH_SIZE, 0)
    const chunk = await governanceReader.listProposals(fromIndex, limit)

    if (chunk.length === 0) continue

    // Keep newest-first ordering while removing cancelled proposals from the public page.
    for (const proposal of chunk.reverse()) {
      if (proposal.status !== "cancelled") {
        proposals.push(proposal)
      }
    }
  }

  return proposals
}

const getCachedPublicProposals = unstable_cache(
  () => fetchPublicProposals(),
  ["governance-public-proposals", governanceContractId],
  {
    tags: ["governance"],
    revalidate: 30,
  },
)

export async function getPublicProposals(page: number, pageSize: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { proposals: [], total: 0 }

  try {
    const proposals = await getCachedPublicProposals()
    const total = proposals.length
    const offset = params.data.page * params.data.pageSize

    if (offset >= total) return { proposals: [] as ProposalView[], total }

    return {
      proposals: proposals.slice(offset, offset + params.data.pageSize),
      total,
    }
  } catch {
    return { proposals: [] as ProposalView[], total: 0 }
  }
}

const getCachedProposal = unstable_cache(
  (proposalId: number) => governanceReader.getProposal(proposalId),
  ["governance-proposal", governanceContractId],
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
  ["governance-votes", governanceContractId],
  { tags: ["governance"], revalidate: 15 },
)

export async function getProposalVotes(proposalId: number, page: number, pageSize: number, knownTotalVotes?: number) {
  const params = paginationSchema.safeParse({ page, pageSize })
  if (!params.success) return { votes: [] as VoteView[], total: 0 }

  try {
    let totalVotes = typeof knownTotalVotes === "number" && Number.isFinite(knownTotalVotes) ? knownTotalVotes : null

    if (totalVotes === null) {
      const proposal = await getCachedProposal(proposalId)
      if (!proposal) return { votes: [] as VoteView[], total: 0 }
      totalVotes = proposal.yesVotes + proposal.noVotes
    }

    if (totalVotes <= 0) return { votes: [] as VoteView[], total: 0 }

    const offset = params.data.page * params.data.pageSize
    if (offset >= totalVotes) return { votes: [] as VoteView[], total: totalVotes }

    const limit = Math.min(params.data.pageSize, totalVotes - offset)
    const fromIndex = Math.max(totalVotes - offset - limit, 0)
    const votes = await getCachedVotes(proposalId, fromIndex, limit)
    return { votes: [...votes].reverse(), total: totalVotes }
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

export async function checkIsBlocklisted(accountId: string): Promise<boolean> {
  const parsed = nearAccountIdSchema.safeParse(accountId)
  if (!parsed.success) return false

  try {
    return await governanceReader.isBlocklisted(parsed.data)
  } catch {
    return false
  }
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  try {
    return await superAdmin()
  } catch {
    return false
  }
}

const getCachedIsVoteFree = unstable_cache(
  () => governanceReader.isVoteFree(),
  ["governance-vote-free", governanceContractId],
  {
    tags: ["governance"],
    revalidate: 60,
  },
)

export async function checkIsVoteFree(): Promise<boolean> {
  try {
    return await getCachedIsVoteFree()
  } catch {
    return false
  }
}

const getCachedConfig = unstable_cache(
  () => governanceReader.getConfig(),
  ["governance-config", governanceContractId],
  {
    tags: ["governance"],
    revalidate: 60,
  },
)

export async function getGovernanceConfig(): Promise<GovernanceConfig | null> {
  try {
    return await getCachedConfig()
  } catch {
    return null
  }
}

const getCachedAdmins = unstable_cache(
  (fromIndex: number, limit: number) => governanceReader.listAdmins(fromIndex, limit),
  ["governance-admins", governanceContractId],
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
  ["governance-blocklist", governanceContractId],
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
  updateTag("governance")
}
