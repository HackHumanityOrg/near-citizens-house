"use server"

import * as Sentry from "@sentry/nextjs"
import { unstable_cache, updateTag } from "next/cache"
import { nearAccountIdSchema, NEAR_CONFIG } from "@/lib"
import { governanceReader } from "@/lib/contracts/governance/client"
import { superAdmin } from "@/flags"
import type { AccountViewRaw } from "@near-js/types"
import { createRpcProvider } from "@/lib/providers/rpc-provider"
import { paginationSchema, type Pagination } from "@/lib/schemas/core"
import type { ProposalView, VoteView, GovernanceConfig } from "@/lib/contracts/governance/governance-contract"
import { withObservedServerAction } from "@/lib/observability/server-action"
import { trackServerEvent } from "@/lib/analytics-server"

export type { ProposalView, VoteView, GovernanceConfig }

const governanceContractId = NEAR_CONFIG.governanceContractId ?? ""
const GOVERNANCE_BATCH_SIZE = 100

type LogContext = Record<string, string | number | boolean | null | undefined>

type GovernanceServerActionOutcome = "success" | "validation_failed" | "fallback"
type GovernanceServerActionTrackingContext = {
  accountId?: string
  proposalId?: number
  page?: number
  pageSize?: number
  itemCount?: number
  total?: number
  errorMessage?: string
}

function normalizeNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const normalized = Math.trunc(value)
  if (normalized < 0) return undefined
  return normalized
}

function normalizePositiveInt(value: unknown): number | undefined {
  const normalized = normalizeNonNegativeInt(value)
  if (normalized === undefined || normalized <= 0) return undefined
  return normalized
}

function normalizeNearAccountId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const parsed = nearAccountIdSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function parseTrackingContextFromLog(context?: LogContext): GovernanceServerActionTrackingContext {
  if (!context) return {}

  return {
    accountId: normalizeNearAccountId(context.account_id ?? context.accountId),
    proposalId: normalizeNonNegativeInt(context.proposal_id ?? context.proposalId),
    page: normalizeNonNegativeInt(context.page),
    pageSize: normalizePositiveInt(context.page_size ?? context.pageSize),
    itemCount: normalizeNonNegativeInt(context.item_count ?? context.itemCount),
    total: normalizeNonNegativeInt(context.total),
  }
}

function trackGovernanceServerActionResult(
  actionName: string,
  outcome: GovernanceServerActionOutcome,
  context?: GovernanceServerActionTrackingContext,
): void {
  const accountId = normalizeNearAccountId(context?.accountId)
  void trackServerEvent(accountId ?? "anonymous", {
    domain: "governance",
    action: "server_action_result",
    actionName,
    outcome,
    accountId,
    proposalId: normalizeNonNegativeInt(context?.proposalId),
    page: normalizeNonNegativeInt(context?.page),
    pageSize: normalizePositiveInt(context?.pageSize),
    itemCount: normalizeNonNegativeInt(context?.itemCount),
    total: normalizeNonNegativeInt(context?.total),
    errorMessage: context?.errorMessage,
  })
}

function captureGovernanceActionError(actionName: string, error: unknown, context?: LogContext): void {
  Sentry.captureException(error, {
    level: "warning",
    tags: {
      area: "governance_server_action",
      action: actionName,
    },
    extra: context,
  })

  const attributes: Record<string, string | number | boolean> = {
    action: actionName,
    error_message: error instanceof Error ? error.message : "Unknown error",
  }

  if (context) {
    for (const [key, value] of Object.entries(context)) {
      if (value !== null && value !== undefined) {
        attributes[key] = value
      }
    }
  }

  Sentry.logger.warn("governance_server_action_failed", attributes)
  const trackingContext = parseTrackingContextFromLog(context)
  trackGovernanceServerActionResult(actionName, "fallback", {
    ...trackingContext,
    errorMessage: error instanceof Error ? error.message : "Unknown error",
  })
}

