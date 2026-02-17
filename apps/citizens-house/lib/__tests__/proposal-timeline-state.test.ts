import { describe, expect, it } from "vitest"
import type { ProposalView } from "../schemas/governance-contract"
import { deriveProposalTimelineModel } from "../../components/governance/proposal-timeline-state"

const BASE_PROPOSAL: ProposalView = {
  id: 1,
  creator: "creator.testnet",
  title: "Timeline test",
  author: "Author",
  description: "Description",
  createdAt: 1_000,
  startAt: 2_000,
  endsAt: 4_000,
  pendingExpiresAt: 1_500,
  status: "active",
  failureKind: null,
  quorumBps: 1_000,
  snapshotVerifiedCount: 100,
  pendingVoteCount: 0,
  yesVotes: 1,
  noVotes: 0,
}

function makeProposal(overrides: Partial<ProposalView> = {}): ProposalView {
  return { ...BASE_PROPOSAL, ...overrides }
}

describe("deriveProposalTimelineModel", () => {
  it("returns expected step order", () => {
    const model = deriveProposalTimelineModel(makeProposal(), 2_500)
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "voting_in_progress", "voting_end"])
  })

  it("handles pending proposal before voting starts", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "pending" }), 1_500)
    expect(model.steps[1]?.state).toBe("current")
    expect(model.steps[2]?.state).toBe("upcoming")
    expect(model.countdown).toMatchObject({
      label: "Starts in",
      targetMs: 2_000,
      endedLabel: "Starting...",
    })
  })

  it("handles active proposal before start (scheduled)", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), 1_500)
    expect(model.steps[1]?.state).toBe("current")
    expect(model.steps[2]?.state).toBe("upcoming")
    expect(model.countdown?.label).toBe("Starts in")
  })

  it("handles active proposal during voting", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), 2_500)
    expect(model.steps[1]?.state).toBe("completed")
    expect(model.steps[2]).toMatchObject({
      title: "Voting in progress",
      state: "current",
      icon: "in_progress",
    })
    expect(model.steps[3]?.state).toBe("upcoming")
    expect(model.countdown).toMatchObject({
      label: "Ends in",
      targetMs: 4_000,
      endedLabel: "Voting ended",
    })
  })

  it("inserts a connected viewer vote chronologically during active voting", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), 2_500, { votedAt: 2_300 })
    expect(model.steps.map((s) => s.key)).toEqual([
      "created",
      "voting_start",
      "viewer_vote",
      "voting_in_progress",
      "voting_end",
    ])
    expect(model.steps[2]).toMatchObject({
      title: "You voted",
      timestampMs: 2_300,
      state: "completed",
      icon: "voted",
    })
  })

  it("inserts a vote at voting start directly after the start step", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), 2_500, { votedAt: 2_000 })
    expect(model.steps.map((s) => s.key)).toEqual([
      "created",
      "voting_start",
      "viewer_vote",
      "voting_in_progress",
      "voting_end",
    ])
  })

  it("suppresses viewer vote steps for pending proposals", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "pending" }), 1_500, { votedAt: 2_300 })
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "voting_end"])
  })

  it("handles active proposal after end with voting-end as final step", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), 4_500)
    expect(model.steps[1]?.state).toBe("completed")
    expect(model.steps[2]?.state).toBe("completed")
    expect(model.steps.at(-1)).toMatchObject({ key: "voting_end", title: "Voting ends", state: "completed" })
    expect(model.countdown).toBeNull()
  })

  it("keeps voting-end as final step for succeeded proposals", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "succeeded" }), 4_500)
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "voting_end"])
    expect(model.steps.at(-1)).toMatchObject({ key: "voting_end", state: "completed" })
  })

  it("places a vote after voting ends when vote timestamp is after end", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "succeeded" }), 4_500, { votedAt: 4_200 })
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "viewer_vote", "voting_end"])
  })

  it("places a vote at voting end before the end marker", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "succeeded" }), 4_500, { votedAt: 4_000 })
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "viewer_vote", "voting_end"])
  })

  it("keeps voting-end as final step for failed proposals", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "failed", failureKind: "quorum_not_met" }), 4_500)
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "voting_end"])
    expect(model.steps.at(-1)).toMatchObject({ key: "voting_end", state: "completed" })
  })

  it("keeps voting-end as final step for cancelled proposals", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "cancelled" }), 3_000)
    expect(model.steps.map((s) => s.key)).toEqual(["created", "voting_start", "voting_end"])
    expect(model.steps.at(-1)).toMatchObject({ key: "voting_end", state: "completed" })
  })

  it("does not show start countdown for closed proposals before start time", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "failed" }), 1_500)
    expect(model.countdown).toBeNull()
  })
})
