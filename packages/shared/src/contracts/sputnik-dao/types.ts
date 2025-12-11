/**
 * SputnikDAO v2 Type Definitions
 *
 * Types for interacting with SputnikDAO v2 contracts.
 * Includes Zod schemas for runtime validation and snake_case → camelCase transforms.
 */
import { z } from "zod"

// ============================================================================
// SputnikDAO Status and Vote Types
// ============================================================================

/**
 * Proposal status enum from SputnikDAO v2
 * Different from custom governance contract status
 */
export const sputnikProposalStatusSchema = z.enum([
  "InProgress",
  "Approved",
  "Rejected",
  "Removed",
  "Expired",
  "Moved",
  "Failed",
])
export type SputnikProposalStatus = z.infer<typeof sputnikProposalStatusSchema>

/**
 * Vote/Action types for SputnikDAO
 * Used when calling act_proposal
 */
export const sputnikActionSchema = z.enum(["VoteApprove", "VoteReject", "VoteRemove", "Finalize", "MoveToHub"])
export type SputnikAction = z.infer<typeof sputnikActionSchema>

/**
 * Vote type stored in proposal.votes map
 */
export const sputnikVoteSchema = z.enum(["Approve", "Reject", "Remove"])
export type SputnikVote = z.infer<typeof sputnikVoteSchema>

// ============================================================================
// Policy Types (must be defined before Proposal Kind Types)
// ============================================================================

/**
 * Voting weight calculation method
 */
export const weightKindSchema = z.enum(["RoleWeight", "TokenWeight"])
export type WeightKind = z.infer<typeof weightKindSchema>

/**
 * Threshold for passing proposals
 * Can be a fixed weight or a ratio (e.g., 1/2 = 50%)
 */
export const weightOrRatioSchema = z.union([
  z.object({ Weight: z.string() }), // U128 as string
  z.tuple([z.number(), z.number()]), // Ratio as [numerator, denominator]
])
export type WeightOrRatio = z.infer<typeof weightOrRatioSchema>

/**
 * Vote policy configuration
 */
export const votePolicySchema = z.object({
  weight_kind: weightKindSchema,
  quorum: z.string(), // U128 as string
  threshold: weightOrRatioSchema,
})
export type VotePolicy = z.infer<typeof votePolicySchema>

/**
 * Role kind - who matches this role
 */
export const roleKindSchema = z.union([
  z.literal("Everyone"),
  z.object({ Member: z.string() }), // U128 threshold
  z.object({ Group: z.array(z.string()) }), // Set of account IDs
])
export type RoleKind = z.infer<typeof roleKindSchema>

/**
 * Role permission definition
 */
export const rolePermissionSchema = z.object({
  name: z.string(),
  kind: roleKindSchema,
  permissions: z.array(z.string()), // HashSet serialized as array
  vote_policy: z.record(z.string(), votePolicySchema).optional(), // HashMap<String, VotePolicy>
})
export type RolePermission = z.infer<typeof rolePermissionSchema>

/**
 * DAO Policy - full configuration
 */
export const sputnikPolicySchema = z.object({
  roles: z.array(rolePermissionSchema),
  default_vote_policy: votePolicySchema,
  proposal_bond: z.string(), // U128 as string (e.g., "1000000000000000000000000" for 1 NEAR)
  proposal_period: z.string(), // U64 as string (nanoseconds)
  bounty_bond: z.string(), // U128 as string
  bounty_forgiveness_period: z.string(), // U64 as string
})
export type SputnikPolicy = z.infer<typeof sputnikPolicySchema>

// ============================================================================
// Proposal Kind Types
// ============================================================================

/**
 * Vote proposal kind (text-only governance)
 * SputnikDAO returns just "Vote" as a string for this kind
 */
export const sputnikProposalKindVoteSchema = z.literal("Vote")

/**
 * Add member to role proposal kind
 */
