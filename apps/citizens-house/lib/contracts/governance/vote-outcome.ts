import type { FinalExecutionOutcome } from "@near-js/types"

const EVENT_PREFIX = "EVENT_JSON:"
const GOVERNANCE_EVENT_STANDARD = "citizens-house-vote"

export const VOTE_REJECTION_REASONS = [
  "proposal_cancelled",
  "not_verified",
  "verified_after_creation",
  "proposal_expired",
  "callback_failed",
  "post_finalize",
] as const

export type VoteRejectionReason = (typeof VOTE_REJECTION_REASONS)[number]

export type GovernanceVoteOutcome =
  | {
      kind: "vote_cast"
      proposalId?: number
      voter?: string
      choice?: "yes" | "no"
    }
  | {
      kind: "vote_rejected"
      reason: VoteRejectionReason | "unknown"
      proposalId?: number
      voter?: string
    }
  | { kind: "tx_failed"; error: string }
  | { kind: "unknown" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isVoteRejectionReason(value: string): value is VoteRejectionReason {
  return (VOTE_REJECTION_REASONS as readonly string[]).includes(value)
}

function deepExtractErrorMessage(value: unknown): string | null {
  if (typeof value === "string") return value
  if (!isRecord(value)) return null

  for (const nested of Object.values(value)) {
    const found = deepExtractErrorMessage(nested)
    if (found) return found
  }

  return null
}

function parseGovernanceEventLog(log: string): { event: string; data: Record<string, unknown> | null } | null {
  const eventPrefixIndex = log.indexOf(EVENT_PREFIX)
  if (eventPrefixIndex < 0) return null

  const jsonPayload = log.slice(eventPrefixIndex + EVENT_PREFIX.length).trim()

  try {
    const parsed = JSON.parse(jsonPayload)
    if (!isRecord(parsed)) return null
    if (parsed.standard !== GOVERNANCE_EVENT_STANDARD) return null
    if (typeof parsed.event !== "string") return null

    const rawData = parsed.data
    if (Array.isArray(rawData)) {
      const first = rawData[0]
      return { event: parsed.event, data: isRecord(first) ? first : null }
    }

    return { event: parsed.event, data: isRecord(rawData) ? rawData : null }
  } catch {
    return null
  }
}

export function extractExecutionFailure(result: FinalExecutionOutcome): string | null {
  if (typeof result.status === "object" && "Failure" in result.status && result.status.Failure) {
    return deepExtractErrorMessage(result.status.Failure) ?? "Transaction execution failed"
  }

  for (const receipt of result.receipts_outcome) {
    const receiptStatus = receipt.outcome.status
    if (typeof receiptStatus === "object" && "Failure" in receiptStatus && receiptStatus.Failure) {
      return deepExtractErrorMessage(receiptStatus.Failure) ?? "Receipt execution failed"
    }
  }

  return null
}

export function resolveGovernanceVoteOutcome(result: FinalExecutionOutcome): GovernanceVoteOutcome {
  const executionFailure = extractExecutionFailure(result)
  if (executionFailure) {
    return { kind: "tx_failed", error: executionFailure }
  }

  let voteCast: GovernanceVoteOutcome | null = null
  let voteRejected: GovernanceVoteOutcome | null = null
  const logs: string[] = [
    ...result.transaction_outcome.outcome.logs,
    ...result.receipts_outcome.flatMap((receipt) => receipt.outcome.logs),
  ]

  for (const log of logs) {
    const parsedEvent = parseGovernanceEventLog(log)
    if (!parsedEvent) continue

    if (parsedEvent.event === "vote_cast") {
      const choice =
        parsedEvent.data?.choice === "yes" || parsedEvent.data?.choice === "no" ? parsedEvent.data.choice : undefined
      voteCast = {
        kind: "vote_cast",
        proposalId: typeof parsedEvent.data?.proposal_id === "number" ? parsedEvent.data.proposal_id : undefined,
        voter: typeof parsedEvent.data?.voter === "string" ? parsedEvent.data.voter : undefined,
        choice,
      }
      continue
    }

    if (parsedEvent.event === "vote_rejected") {
      const rawReason = typeof parsedEvent.data?.reason === "string" ? parsedEvent.data.reason : "unknown"
      voteRejected = {
        kind: "vote_rejected",
        reason: isVoteRejectionReason(rawReason) ? rawReason : "unknown",
        proposalId: typeof parsedEvent.data?.proposal_id === "number" ? parsedEvent.data.proposal_id : undefined,
        voter: typeof parsedEvent.data?.voter === "string" ? parsedEvent.data.voter : undefined,
      }
    }
  }

  if (voteRejected) return voteRejected
  if (voteCast) return voteCast

  return { kind: "unknown" }
}

export function parseGovernanceVoteOutcome(value: unknown): GovernanceVoteOutcome | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null

  if (value.kind === "vote_cast") {
    const choice = value.choice === "yes" || value.choice === "no" ? value.choice : undefined
    return {
      kind: "vote_cast",
      proposalId: typeof value.proposalId === "number" ? value.proposalId : undefined,
      voter: typeof value.voter === "string" ? value.voter : undefined,
      choice,
    }
  }

  if (value.kind === "vote_rejected") {
    const reason = typeof value.reason === "string" ? value.reason : "unknown"
    return {
      kind: "vote_rejected",
      reason: isVoteRejectionReason(reason) ? reason : "unknown",
      proposalId: typeof value.proposalId === "number" ? value.proposalId : undefined,
      voter: typeof value.voter === "string" ? value.voter : undefined,
    }
  }

  if (value.kind === "tx_failed") {
    if (typeof value.error !== "string") return null
    return { kind: "tx_failed", error: value.error }
  }

  if (value.kind === "unknown") {
    return { kind: "unknown" }
  }

  return null
}

