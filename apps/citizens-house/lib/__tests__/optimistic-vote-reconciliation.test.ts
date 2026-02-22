import { describe, expect, it } from "vitest"
import type { VoteView } from "@/lib/schemas/governance-contract"
import type { OptimisticVote } from "@/components/governance/optimistic-vote"
import {
  doesServerTallyIncludeConfirmedVote,
  isOptimisticVotePresentInServerVotes,
  shouldApplyOptimisticAggregates,
} from "@/components/governance/optimistic-vote-reconciliation"

const PROPOSAL_ID = 42

function createVoteView(overrides?: Partial<VoteView>): VoteView {
  return {
    proposalId: PROPOSAL_ID,
    voter: "alice.near",
    choice: "yes",
    votedAt: 1_700_000_000_000,
    ...overrides,
  }
}

function createOptimisticVote(overrides?: Partial<OptimisticVote>): OptimisticVote {
  return {
    proposalId: PROPOSAL_ID,
    voter: "alice.near",
    choice: "yes",
    votedAt: 1_700_000_000_100,
    status: "confirmed",
    ...overrides,
  }
}

describe("optimistic vote reconciliation", () => {
  it("keeps optimistic aggregates while refreshed server data has not caught up", () => {
    const optimisticVote = createOptimisticVote()
    const initialVotes: VoteView[] = []
    const baseline = { yesVotes: 10, noVotes: 4 }
    const proposal = { yesVotes: 10, noVotes: 4 }

    expect(shouldApplyOptimisticAggregates(optimisticVote, initialVotes, baseline, proposal)).toBe(true)
  })

  it("stops optimistic aggregates when vote appears in server votes list", () => {
    const optimisticVote = createOptimisticVote()
    const initialVotes: VoteView[] = [createVoteView()]
    const baseline = { yesVotes: 10, noVotes: 4 }
    const proposal = { yesVotes: 10, noVotes: 4 }

    expect(isOptimisticVotePresentInServerVotes(optimisticVote, initialVotes)).toBe(true)
    expect(shouldApplyOptimisticAggregates(optimisticVote, initialVotes, baseline, proposal)).toBe(false)
  })

  it("stops optimistic aggregates when server tallies include the confirmed vote", () => {
    const optimisticVote = createOptimisticVote({ choice: "yes" })
    const initialVotes: VoteView[] = []
    const baseline = { yesVotes: 10, noVotes: 4 }
    const proposal = { yesVotes: 11, noVotes: 4 }

    expect(doesServerTallyIncludeConfirmedVote(optimisticVote, baseline, proposal)).toBe(true)
    expect(shouldApplyOptimisticAggregates(optimisticVote, initialVotes, baseline, proposal)).toBe(false)
  })

  it("uses no-vote tallies for confirmed no votes", () => {
    const optimisticVote = createOptimisticVote({ choice: "no" })
    const baseline = { yesVotes: 10, noVotes: 4 }

    expect(
      doesServerTallyIncludeConfirmedVote(optimisticVote, baseline, {
        yesVotes: 10,
        noVotes: 5,
      }),
    ).toBe(true)
  })
})