export const sputnikProposalKindAddMemberSchema = z.object({
  AddMemberToRole: z.object({
    member_id: z.string(),
    role: z.string(),
  }),
})

/**
 * Remove member from role proposal kind
 */
export const sputnikProposalKindRemoveMemberSchema = z.object({
  RemoveMemberFromRole: z.object({
    member_id: z.string(),
    role: z.string(),
  }),
})

/**
 * Change policy / add or update role proposal kind
 * Used by the bridge for dynamic quorum updates
 */
export const sputnikProposalKindChangePolicySchema = z.object({
  ChangePolicyAddOrUpdateRole: z.object({
    role: z.object({
      name: z.string(),
      kind: roleKindSchema,
      permissions: z.array(z.string()),
      vote_policy: z.record(z.string(), votePolicySchema).optional(),
    }),
  }),
})

/**
 * All supported proposal kinds
 * Note: SputnikDAO has more kinds (Transfer, FunctionCall, etc.)
 * but we only support the safe ones through the bridge
 */
export const sputnikProposalKindSchema = z.union([
  sputnikProposalKindVoteSchema,
  sputnikProposalKindAddMemberSchema,
  sputnikProposalKindRemoveMemberSchema,
  sputnikProposalKindChangePolicySchema,
])
export type SputnikProposalKind = z.infer<typeof sputnikProposalKindSchema>

// ============================================================================
// Proposal Types
// ============================================================================

/**
 * Helper to coerce string or number to number (SputnikDAO returns U128 as strings)
 */
const coerceToNumber = z
  .union([z.number(), z.string()])
  .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))

/**
 * Contract format for proposal (snake_case)
 */
export const contractSputnikProposalSchema = z.object({
  id: z.number(),
  proposer: z.string(),
  description: z.string(),
  kind: sputnikProposalKindSchema,
  status: sputnikProposalStatusSchema,
  // vote_counts is a map from role name to [approve, reject, remove] counts
  // SputnikDAO returns these as strings (U128) so we coerce to numbers
  vote_counts: z.record(z.string(), z.tuple([coerceToNumber, coerceToNumber, coerceToNumber])),
  // votes is a map from account ID to vote choice
  votes: z.record(z.string(), sputnikVoteSchema),
  submission_time: z.string(), // U64 as string (nanoseconds)
})

/**
 * Transformed proposal type (camelCase, with computed fields)
 */
export const sputnikProposalSchema = contractSputnikProposalSchema.transform((data) => {
  // Aggregate vote counts across all roles
  let totalApprove = 0
  let totalReject = 0
  let totalRemove = 0

  const voteCounts = Object.values(data.vote_counts) as [number, number, number][]
  for (const [approve, reject, remove] of voteCounts) {
    totalApprove += approve
    totalReject += reject
    totalRemove += remove
  }

  return {
    id: data.id,
    proposer: data.proposer,
    description: data.description,
    kind: data.kind,
    status: data.status,
    voteCounts: data.vote_counts,
    votes: data.votes,
    submissionTime: Math.floor(parseInt(data.submission_time) / 1_000_000), // nanoseconds → milliseconds
    // Aggregated counts for display
    totalApprove,
    totalReject,
    totalRemove,
    totalVotes: totalApprove + totalReject + totalRemove,
  }
})

export type ContractSputnikProposal = z.input<typeof contractSputnikProposalSchema>
export type SputnikProposal = z.output<typeof sputnikProposalSchema>

// ============================================================================
// Transformed Policy Type
// ============================================================================

export const transformedPolicySchema = sputnikPolicySchema.transform((data) => ({
  roles: data.roles.map((role) => ({
    name: role.name,
    kind: role.kind,
    permissions: role.permissions,
    votePolicy: role.vote_policy,
  })),
  defaultVotePolicy: {
    weightKind: data.default_vote_policy.weight_kind,
    quorum: data.default_vote_policy.quorum,
    threshold: data.default_vote_policy.threshold,
  },
  proposalBond: data.proposal_bond,
  proposalPeriodMs: Math.floor(parseInt(data.proposal_period) / 1_000_000), // nanoseconds → milliseconds
  bountyBond: data.bounty_bond,
  bountyForgivenessPeriodMs: Math.floor(parseInt(data.bounty_forgiveness_period) / 1_000_000),
}))

