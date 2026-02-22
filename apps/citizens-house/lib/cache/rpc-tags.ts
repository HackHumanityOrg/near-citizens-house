import type { Pagination } from "@/lib/schemas/core"

const FALLBACK_PAGE = 0
const FALLBACK_PROPOSALS_PAGE_SIZE = 10
const FALLBACK_PUBLIC_PROPOSALS_PAGE_SIZE = 9
const FALLBACK_VOTES_PAGE_SIZE = 10
const FALLBACK_ADMIN_PAGE_SIZE = 100
const FALLBACK_BLOCKLIST_PAGE_SIZE = 100
const FALLBACK_CITIZENS_PAGE_SIZE = 10

const ALLOWED_PROPOSALS_PAGE_SIZES = [9, 10] as const
const ALLOWED_PUBLIC_PROPOSALS_PAGE_SIZES = [9] as const
const ALLOWED_VOTES_PAGE_SIZES = [10] as const
const ALLOWED_ADMIN_PAGE_SIZES = [100] as const
const ALLOWED_BLOCKLIST_PAGE_SIZES = [100] as const
const ALLOWED_CITIZENS_PAGE_SIZES = [10] as const

function normalizePage(page: number): number {
  if (!Number.isFinite(page)) return FALLBACK_PAGE
  return Math.max(0, Math.trunc(page))
}

function normalizePageSize(pageSize: number, allowed: readonly number[], fallback: number): number {
  if (!Number.isFinite(pageSize)) return fallback

  const normalized = Math.max(1, Math.trunc(pageSize))
  return allowed.includes(normalized) ? normalized : fallback
}

function normalizePagination(
  pagination: Pagination,
  options: {
    allowedPageSizes: readonly number[]
    fallbackPageSize: number
  },
): Pagination {
  return {
    page: normalizePage(pagination.page),
    pageSize: normalizePageSize(pagination.pageSize, options.allowedPageSizes, options.fallbackPageSize),
  }
}

export function normalizeGovernanceProposalsPagination(pagination: Pagination): Pagination {
  return normalizePagination(pagination, {
    allowedPageSizes: ALLOWED_PROPOSALS_PAGE_SIZES,
    fallbackPageSize: FALLBACK_PROPOSALS_PAGE_SIZE,
  })
}

export function normalizeGovernancePublicProposalsPagination(pagination: Pagination): Pagination {
  return normalizePagination(pagination, {
    allowedPageSizes: ALLOWED_PUBLIC_PROPOSALS_PAGE_SIZES,
    fallbackPageSize: FALLBACK_PUBLIC_PROPOSALS_PAGE_SIZE,
  })
}

export function normalizeGovernanceVotesPagination(pagination: Pagination): Pagination {
  return normalizePagination(pagination, {
    allowedPageSizes: ALLOWED_VOTES_PAGE_SIZES,
    fallbackPageSize: FALLBACK_VOTES_PAGE_SIZE,
  })
}

export function normalizeGovernanceAdminsPagination(pagination: Pagination): Pagination {
  return normalizePagination(pagination, {
    allowedPageSizes: ALLOWED_ADMIN_PAGE_SIZES,
    fallbackPageSize: FALLBACK_ADMIN_PAGE_SIZE,
  })
}

export function normalizeGovernanceBlocklistPagination(pagination: Pagination): Pagination {
  return normalizePagination(pagination, {
    allowedPageSizes: ALLOWED_BLOCKLIST_PAGE_SIZES,
    fallbackPageSize: FALLBACK_BLOCKLIST_PAGE_SIZE,
  })
}

export function normalizeCitizensPagination(pagination: Pagination): Pagination {
  return normalizePagination(pagination, {
    allowedPageSizes: ALLOWED_CITIZENS_PAGE_SIZES,
    fallbackPageSize: FALLBACK_CITIZENS_PAGE_SIZE,
  })
}

