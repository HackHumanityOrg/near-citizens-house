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

const TIMES = {
  preStart: 1_500,
  atStart: 2_000,
  during: 2_500,
  atEnd: 4_000,
  postEnd: 4_500,
} as const

function makeProposal(overrides: Partial<ProposalView> = {}): ProposalView {
  return { ...BASE_PROPOSAL, ...overrides }
}

function getStep(model: ReturnType<typeof deriveProposalTimelineModel>, key: ProposalViewStepKey) {
  const step = model.steps.find((candidate) => candidate.key === key)
  expect(step, `expected step ${key}`).toBeDefined()
  return step!
}

type ProposalViewStepKey = "created" | "voting_start" | "viewer_vote" | "voting_in_progress" | "voting_end"

function expectTitle(actual: string, expected: string | RegExp) {
  if (expected instanceof RegExp) {
    expect(actual).toMatch(expected)
    return
  }
  expect(actual).toBe(expected)
}

describe("deriveProposalTimelineModel lifecycle coverage (contract-aligned)", () => {
  const lifecycleScenarios: Array<{
    name: string
    proposal: Partial<ProposalView>
    now: number
    keys: ProposalViewStepKey[]
    startState: "completed" | "current" | "upcoming"
    startTitle: string | RegExp
    endState: "completed" | "current" | "upcoming"
    endTitle: string | RegExp
    hasInProgress: boolean
  }> = [
    {
      name: "created -> pending before start",
      proposal: { status: "pending", snapshotVerifiedCount: 0, failureKind: null },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "current",
      startTitle: /^Voting will start in /,
      endState: "upcoming",
      endTitle: "Voting will end",
      hasInProgress: false,
    },
    {
      name: "pending callback delay during scheduled voting window",
      proposal: { status: "pending", snapshotVerifiedCount: 0, failureKind: null },
      now: TIMES.during,
      keys: ["created", "voting_start", "voting_end"],
      startState: "current",
      startTitle: "Voting starts",
      endState: "upcoming",
      endTitle: "Voting will end",
      hasInProgress: false,
    },
    {
      name: "pending callback delay after scheduled end",
      proposal: { status: "pending", snapshotVerifiedCount: 0, failureKind: null },
      now: TIMES.postEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "current",
      startTitle: "Voting starts",
      endState: "upcoming",
      endTitle: "Voting will end",
      hasInProgress: false,
    },
    {
      name: "pending -> active before start (scheduled)",
      proposal: { status: "active", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "current",
      startTitle: /^Voting will start in /,
      endState: "upcoming",
      endTitle: "Voting will end",
      hasInProgress: false,
    },
    {
      name: "pending -> active at start boundary",
      proposal: { status: "active", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.atStart,
      keys: ["created", "voting_start", "voting_in_progress", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "upcoming",
      endTitle: /^Voting will end in /,
      hasInProgress: true,
    },
    {
      name: "active during voting",
      proposal: { status: "active", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.during,
      keys: ["created", "voting_start", "voting_in_progress", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "upcoming",
      endTitle: /^Voting will end in /,
      hasInProgress: true,
    },
    {
      name: "active at end boundary",
      proposal: { status: "active", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.atEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active after end before finalize",
      proposal: { status: "active", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.postEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active -> succeeded after finalize",
      proposal: { status: "succeeded", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.postEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active -> failed (quorum_not_met) after finalize",
      proposal: { status: "failed", failureKind: "quorum_not_met", snapshotVerifiedCount: 100 },
      now: TIMES.postEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active -> failed (rejected) after finalize",
      proposal: { status: "failed", failureKind: "rejected", snapshotVerifiedCount: 100 },
      now: TIMES.postEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "pending -> failed (snapshot_callback_failed) before start",
      proposal: { status: "failed", failureKind: "snapshot_callback_failed", snapshotVerifiedCount: 0 },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "pending -> failed (zero_snapshot) before start",
      proposal: { status: "failed", failureKind: "zero_snapshot", snapshotVerifiedCount: 0 },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "pending -> failed (pending_expired) before start",
      proposal: { status: "failed", failureKind: "pending_expired", snapshotVerifiedCount: 0 },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "pending -> failed (pending_expired) after scheduled start",
      proposal: { status: "failed", failureKind: "pending_expired", snapshotVerifiedCount: 0 },
      now: TIMES.during,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "pending -> cancelled before start",
      proposal: { status: "cancelled", snapshotVerifiedCount: 0, failureKind: null },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "pending -> cancelled after scheduled start",
      proposal: { status: "cancelled", snapshotVerifiedCount: 0, failureKind: null },
      now: TIMES.during,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active (scheduled) -> cancelled before start",
      proposal: { status: "cancelled", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.preStart,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting did not start",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active (in-window) -> cancelled",
      proposal: { status: "cancelled", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.during,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
    {
      name: "active (post-end) -> cancelled",
      proposal: { status: "cancelled", snapshotVerifiedCount: 100, failureKind: null },
      now: TIMES.postEnd,
      keys: ["created", "voting_start", "voting_end"],
      startState: "completed",
      startTitle: "Voting started",
      endState: "completed",
      endTitle: "Voting ended",
      hasInProgress: false,
    },
  ]

  for (const scenario of lifecycleScenarios) {
    it(scenario.name, () => {
      const model = deriveProposalTimelineModel(makeProposal(scenario.proposal), scenario.now)
      expect(model.steps.map((step) => step.key)).toEqual(scenario.keys)

      const start = getStep(model, "voting_start")
      expect(start.state).toBe(scenario.startState)
      expectTitle(start.title, scenario.startTitle)

      const end = getStep(model, "voting_end")
      expect(end.state).toBe(scenario.endState)
      expectTitle(end.title, scenario.endTitle)

      if (scenario.hasInProgress) {
        const inProgress = getStep(model, "voting_in_progress")
        expect(inProgress.state).toBe("current")
        expect(inProgress.title).toBe("Voting is in progress")
      } else {
        expect(model.steps.some((step) => step.key === "voting_in_progress")).toBe(false)
      }
    })
  }
})

describe("deriveProposalTimelineModel title modes", () => {
  it("supports static tense labels when countdown text is disabled", () => {
    const beforeStart = deriveProposalTimelineModel(makeProposal({ status: "active" }), TIMES.preStart, null, {
      includeRelativeCountdownInTitles: false,
    })
    expect(getStep(beforeStart, "voting_start").title).toBe("Voting starts")
    expect(getStep(beforeStart, "voting_end").title).toBe("Voting will end")

    const duringVoting = deriveProposalTimelineModel(makeProposal({ status: "active" }), TIMES.during, null, {
      includeRelativeCountdownInTitles: false,
    })
    expect(getStep(duringVoting, "voting_end").title).toBe("Voting will end")
  })
})

describe("deriveProposalTimelineModel viewer vote insertion", () => {
  it("suppresses viewer vote steps for pending proposals", () => {
    const model = deriveProposalTimelineModel(
      makeProposal({ status: "pending", snapshotVerifiedCount: 0 }),
      TIMES.during,
      { votedAt: 2_300 },
    )
    expect(model.steps.map((step) => step.key)).toEqual(["created", "voting_start", "voting_end"])
  })

  it("inserts a vote before start when cast before voting window opens", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), TIMES.during, { votedAt: 1_500 })
    expect(model.steps.map((step) => step.key)).toEqual([
      "created",
      "viewer_vote",
      "voting_start",
      "voting_in_progress",
      "voting_end",
    ])
  })

  it("inserts a vote at start directly after voting_start", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), TIMES.during, { votedAt: 2_000 })
    expect(model.steps.map((step) => step.key)).toEqual([
      "created",
      "voting_start",
      "viewer_vote",
      "voting_in_progress",
      "voting_end",
    ])
  })

  it("inserts a vote during active voting before in_progress marker", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "active" }), TIMES.during, { votedAt: 2_300 })
    expect(model.steps.map((step) => step.key)).toEqual([
      "created",
      "voting_start",
      "viewer_vote",
      "voting_in_progress",
      "voting_end",
    ])
  })

  it("inserts a vote for succeeded proposals after voting completion", () => {
    const model = deriveProposalTimelineModel(makeProposal({ status: "succeeded" }), TIMES.postEnd, { votedAt: 4_200 })
    expect(model.steps.map((step) => step.key)).toEqual(["created", "voting_start", "viewer_vote", "voting_end"])
    expect(getStep(model, "viewer_vote").title).toBe("You voted")
  })

  it("inserts a vote for failed proposals finalized from active", () => {
    const model = deriveProposalTimelineModel(
      makeProposal({ status: "failed", failureKind: "quorum_not_met", snapshotVerifiedCount: 100 }),
      TIMES.postEnd,
      { votedAt: 2_300 },
    )
    expect(model.steps.map((step) => step.key)).toEqual(["created", "voting_start", "viewer_vote", "voting_end"])
  })

  it("inserts a vote for cancelled proposals that were active", () => {
    const model = deriveProposalTimelineModel(
      makeProposal({ status: "cancelled", snapshotVerifiedCount: 100 }),
      TIMES.postEnd,
      { votedAt: 2_300 },
    )
    expect(model.steps.map((step) => step.key)).toEqual(["created", "voting_start", "viewer_vote", "voting_end"])
  })
})
