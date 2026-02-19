"use server"

import * as Sentry from "@sentry/nextjs"
import { cacheLife, cacheTag, updateTag } from "next/cache"
import { nearAccountIdSchema } from "@/lib"
import { governanceReader } from "@/lib/contracts/governance/client"
import { superAdmin } from "@/flags"
import type { AccountViewRaw } from "@near-js/types"
import { createRpcProvider } from "@/lib/providers/rpc-provider"
import { paginationSchema, type Pagination } from "@/lib/schemas/core"
import type { ProposalView, VoteView, GovernanceConfig } from "@/lib/contracts/governance/governance-contract"
import type { TransformedVerificationSummary } from "@/lib/schemas/verification-contract"
import { getVerificationSummary } from "@/app/citizens/actions"
import { withObservedServerAction } from "@/lib/observability/server-action"
import { trackServerEvent } from "@/lib/analytics-server"
import {
  governanceTags,
  normalizeGovernanceAdminsPagination,
  normalizeGovernanceBlocklistPagination,
  normalizeGovernanceProposalsPagination,
  normalizeGovernancePublicProposalsPagination,
  normalizeGovernanceVotesPagination,
  getGovernanceInvalidationTags,
  type GovernanceInvalidationInput,
} from "@/lib/cache/rpc-tags"

export type { ProposalView, VoteView, GovernanceConfig }

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

async function getCachedProposals(pagination: Pagination) {
  "use cache"

  const normalized = normalizeGovernanceProposalsPagination(pagination)
  cacheLife("rpc_warm")
  cacheTag(
    governanceTags.root,
    governanceTags.proposals,
    governanceTags.proposalsPage(normalized.page, normalized.pageSize),
  )
  return governanceReader.listProposalsNewestFirst(normalized)
}

