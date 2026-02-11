/**
 * Governance Contract Schemas - NEAR smart contract I/O types with snake_case -> camelCase transforms.
 *
 * Handles the boundary between TypeScript (camelCase) and the NEAR governance contract (snake_case):
 * - Timestamps use U64 (JSON string of nanoseconds) -> converted to milliseconds
 * - NearToken serializes as JSON string of yoctoNEAR
 * - Enums use snake_case (matching contract's #[serde(rename_all = "snake_case")])
 * - Plain u16/u32/u64 fields serialize as JSON numbers
 */
import { z } from "zod"

// =============================================================================
// Helpers
// =============================================================================

/** Parse U64 nanosecond timestamp string to milliseconds number */
const u64TimestampSchema = z.string().transform((val) => {
  const ns = BigInt(val)
  return Number(ns / BigInt(1_000_000))
})

/** NearToken: keep as yoctoNEAR string */
const nearTokenSchema = z.string()

// =============================================================================
// Enums
// =============================================================================

export const proposalStatusSchema = z.enum(["pending", "active", "succeeded", "failed", "cancelled"])
export type ProposalStatus = z.infer<typeof proposalStatusSchema>

export const failureKindSchema = z.enum([
  "quorum_not_met",
  "rejected",
  "pending_expired",
  "zero_snapshot",
  "snapshot_callback_failed",
])
export type FailureKind = z.infer<typeof failureKindSchema>

export const voteChoiceSchema = z.enum(["yes", "no"])
export type VoteChoice = z.infer<typeof voteChoiceSchema>

const base64StringSchema = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, {
  message: "Must be valid base64",
})

// =============================================================================
// Contract Output Schemas (snake_case -> camelCase)
// =============================================================================

export const contractProposalViewSchema = z
  .object({
    id: z.number(),
    creator: z.string(),
    title: z.string(),
    author: z.string(),
    description: z.string(),
    created_at: u64TimestampSchema,
    start_at: u64TimestampSchema,
    ends_at: u64TimestampSchema,
    pending_expires_at: u64TimestampSchema,
    status: proposalStatusSchema,
    failure_kind: failureKindSchema.nullable(),
    quorum_bps: z.number(),
    snapshot_verified_count: z.number(),
    pending_vote_count: z.number(),
    yes_votes: z.number(),
    no_votes: z.number(),
  })
  .transform((d) => ({
    id: d.id,
    creator: d.creator,
    title: d.title,
    author: d.author,
    description: d.description,
    createdAt: d.created_at,
    startAt: d.start_at,
    endsAt: d.ends_at,
    pendingExpiresAt: d.pending_expires_at,
    status: d.status,
    failureKind: d.failure_kind,
    quorumBps: d.quorum_bps,
    snapshotVerifiedCount: d.snapshot_verified_count,
    pendingVoteCount: d.pending_vote_count,
    yesVotes: d.yes_votes,
    noVotes: d.no_votes,
  }))

export type ContractProposalView = z.input<typeof contractProposalViewSchema>
export type ProposalView = z.output<typeof contractProposalViewSchema>

export const contractVoteViewSchema = z
  .object({
    proposal_id: z.number(),
    voter: z.string(),
    choice: voteChoiceSchema,
    voted_at: u64TimestampSchema,
  })
  .transform((d) => ({
    proposalId: d.proposal_id,
    voter: d.voter,
    choice: d.choice,
    votedAt: d.voted_at,
  }))

export type ContractVoteView = z.input<typeof contractVoteViewSchema>
export type VoteView = z.output<typeof contractVoteViewSchema>

export const contractConfigSchema = z
  .object({
    verified_accounts_contract: z.string(),
    quorum_bps: z.number(),
    voting_period_secs: z.number(),
    pending_expiry_secs: z.number(),
    min_proposal_bond: nearTokenSchema,
    finalize_grace_period_secs: z.number(),
    max_start_delay_secs: z.number(),
  })
  .transform((d) => ({
    verifiedAccountsContract: d.verified_accounts_contract,
    quorumBps: d.quorum_bps,
    votingPeriodSecs: d.voting_period_secs,
    pendingExpirySecs: d.pending_expiry_secs,
    minProposalBond: d.min_proposal_bond,
    finalizeGracePeriodSecs: d.finalize_grace_period_secs,
    maxStartDelaySecs: d.max_start_delay_secs,
  }))

export type ContractConfig = z.input<typeof contractConfigSchema>
export type GovernanceConfig = z.output<typeof contractConfigSchema>

// =============================================================================
// Relay Schemas
// =============================================================================

export const MAX_SIGNED_DELEGATE_BYTES = 16 * 1024
export const MAX_SIGNED_DELEGATE_BASE64_LENGTH = Math.ceil(MAX_SIGNED_DELEGATE_BYTES / 3) * 4

export const relayRequestSchema = z.object({
  signedDelegate: base64StringSchema.min(1).max(MAX_SIGNED_DELEGATE_BASE64_LENGTH),
})

export type RelayRequest = z.infer<typeof relayRequestSchema>

export const relayResponseSchema = z.object({
  success: z.literal(true),
  txHash: z.string(),
})

export type RelayResponse = z.infer<typeof relayResponseSchema>

// =============================================================================
// Utility Functions
// =============================================================================

const YOCTO_PER_NEAR = BigInt("1000000000000000000000000")
const ZERO = BigInt(0)

/** Convert yoctoNEAR string to human-readable NEAR string */
export function yoctoToNear(yocto: string): string {
  const value = BigInt(yocto)
  const whole = value / YOCTO_PER_NEAR
  const remainder = value % YOCTO_PER_NEAR
  if (remainder === ZERO) return whole.toString()
  const decimals = remainder.toString().padStart(24, "0").replace(/0+$/, "")
  return `${whole}.${decimals}`
}

/** Convert human-readable NEAR string to yoctoNEAR string */
export function nearToYocto(near: string): string {
  const parts = near.split(".")
  const whole = parts[0] || "0"
  const frac = (parts[1] || "").padEnd(24, "0").slice(0, 24)
  const yocto = BigInt(whole) * YOCTO_PER_NEAR + BigInt(frac)
  return yocto.toString()
}