function observeGovernanceAction<T>(actionName: string, fn: () => Promise<T>): Promise<T> {
  return withObservedServerAction(actionName, fn)
}

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
  return observeGovernanceAction("governance.getProposals", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getProposals", "validation_failed", { page, pageSize })
      return { proposals: [], total: 0 }
    }

    try {
      const result = await getCachedProposals(params.data)
      trackGovernanceServerActionResult("governance.getProposals", "success", {
        page: params.data.page,
        pageSize: params.data.pageSize,
        itemCount: result.proposals.length,
        total: result.total,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getProposals", error, { page, page_size: pageSize })
      return { proposals: [], total: 0 }
    }
  })
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
  return observeGovernanceAction("governance.getPublicProposals", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getPublicProposals", "validation_failed", { page, pageSize })
      return { proposals: [], total: 0 }
    }

    try {
      const proposals = await getCachedPublicProposals()
      const total = proposals.length
      const offset = params.data.page * params.data.pageSize

      if (offset >= total) {
        trackGovernanceServerActionResult("governance.getPublicProposals", "success", {
          page: params.data.page,
          pageSize: params.data.pageSize,
          itemCount: 0,
          total,
        })
        return { proposals: [] as ProposalView[], total }
      }

      const result = {
        proposals: proposals.slice(offset, offset + params.data.pageSize),
        total,
      }
      trackGovernanceServerActionResult("governance.getPublicProposals", "success", {
        page: params.data.page,
        pageSize: params.data.pageSize,
        itemCount: result.proposals.length,
        total: result.total,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getPublicProposals", error, { page, page_size: pageSize })
      return { proposals: [] as ProposalView[], total: 0 }
    }
  })
}

const getCachedProposal = unstable_cache(
  (proposalId: number) => governanceReader.getProposal(proposalId),
  ["governance-proposal", governanceContractId],
  { tags: ["governance"], revalidate: 15 },
)

export async function getProposal(proposalId: number): Promise<ProposalView | null> {
  return observeGovernanceAction("governance.getProposal", async () => {
    try {
      const proposal = await getCachedProposal(proposalId)
      trackGovernanceServerActionResult("governance.getProposal", "success", {
        proposalId,
        itemCount: proposal ? 1 : 0,
      })
      return proposal
    } catch (error) {
      captureGovernanceActionError("governance.getProposal", error, { proposal_id: proposalId })
      return null
    }
  })
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
  return observeGovernanceAction("governance.getProposalVotes", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getProposalVotes", "validation_failed", {
        proposalId,
        page,
        pageSize,
      })
      return { votes: [] as VoteView[], total: 0 }
    }

    try {
      let totalVotes = typeof knownTotalVotes === "number" && Number.isFinite(knownTotalVotes) ? knownTotalVotes : null

      if (totalVotes === null) {
        const proposal = await getCachedProposal(proposalId)
        if (!proposal) {
          trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
            proposalId,
            page: params.data.page,
            pageSize: params.data.pageSize,
            itemCount: 0,
            total: 0,
          })
          return { votes: [] as VoteView[], total: 0 }
        }
        totalVotes = proposal.yesVotes + proposal.noVotes
      }

      if (totalVotes <= 0) {
        trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
          proposalId,
          page: params.data.page,
          pageSize: params.data.pageSize,
          itemCount: 0,
          total: 0,
        })
        return { votes: [] as VoteView[], total: 0 }
      }

      const offset = params.data.page * params.data.pageSize
      if (offset >= totalVotes) {
        trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
          proposalId,
          page: params.data.page,
          pageSize: params.data.pageSize,
          itemCount: 0,
          total: totalVotes,
        })
        return { votes: [] as VoteView[], total: totalVotes }
      }

      const limit = Math.min(params.data.pageSize, totalVotes - offset)
      const fromIndex = Math.max(totalVotes - offset - limit, 0)
      const votes = await getCachedVotes(proposalId, fromIndex, limit)
      const result = { votes: [...votes].reverse(), total: totalVotes }
      trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
        proposalId,
        page: params.data.page,
        pageSize: params.data.pageSize,
        itemCount: result.votes.length,
        total: result.total,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getProposalVotes", error, {
        proposal_id: proposalId,
        page,
        page_size: pageSize,
      })
      return { votes: [] as VoteView[], total: 0 }
    }
  })
}

export async function checkHasVoted(proposalId: number, accountId: string): Promise<boolean> {
  return observeGovernanceAction("governance.checkHasVoted", async () => {
    const parsed = nearAccountIdSchema.safeParse(accountId)
    if (!parsed.success) {
      trackGovernanceServerActionResult("governance.checkHasVoted", "validation_failed", { proposalId })
      return false
    }

    try {
      const hasVoted = await governanceReader.hasVoted(proposalId, parsed.data)
      trackGovernanceServerActionResult("governance.checkHasVoted", "success", {
        accountId: parsed.data,
        proposalId,
      })
      return hasVoted
    } catch (error) {
      captureGovernanceActionError("governance.checkHasVoted", error, {
        proposal_id: proposalId,
        account_id: parsed.data,
      })
      return false
    }
  })
}