export const governanceTags = {
  root: "gov",
  proposals: "gov:proposals",
  publicProposals: "gov:public-proposals",
  proposal: (proposalId: number) => `gov:proposal:${proposalId}`,
  proposalsPage: (page: number, pageSize: number) => `gov:proposals:page:${page}:size:${pageSize}`,
  publicProposalsPage: (page: number, pageSize: number) => `gov:public-proposals:page:${page}:size:${pageSize}`,
  votes: "gov:votes",
  proposalVotes: (proposalId: number) => `gov:votes:proposal:${proposalId}`,
  proposalVotesPage: (proposalId: number, page: number, pageSize: number) =>
    `gov:votes:proposal:${proposalId}:page:${page}:size:${pageSize}`,
  admins: "gov:admins",
  adminsPage: (page: number, pageSize: number) => `gov:admins:page:${page}:size:${pageSize}`,
  blocklist: "gov:blocklist",
  blocklistAll: "gov:blocklist:all",
  blocklistPage: (page: number, pageSize: number) => `gov:blocklist:page:${page}:size:${pageSize}`,
  blocklistLock: "gov:blocklist-lock",
  config: "gov:config",
  voteFree: "gov:vote-free",
  pendingVotes: "gov:pending-votes",
  pendingVotesForProposal: (proposalId: number) => `gov:pending-votes:proposal:${proposalId}`,
} as const

export const verificationTags = {
  root: "verif",
  pages: "verif:pages",
  page: (page: number, pageSize: number) => `verif:page:${page}:size:${pageSize}`,
  summaries: "verif:summaries",
  summary: (accountId: string) => `verif:summary:${accountId}`,
} as const

export const citizensTags = {
  pages: "citizens:pages",
  page: (page: number, pageSize: number) => `citizens:page:${page}:size:${pageSize}`,
} as const

export type GovernanceInvalidationOp =
  | "vote_cast"
  | "proposal_create"
  | "proposal_update"
  | "blocklist_update"
  | "admin_update"
  | "config_update"
  | "recovery_update"

export type GovernanceInvalidationInput = {
  op: GovernanceInvalidationOp
  proposalId?: number
  accountId?: string
}

export function getGovernanceInvalidationTags(input: GovernanceInvalidationInput): string[] {
  const tags = new Set<string>([governanceTags.root])

  switch (input.op) {
    case "vote_cast": {
      tags.add(governanceTags.proposals)
      tags.add(governanceTags.publicProposals)
      tags.add(governanceTags.votes)
      tags.add(governanceTags.pendingVotes)
      break
    }
    case "proposal_create": {
      tags.add(governanceTags.proposals)
      tags.add(governanceTags.publicProposals)
      tags.add(governanceTags.blocklistLock)
      break
    }
    case "proposal_update": {
      tags.add(governanceTags.proposals)
      tags.add(governanceTags.publicProposals)
      tags.add(governanceTags.votes)
      tags.add(governanceTags.pendingVotes)
      tags.add(governanceTags.blocklistLock)
      break
    }
    case "blocklist_update": {
      tags.add(governanceTags.blocklist)
      tags.add(governanceTags.blocklistAll)
      tags.add(governanceTags.blocklistLock)
      tags.add(citizensTags.pages)
      break
    }
    case "admin_update": {
      tags.add(governanceTags.admins)
      break
    }
    case "config_update": {
      tags.add(governanceTags.config)
      tags.add(governanceTags.voteFree)
      tags.add(governanceTags.proposals)
      tags.add(governanceTags.publicProposals)
      break
    }
    case "recovery_update": {
      tags.add(governanceTags.pendingVotes)
      tags.add(governanceTags.blocklistLock)
      tags.add(governanceTags.proposals)
      tags.add(governanceTags.publicProposals)
      break
    }
    default: {
      break
    }
  }

  if (typeof input.proposalId === "number" && Number.isFinite(input.proposalId)) {
    tags.add(governanceTags.proposal(input.proposalId))
    tags.add(governanceTags.proposalVotes(input.proposalId))
    tags.add(governanceTags.pendingVotesForProposal(input.proposalId))
  }

  return [...tags]
}

export function getVerificationMutationRevalidateTags(): string[] {
  return [verificationTags.root, verificationTags.pages, verificationTags.summaries, citizensTags.pages]
}