const REJECTION_REASON_MESSAGES: Record<VoteRejectionReason | "unknown", string> = {
  proposal_cancelled: "Vote was rejected because the proposal was cancelled.",
  not_verified: "Vote was rejected because your account is not verified.",
  verified_after_creation: "Vote was rejected because this account was verified after the proposal was created.",
  proposal_expired: "Vote was rejected because voting has ended for this proposal.",
  callback_failed: "Vote could not be verified due to a callback error. Please try again.",
  post_finalize: "Vote was rejected because the proposal is already finalized.",
  unknown: "Vote was rejected for an unknown reason.",
}

export function getVoteRejectionReasonMessage(reason: VoteRejectionReason | "unknown"): string {
  return REJECTION_REASON_MESSAGES[reason] ?? REJECTION_REASON_MESSAGES.unknown
}

const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  ERR_PROPOSAL_NOT_FOUND: "Proposal not found.",
  ERR_PROPOSAL_NOT_ACTIVE: "Proposal is not active.",
  ERR_PROPOSAL_NOT_STARTED: "Voting has not started yet.",
  ERR_PROPOSAL_ENDED: "Voting has already ended.",
  ERR_BLOCKLISTED: "Your account is blocklisted and cannot vote.",
  ERR_ALREADY_VOTED: "You already voted on this proposal.",
  ERR_VOTE_ALREADY_PENDING: "You already have a pending vote. Please wait for completion.",
  ERR_INSUFFICIENT_DEPOSIT: "A storage deposit is required to vote right now.",
  ERR_INSUFFICIENT_PREPAID_GAS: "Not enough gas was attached to execute this vote.",
}

export function getTransactionFailureMessage(error: string): string {
  const matchedCode = error.match(/\bERR_[A-Z_]+\b/)?.[0]
  if (matchedCode && CONTRACT_ERROR_MESSAGES[matchedCode]) {
    return CONTRACT_ERROR_MESSAGES[matchedCode]
  }

  const normalized = error.replace(/^Transaction failed:\s*/i, "").replace(/^Smart contract panicked:\s*/i, "")
  return normalized || "Transaction failed."
}