export async function getVote(proposalId: number, accountId: string) {
  return observeGovernanceAction("governance.getVote", async () => {
    const parsed = nearAccountIdSchema.safeParse(accountId)
    if (!parsed.success) {
      trackGovernanceServerActionResult("governance.getVote", "validation_failed", { proposalId })
      return null
    }

    try {
      const vote = await governanceReader.getVote(proposalId, parsed.data)
      trackGovernanceServerActionResult("governance.getVote", "success", {
        accountId: parsed.data,
        proposalId,
        itemCount: vote ? 1 : 0,
      })
      return vote
    } catch (error) {
      captureGovernanceActionError("governance.getVote", error, {
        proposal_id: proposalId,
        account_id: parsed.data,
      })
      return null
    }
  })
}

// =============================================================================
// Admin & Config
// =============================================================================

export async function checkIsAdmin(accountId: string): Promise<boolean> {
  return observeGovernanceAction("governance.checkIsAdmin", async () => {
    const parsed = nearAccountIdSchema.safeParse(accountId)
    if (!parsed.success) {
      trackGovernanceServerActionResult("governance.checkIsAdmin", "validation_failed")
      return false
    }

    try {
      const isAdmin = await governanceReader.isAdmin(parsed.data)
      trackGovernanceServerActionResult("governance.checkIsAdmin", "success", { accountId: parsed.data })
      return isAdmin
    } catch (error) {
      captureGovernanceActionError("governance.checkIsAdmin", error, { account_id: parsed.data })
      return false
    }
  })
}

export async function checkIsBlocklisted(accountId: string): Promise<boolean> {
  return observeGovernanceAction("governance.checkIsBlocklisted", async () => {
    const parsed = nearAccountIdSchema.safeParse(accountId)
    if (!parsed.success) {
      trackGovernanceServerActionResult("governance.checkIsBlocklisted", "validation_failed")
      return false
    }

    try {
      const isBlocklisted = await governanceReader.isBlocklisted(parsed.data)
      trackGovernanceServerActionResult("governance.checkIsBlocklisted", "success", { accountId: parsed.data })
      return isBlocklisted
    } catch (error) {
      captureGovernanceActionError("governance.checkIsBlocklisted", error, { account_id: parsed.data })
      return false
    }
  })
}

export async function checkIsSuperAdmin(): Promise<boolean> {
  return observeGovernanceAction("governance.checkIsSuperAdmin", async () => {
    try {
      const isSuperAdmin = await superAdmin()
      trackGovernanceServerActionResult("governance.checkIsSuperAdmin", "success")
      return isSuperAdmin
    } catch (error) {
      captureGovernanceActionError("governance.checkIsSuperAdmin", error)
      return false
    }
  })
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
  return observeGovernanceAction("governance.checkIsVoteFree", async () => {
    try {
      const isVoteFree = await getCachedIsVoteFree()
      trackGovernanceServerActionResult("governance.checkIsVoteFree", "success")
      return isVoteFree
    } catch (error) {
      captureGovernanceActionError("governance.checkIsVoteFree", error)
      return false
    }
  })
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
  return observeGovernanceAction("governance.getGovernanceConfig", async () => {
    try {
      const config = await getCachedConfig()
      trackGovernanceServerActionResult("governance.getGovernanceConfig", "success", { itemCount: config ? 1 : 0 })
      return config
    } catch (error) {
      captureGovernanceActionError("governance.getGovernanceConfig", error)
      return null
    }
  })
}

const getCachedAdmins = unstable_cache(
  (fromIndex: number, limit: number) => governanceReader.listAdmins(fromIndex, limit),
  ["governance-admins", governanceContractId],
  { tags: ["governance"], revalidate: 30 },
)

export async function getAdminList(page: number, pageSize: number) {
  return observeGovernanceAction("governance.getAdminList", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getAdminList", "validation_failed", { page, pageSize })
      return { admins: [] as string[], total: 0 }
    }

    try {
      const fromIndex = params.data.page * params.data.pageSize
      const admins = await getCachedAdmins(fromIndex, params.data.pageSize)
      const result = { admins, total: -1 }
      trackGovernanceServerActionResult("governance.getAdminList", "success", {
        page: params.data.page,
        pageSize: params.data.pageSize,
        itemCount: admins.length,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getAdminList", error, { page, page_size: pageSize })
      return { admins: [] as string[], total: 0 }
    }
  })
}

const getCachedBlocklist = unstable_cache(
  (fromIndex: number, limit: number) => governanceReader.listBlocklist(fromIndex, limit),
  ["governance-blocklist", governanceContractId],
  { tags: ["governance"], revalidate: 30 },
)