export type TransformedPolicy = z.output<typeof transformedPolicySchema>

// ============================================================================
// Interface for SputnikDAO Contract Client
// ============================================================================

/**
 * Read-only interface for SputnikDAO contract queries.
 * Write operations (voting) are handled client-side via useSputnikDao hook.
 */
export interface ISputnikDaoContract {
  /**
   * Get a single proposal by ID
   */
  getProposal(id: number): Promise<SputnikProposal | null>

  /**
   * Get paginated list of proposals
   */
  getProposals(fromIndex: number, limit: number): Promise<SputnikProposal[]>

  /**
   * Get the last proposal ID (total proposals - 1)
   */
  getLastProposalId(): Promise<number>

  /**
   * Get the DAO policy configuration
   */
  getPolicy(): Promise<TransformedPolicy>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Proposal category for filtering/grouping
 */
export type ProposalCategory = "all" | "vote" | "membership" | "policy"

/**
 * Get proposal category from kind
 */
export function getProposalCategory(kind: SputnikProposalKind): ProposalCategory {
  if (kind === "Vote") {
    return "vote"
  }
  if (typeof kind === "object") {
    if ("AddMemberToRole" in kind || "RemoveMemberFromRole" in kind) {
      return "membership"
    }
    if ("ChangePolicyAddOrUpdateRole" in kind) {
      return "policy"
    }
  }
  return "vote" // fallback
}

/**
 * Category labels for display
 */
export const PROPOSAL_CATEGORY_LABELS: Record<ProposalCategory, string> = {
  all: "All",
  vote: "Votes",
  membership: "Membership",
  policy: "Policy",
}

/**
 * Get human-readable proposal kind description
 */
export function getProposalKindLabel(kind: SputnikProposalKind): string {
  // Vote proposals are just the string "Vote"
  if (kind === "Vote") {
    return "Vote"
  }
  // Object-based kinds
  if (typeof kind === "object") {
    if ("AddMemberToRole" in kind) {
      return `Add ${kind.AddMemberToRole.member_id} to ${kind.AddMemberToRole.role}`
    }
    if ("RemoveMemberFromRole" in kind) {
      return `Remove ${kind.RemoveMemberFromRole.member_id} from ${kind.RemoveMemberFromRole.role}`
    }
    if ("ChangePolicyAddOrUpdateRole" in kind) {
      return `Update ${kind.ChangePolicyAddOrUpdateRole.role.name} role policy`
    }
  }
  return "Unknown"
}

/**
 * Human-readable labels for proposal statuses
 */
export const PROPOSAL_STATUS_LABELS: Record<SputnikProposalStatus, string> = {
  InProgress: "Active",
  Approved: "Passed",
  Rejected: "Rejected",
  Removed: "Removed",
  Expired: "Expired",
  Moved: "Moved",
  Failed: "Failed",
}

/**
 * Status badge color classes
 * Light mode: lighter backgrounds with darker text
 * Dark mode: darker backgrounds with lighter text (better contrast)
 */
export const STATUS_COLORS: Record<SputnikProposalStatus, string> = {
  InProgress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100",
  Approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100",
  Rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100",
  Removed: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-100",
  Expired: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-100",
  Moved: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-100",
  Failed: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-100",
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: SputnikProposalStatus): string {
  return STATUS_COLORS[status] ?? STATUS_COLORS.Removed
}

/**
 * Format proposal bond from yoctoNEAR string to NEAR display
 */
export function formatProposalBond(bondYocto: string): string {
  const bondNear = Number(BigInt(bondYocto) / BigInt(1e21)) / 1000
  return `${bondNear} NEAR`
}
