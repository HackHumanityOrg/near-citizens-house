import { relayErrorResponseSchema, relayResponseSchema } from "../../lib/schemas/governance-contract"
import { parseGovernanceVoteOutcome } from "../../lib/contracts/governance/vote-outcome"

export interface ClassifiedRelayResult {
  status: "voted" | "already_voted" | "skipped_unverified" | "failed"
  relayTxHash: string | null
  relayReason: string | null
  error: string | null
}

function includesAlreadyVotedMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes("already voted") || lower.includes("err_already_voted")
}

export function classifyRelayResponse(httpStatus: number, body: unknown): ClassifiedRelayResult {
  if (httpStatus >= 200 && httpStatus < 300) {
    const parsed = relayResponseSchema.safeParse(body)
    if (!parsed.success) {
      return {
        status: "failed",
        relayTxHash: null,
        relayReason: null,
        error: "Relay returned success but response shape was invalid",
      }
    }

    const txHash = parsed.data.txHash
    const outcome = parseGovernanceVoteOutcome(parsed.data.outcome)
    if (!outcome || outcome.kind === "vote_cast" || outcome.kind === "unknown") {
      return { status: "voted", relayTxHash: txHash, relayReason: null, error: null }
    }

    if (outcome.kind === "vote_rejected") {
      if (outcome.reason === "not_verified") {
        return {
          status: "skipped_unverified",
          relayTxHash: txHash,
          relayReason: outcome.reason,
          error: "Vote rejected: not verified",
        }
      }

      return {
        status: "failed",
        relayTxHash: txHash,
        relayReason: outcome.reason,
        error: `Vote rejected: ${outcome.reason}`,
      }
    }

    return {
      status: "failed",
      relayTxHash: txHash,
      relayReason: null,
      error: outcome.error,
    }
  }

  const parsedError = relayErrorResponseSchema.safeParse(body)
  const message = parsedError.success ? parsedError.data.error : `Relay request failed with HTTP ${httpStatus}`
  const reason = parsedError.success ? (parsedError.data.reason ?? null) : null

  if (reason === "not_verified") {
    return {
      status: "skipped_unverified",
      relayTxHash: null,
      relayReason: reason,
      error: message,
    }
  }

  if (includesAlreadyVotedMessage(message)) {
    return {
      status: "already_voted",
      relayTxHash: null,
      relayReason: reason,
      error: null,
    }
  }

  return {
    status: "failed",
    relayTxHash: null,
    relayReason: reason,
    error: message,
  }
}
