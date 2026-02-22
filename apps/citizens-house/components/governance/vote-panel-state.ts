import type { ProposalView, VoteChoice } from "@/lib/schemas/governance-contract"

export type VotePanelState =
  | { kind: "vote_processing"; choice: VoteChoice }
  | { kind: "proposal_not_started_pending" }
  | { kind: "proposal_not_started_scheduled"; startAt: number }
  | { kind: "proposal_ended_loading" }
  | { kind: "proposal_ended_with_vote"; choice: VoteChoice }
  | { kind: "proposal_ended_without_vote" }
  | { kind: "wallet_not_connected" }
  | { kind: "eligibility_loading" }
  | { kind: "already_voted"; choice: VoteChoice }
  | { kind: "ineligible_blocklisted" }
  | { kind: "ineligible_unverified" }
  | { kind: "ineligible_verified_after_snapshot" }
  | { kind: "eligible_can_vote" }

interface DeriveVotePanelStateInput {
  proposal: ProposalView
  now: number
  isConnected: boolean
  checking: boolean
  optimisticPendingChoice: VoteChoice | null
  confirmedChoice: VoteChoice | null
  isBlocklisted: boolean
  isVerified: boolean
  isVerifiedAfterProposalCreation: boolean
}

export function deriveVotePanelState(input: DeriveVotePanelStateInput): VotePanelState {
  // Show in-flight vote processing immediately.
  if (input.optimisticPendingChoice) {
    return { kind: "vote_processing", choice: input.optimisticPendingChoice }
  }

  // Proposal lifecycle takes precedence over wallet-specific states.
  if (input.proposal.status === "pending") {
    return { kind: "proposal_not_started_pending" }
  }

  if (input.proposal.status === "active" && input.proposal.startAt > input.now) {
    return { kind: "proposal_not_started_scheduled", startAt: input.proposal.startAt }
  }

  const isProposalEnded = input.proposal.status !== "active" || input.proposal.endsAt <= input.now
  if (isProposalEnded) {
    if (input.checking) return { kind: "proposal_ended_loading" }
    if (input.confirmedChoice) {
      return { kind: "proposal_ended_with_vote", choice: input.confirmedChoice }
    }
    return { kind: "proposal_ended_without_vote" }
  }

  if (!input.isConnected) {
    return { kind: "wallet_not_connected" }
  }

  if (input.checking) {
    return { kind: "eligibility_loading" }
  }

  if (input.confirmedChoice) {
    return { kind: "already_voted", choice: input.confirmedChoice }
  }

  if (input.isBlocklisted) {
    return { kind: "ineligible_blocklisted" }
  }

  if (!input.isVerified) {
    return { kind: "ineligible_unverified" }
  }

  if (input.isVerifiedAfterProposalCreation) {
    return { kind: "ineligible_verified_after_snapshot" }
  }

  return { kind: "eligible_can_vote" }
}
