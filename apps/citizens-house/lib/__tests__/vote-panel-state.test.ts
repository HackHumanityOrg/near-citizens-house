import { describe, expect, it } from "vitest"
import type { ProposalView, VoteChoice } from "../schemas/governance-contract"
import { deriveVotePanelState } from "../../components/governance/vote-panel-state"

const BASE_PROPOSAL: ProposalView = {
  id: 1,
  creator: "creator.testnet",
  title: "Test proposal",
  author: "Author",
  description: "Description",
  createdAt: 1_000,
  startAt: 2_000,
  endsAt: 5_000,
  pendingExpiresAt: 1_500,
  status: "active",
  failureKind: null,
  quorumBps: 1_000,
  snapshotVerifiedCount: 100,
  pendingVoteCount: 0,
  yesVotes: 3,
  noVotes: 1,
}

function makeProposal(overrides: Partial<ProposalView> = {}): ProposalView {
  return { ...BASE_PROPOSAL, ...overrides }
}

function resolveState(
  overrides: {
    proposal?: ProposalView
    now?: number
    isConnected?: boolean
    checking?: boolean
    optimisticPendingChoice?: VoteChoice | null
    confirmedChoice?: VoteChoice | null
    isBlocklisted?: boolean
    isVerified?: boolean
    isVerifiedAfterProposalCreation?: boolean
  } = {},
) {
  return deriveVotePanelState({
    proposal: overrides.proposal ?? makeProposal(),
    now: overrides.now ?? 3_000,
    isConnected: overrides.isConnected ?? true,
    checking: overrides.checking ?? false,
    optimisticPendingChoice: overrides.optimisticPendingChoice ?? null,
    confirmedChoice: overrides.confirmedChoice ?? null,
    isBlocklisted: overrides.isBlocklisted ?? false,
    isVerified: overrides.isVerified ?? true,
    isVerifiedAfterProposalCreation: overrides.isVerifiedAfterProposalCreation ?? false,
  })
}

describe("deriveVotePanelState", () => {
  it("prioritizes pending proposal state even when wallet is disconnected", () => {
    const state = resolveState({
      proposal: makeProposal({ status: "pending" }),
      isConnected: false,
    })
    expect(state.kind).toBe("proposal_not_started_pending")
  })

  it("shows scheduled state for active proposals that have not started", () => {
    const state = resolveState({
      proposal: makeProposal({ status: "active", startAt: 4_000 }),
      now: 3_000,
    })
    expect(state.kind).toBe("proposal_not_started_scheduled")
  })

  it("shows ended state before wallet connection prompt", () => {
    const state = resolveState({
      proposal: makeProposal({ status: "succeeded" }),
      isConnected: false,
    })
    expect(state.kind).toBe("proposal_ended_without_vote")
  })

  it("shows ended-with-vote when vote exists", () => {
    const state = resolveState({
      proposal: makeProposal({ status: "failed" }),
      confirmedChoice: "yes",
    })
    expect(state).toEqual({ kind: "proposal_ended_with_vote", choice: "yes" })
  })

  it("shows connect prompt for active proposal when wallet is disconnected", () => {
    const state = resolveState({ isConnected: false })
    expect(state.kind).toBe("wallet_not_connected")
  })

  it("shows loading state while eligibility is being checked", () => {
    const state = resolveState({ checking: true })
    expect(state.kind).toBe("eligibility_loading")
  })

  it("shows processing state when optimistic vote is pending", () => {
    const state = resolveState({ optimisticPendingChoice: "no" })
    expect(state).toEqual({ kind: "vote_processing", choice: "no" })
  })

  it("shows already-voted state on active proposals", () => {
    const state = resolveState({ confirmedChoice: "no" })
    expect(state).toEqual({ kind: "already_voted", choice: "no" })
  })

  it("shows blocklisted ineligible state", () => {
    const state = resolveState({ isBlocklisted: true })
    expect(state.kind).toBe("ineligible_blocklisted")
  })

  it("shows unverified ineligible state", () => {
    const state = resolveState({ isVerified: false })
    expect(state.kind).toBe("ineligible_unverified")
  })

  it("shows post-snapshot verification ineligible state", () => {
    const state = resolveState({ isVerifiedAfterProposalCreation: true })
    expect(state.kind).toBe("ineligible_verified_after_snapshot")
  })

  it("returns eligible state when all conditions pass", () => {
    const state = resolveState()
    expect(state.kind).toBe("eligible_can_vote")
  })

  it("keeps ended state loading while checking vote history", () => {
    const state = resolveState({
      proposal: makeProposal({ status: "succeeded" }),
      checking: true,
    })
    expect(state.kind).toBe("proposal_ended_loading")
  })
})