export async function getProposals(page: number, pageSize: number) {
  return observeGovernanceAction("governance.getProposals", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getProposals", "validation_failed", { page, pageSize })
      return { proposals: [], total: 0 }
    }

    const normalized = normalizeGovernanceProposalsPagination(params.data)

    try {
      const result = await getCachedProposals(normalized)
      trackGovernanceServerActionResult("governance.getProposals", "success", {
        page: normalized.page,
        pageSize: normalized.pageSize,
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

async function getCachedAllPublicProposals() {
  "use cache"

  cacheLife("rpc_warm")
  cacheTag(governanceTags.root, governanceTags.publicProposals)
  return fetchPublicProposals()
}

async function getCachedPublicProposalsPage(pagination: Pagination) {
  "use cache"

  const normalized = normalizeGovernancePublicProposalsPagination(pagination)
  cacheLife("rpc_warm")
  cacheTag(
    governanceTags.root,
    governanceTags.publicProposals,
    governanceTags.publicProposalsPage(normalized.page, normalized.pageSize),
  )

  const proposals = await getCachedAllPublicProposals()
  const total = proposals.length
  const offset = normalized.page * normalized.pageSize

  if (offset >= total) {
    return { proposals: [] as ProposalView[], total, page: normalized.page, pageSize: normalized.pageSize }
  }

  return {
    proposals: proposals.slice(offset, offset + normalized.pageSize),
    total,
    page: normalized.page,
    pageSize: normalized.pageSize,
  }
}

export async function getPublicProposals(page: number, pageSize: number) {
  return observeGovernanceAction("governance.getPublicProposals", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getPublicProposals", "validation_failed", { page, pageSize })
      return { proposals: [], total: 0 }
    }

    try {
      const normalized = normalizeGovernancePublicProposalsPagination(params.data)
      const result = await getCachedPublicProposalsPage(normalized)
      trackGovernanceServerActionResult("governance.getPublicProposals", "success", {
        page: result.page,
        pageSize: result.pageSize,
        itemCount: result.proposals.length,
        total: result.total,
      })
      return { proposals: result.proposals, total: result.total }
    } catch (error) {
      captureGovernanceActionError("governance.getPublicProposals", error, { page, page_size: pageSize })
      return { proposals: [] as ProposalView[], total: 0 }
    }
  })
}

async function getCachedProposal(proposalId: number) {
  "use cache"

  cacheLife("rpc_hot")
  cacheTag(governanceTags.root, governanceTags.proposals, governanceTags.proposal(proposalId))
  return governanceReader.getProposal(proposalId)
}

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

async function getCachedVotesPage(
  proposalId: number,
  fromIndex: number,
  limit: number,
  page: number,
  pageSize: number,
) {
  "use cache"

  cacheLife("rpc_hot")
  cacheTag(
    governanceTags.root,
    governanceTags.votes,
    governanceTags.proposalVotes(proposalId),
    governanceTags.proposalVotesPage(proposalId, page, pageSize),
  )
  return governanceReader.listVotes(proposalId, fromIndex, limit)
}

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

    const normalized = normalizeGovernanceVotesPagination(params.data)

    try {
      let totalVotes = typeof knownTotalVotes === "number" && Number.isFinite(knownTotalVotes) ? knownTotalVotes : null

      if (totalVotes === null) {
        const proposal = await getCachedProposal(proposalId)
        if (!proposal) {
          trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
            proposalId,
            page: normalized.page,
            pageSize: normalized.pageSize,
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
          page: normalized.page,
          pageSize: normalized.pageSize,
          itemCount: 0,
          total: 0,
        })
        return { votes: [] as VoteView[], total: 0 }
      }

      const offset = normalized.page * normalized.pageSize
      if (offset >= totalVotes) {
        trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
          proposalId,
          page: normalized.page,
          pageSize: normalized.pageSize,
          itemCount: 0,
          total: totalVotes,
        })
        return { votes: [] as VoteView[], total: totalVotes }
      }

      const limit = Math.min(normalized.pageSize, totalVotes - offset)
      const fromIndex = Math.max(totalVotes - offset - limit, 0)
      const votes = await getCachedVotesPage(proposalId, fromIndex, limit, normalized.page, normalized.pageSize)
      const result = { votes: [...votes].reverse(), total: totalVotes }
      trackGovernanceServerActionResult("governance.getProposalVotes", "success", {
        proposalId,
        page: normalized.page,
        pageSize: normalized.pageSize,
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

export type VoteEligibilitySnapshot = {
  accountId: string
  existingVote: VoteView | null
  verification: TransformedVerificationSummary | null
  isBlocklisted: boolean
  isVoteFree: boolean
  balance: string
}

function createFallbackVoteEligibilitySnapshot(accountId: string): VoteEligibilitySnapshot {
  return {
    accountId,
    existingVote: null,
    verification: null,
    isBlocklisted: false,
    isVoteFree: false,
    balance: "0",
  }
}

export async function getVoteEligibilitySnapshot(
  proposalId: number,
  accountId: string,
): Promise<VoteEligibilitySnapshot> {
  return observeGovernanceAction("governance.getVoteEligibilitySnapshot", async () => {
    const parsed = nearAccountIdSchema.safeParse(accountId)
    const normalizedProposalId = normalizeNonNegativeInt(proposalId)
    if (!parsed.success || normalizedProposalId === undefined) {
      trackGovernanceServerActionResult("governance.getVoteEligibilitySnapshot", "validation_failed", {
        proposalId: normalizedProposalId,
      })
      return createFallbackVoteEligibilitySnapshot(parsed.success ? parsed.data : accountId)
    }

    try {
      const [existingVote, verification, isBlocklisted, isVoteFree, balance] = await Promise.all([
        governanceReader.getVote(normalizedProposalId, parsed.data),
        getVerificationSummary(parsed.data),
        getCachedIsBlocklisted(parsed.data),
        getCachedIsVoteFree(),
        getCachedAccountBalance(parsed.data).catch(() => "0"),
      ])

      trackGovernanceServerActionResult("governance.getVoteEligibilitySnapshot", "success", {
        accountId: parsed.data,
        proposalId: normalizedProposalId,
        itemCount: existingVote ? 1 : 0,
      })

      return {
        accountId: parsed.data,
        existingVote,
        verification,
        isBlocklisted,
        isVoteFree,
        balance,
      }
    } catch (error) {
      captureGovernanceActionError("governance.getVoteEligibilitySnapshot", error, {
        account_id: parsed.data,
        proposal_id: normalizedProposalId,
      })
      return createFallbackVoteEligibilitySnapshot(parsed.data)
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
      const isBlocklisted = await getCachedIsBlocklisted(parsed.data)
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

async function getCachedIsBlocklisted(accountId: string) {
  "use cache"

  cacheLife("rpc_cold")
  cacheTag(governanceTags.root, governanceTags.blocklist, governanceTags.blocklistAll)
  return governanceReader.isBlocklisted(accountId)
}

async function getCachedIsVoteFree() {
  "use cache"

  cacheLife("rpc_cold")
  cacheTag(governanceTags.root, governanceTags.voteFree, governanceTags.config)
  return governanceReader.isVoteFree()
}

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

async function getCachedConfig() {
  "use cache"

  cacheLife("rpc_warm")
  cacheTag(governanceTags.root, governanceTags.config)
  return governanceReader.getConfig()
}

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

async function getCachedAdminsPage(fromIndex: number, limit: number, page: number, pageSize: number) {
  "use cache"

  cacheLife("rpc_warm")
  cacheTag(governanceTags.root, governanceTags.admins, governanceTags.adminsPage(page, pageSize))
  return governanceReader.listAdmins(fromIndex, limit)
}

export async function getAdminList(page: number, pageSize: number) {
  return observeGovernanceAction("governance.getAdminList", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getAdminList", "validation_failed", { page, pageSize })
      return { admins: [] as string[], total: 0 }
    }

    const normalized = normalizeGovernanceAdminsPagination(params.data)

    try {
      const fromIndex = normalized.page * normalized.pageSize
      const admins = await getCachedAdminsPage(fromIndex, normalized.pageSize, normalized.page, normalized.pageSize)
      const result = { admins, total: -1 }
      trackGovernanceServerActionResult("governance.getAdminList", "success", {
        page: normalized.page,
        pageSize: normalized.pageSize,
        itemCount: admins.length,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getAdminList", error, { page, page_size: pageSize })
      return { admins: [] as string[], total: 0 }
    }
  })
}

async function getCachedBlocklistPage(fromIndex: number, limit: number, page: number, pageSize: number) {
  "use cache"

  cacheLife("rpc_warm")
  cacheTag(
    governanceTags.root,
    governanceTags.blocklist,
    governanceTags.blocklistAll,
    governanceTags.blocklistPage(page, pageSize),
  )
  return governanceReader.listBlocklist(fromIndex, limit)
}

export async function getBlocklist(page: number, pageSize: number) {
  return observeGovernanceAction("governance.getBlocklist", async () => {
    const params = paginationSchema.safeParse({ page, pageSize })
    if (!params.success) {
      trackGovernanceServerActionResult("governance.getBlocklist", "validation_failed", { page, pageSize })
      return { accounts: [] as string[], total: 0 }
    }

    const normalized = normalizeGovernanceBlocklistPagination(params.data)

    try {
      const fromIndex = normalized.page * normalized.pageSize
      const accounts = await getCachedBlocklistPage(
        fromIndex,
        normalized.pageSize,
        normalized.page,
        normalized.pageSize,
      )
      const result = { accounts, total: -1 }
      trackGovernanceServerActionResult("governance.getBlocklist", "success", {
        page: normalized.page,
        pageSize: normalized.pageSize,
        itemCount: accounts.length,
      })
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getBlocklist", error, { page, page_size: pageSize })
      return { accounts: [] as string[], total: 0 }
    }
  })
}

async function getCachedIsBlocklistLocked() {
  "use cache"

  cacheLife("rpc_hot")
  cacheTag(governanceTags.root, governanceTags.blocklistLock, governanceTags.blocklist)
  return governanceReader.isBlocklistLocked()
}

export async function checkIsBlocklistLocked(): Promise<boolean> {
  return observeGovernanceAction("governance.checkIsBlocklistLocked", async () => {
    try {
      const isLocked = await getCachedIsBlocklistLocked()
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

async function getCachedBlocklistLockInfo() {
  "use cache"

  cacheLife("rpc_hot")
  cacheTag(governanceTags.root, governanceTags.blocklistLock, governanceTags.proposals)

  const locked = await governanceReader.isBlocklistLocked()
  if (!locked) {
    return { locked: false, hasActiveProposals: false } as BlocklistLockInfo
  }

  // Determine lock reason by checking for pending/active proposals across all pages
  const pageSize = 100
  const firstPage = await governanceReader.listProposalsNewestFirst({ page: 0, pageSize })
  const hasActiveInPage = (pageProposals: typeof firstPage.proposals) =>
    pageProposals.some((proposal) => proposal.status === "pending" || proposal.status === "active")

  if (hasActiveInPage(firstPage.proposals)) {
    return { locked: true, hasActiveProposals: true } as BlocklistLockInfo
  }

  const totalPages = Math.ceil(firstPage.total / pageSize)
  for (let page = 1; page < totalPages; page += 1) {
    const { proposals } = await governanceReader.listProposalsNewestFirst({ page, pageSize })
    if (hasActiveInPage(proposals)) {
      return { locked: true, hasActiveProposals: true } as BlocklistLockInfo
    }
  }

  return { locked: true, hasActiveProposals: false } as BlocklistLockInfo
}

export async function getBlocklistLockInfo(): Promise<BlocklistLockInfo> {
  return observeGovernanceAction("governance.getBlocklistLockInfo", async () => {
    try {
      const result = await getCachedBlocklistLockInfo()
      trackGovernanceServerActionResult("governance.getBlocklistLockInfo", "success")
      return result
    } catch (error) {
      captureGovernanceActionError("governance.getBlocklistLockInfo", error)
      return { locked: false, hasActiveProposals: false }
    }
  })
}

async function getCachedPendingVotesCount(proposalId: number): Promise<number> {
  "use cache"

  cacheLife("rpc_hot")
  cacheTag(
    governanceTags.root,
    governanceTags.pendingVotes,
    governanceTags.proposal(proposalId),
    governanceTags.pendingVotesForProposal(proposalId),
  )
  return governanceReader.getPendingVotesCount(proposalId)
}

export async function getPendingVotesCount(proposalId: number): Promise<number> {
  return observeGovernanceAction("governance.getPendingVotesCount", async () => {
    try {
      const pendingVotesCount = await getCachedPendingVotesCount(proposalId)
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

async function getCachedAccountBalance(accountId: string): Promise<string> {
  "use cache"

  cacheLife("rpc_cold")

  const provider = createRpcProvider()
  const response = await provider.query<AccountViewRaw>({
    request_type: "view_account",
    account_id: accountId,
    finality: "optimistic",
  })
  return response.amount
}

// =============================================================================
// Cache Revalidation
// =============================================================================

export type { GovernanceInvalidationInput }

export async function invalidateGovernanceCache(input: GovernanceInvalidationInput) {
  return observeGovernanceAction("governance.invalidateGovernanceCache", async () => {
    const tags = getGovernanceInvalidationTags(input)
    for (const tag of tags) {
      updateTag(tag)
    }

    trackGovernanceServerActionResult("governance.invalidateGovernanceCache", "success", {
      proposalId: input.proposalId,
      accountId: input.accountId,
      itemCount: tags.length,
    })
  })
}

/**
 * @deprecated Use invalidateGovernanceCache with an explicit operation.
 */
export async function revalidateGovernance() {
  return invalidateGovernanceCache({ op: "proposal_update" })
}