export async function getBlocklist(page: number, pageSize: number) {
  return observeGovernanceAction("governance.getBlocklist", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getBlocklist", "validation_failed", { page, pageSize })
      return { accounts: [] as string[], total: 0 }
    }

    try {
      const fromIndex = params.data.page * params.data.pageSize
      const accounts = await getCachedBlocklist(fromIndex, params.data.pageSize)
      const result = { accounts, total: -1 }
      trackGovernanceServerActionResult("governance.getBlocklist", "success", {
        page: params.data.page,
        pageSize: params.data.pageSize,
        itemCount: accounts.length,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getBlocklist", error, { page, page_size: pageSize })
      return { accounts: [] as string[], total: 0 }
    }
  })
}

export async function checkIsBlocklistLocked(): Promise<boolean> {
  return observeGovernanceAction("governance.checkIsBlocklistLocked", async () => {
    try {
      const isLocked = await governanceReader.isBlocklistLocked()
      trackGovernanceServerActionResult("governance.checkIsBlocklistLocked", "success")
      return isLocked
    } catch (error) {
      captureGovernanceActionError("governance.checkIsBlocklistLocked", error)
      return false
    }
  })
}

export type BlocklistLockInfo = {
  locked: boolean
  hasActiveProposals: boolean
}

export async function getBlocklistLockInfo(): Promise<BlocklistLockInfo> {
  return observeGovernanceAction("governance.getBlocklistLockInfo", async () => {
    try {
      const locked = await governanceReader.isBlocklistLocked()
      if (!locked) {
        trackGovernanceServerActionResult("governance.getBlocklistLockInfo", "success")
        return { locked: false, hasActiveProposals: false }
      }

      // Determine lock reason by checking for pending/active proposals across all pages
      const pageSize = 100
      const firstPage = await governanceReader.listProposalsNewestFirst({ page: 0, pageSize })
      const hasActiveInPage = (pageProposals: typeof firstPage.proposals) =>
        pageProposals.some((p) => p.status === "pending" || p.status === "active")

      if (hasActiveInPage(firstPage.proposals)) {
        trackGovernanceServerActionResult("governance.getBlocklistLockInfo", "success")
        return { locked: true, hasActiveProposals: true }
      }

      const totalPages = Math.ceil(firstPage.total / pageSize)
      for (let page = 1; page < totalPages; page += 1) {
        const { proposals } = await governanceReader.listProposalsNewestFirst({ page, pageSize })
        if (hasActiveInPage(proposals)) {
          trackGovernanceServerActionResult("governance.getBlocklistLockInfo", "success")
          return { locked: true, hasActiveProposals: true }
        }
      }

      trackGovernanceServerActionResult("governance.getBlocklistLockInfo", "success")
      return { locked: true, hasActiveProposals: false }
    } catch (error) {
      captureGovernanceActionError("governance.getBlocklistLockInfo", error)
      return { locked: false, hasActiveProposals: false }
    }
  })
}

export async function getPendingVotesCount(proposalId: number): Promise<number> {
  return observeGovernanceAction("governance.getPendingVotesCount", async () => {
    try {
      const pendingVotesCount = await governanceReader.getPendingVotesCount(proposalId)
      trackGovernanceServerActionResult("governance.getPendingVotesCount", "success", {
        proposalId,
      })
      return pendingVotesCount
    } catch (error) {
      captureGovernanceActionError("governance.getPendingVotesCount", error, { proposal_id: proposalId })
      return 0
    }
  })
}

// =============================================================================
// Account Balance
// =============================================================================

export async function checkAccountBalance(accountId: string): Promise<string> {
  return observeGovernanceAction("governance.checkAccountBalance", async () => {
    const parsed = nearAccountIdSchema.safeParse(accountId)
    if (!parsed.success) {
      trackGovernanceServerActionResult("governance.checkAccountBalance", "validation_failed")
      return "0"
    }

    try {
      const provider = createRpcProvider()
      const response = await provider.query<AccountViewRaw>({
        request_type: "view_account",
        account_id: parsed.data,
        finality: "optimistic",
      })
      trackGovernanceServerActionResult("governance.checkAccountBalance", "success", { accountId: parsed.data })
      return response.amount
    } catch (error) {
      captureGovernanceActionError("governance.checkAccountBalance", error, { account_id: parsed.data })
      return "0"
    }
  })
}

// =============================================================================
// Cache Revalidation
// =============================================================================

export async function revalidateGovernance() {
  return observeGovernanceAction("governance.revalidateGovernance", async () => {
    updateTag("governance")
    trackGovernanceServerActionResult("governance.revalidateGovernance", "success")
  })
}
