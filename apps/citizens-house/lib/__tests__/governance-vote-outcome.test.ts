import { describe, expect, it } from "vitest"
import type { FinalExecutionOutcome } from "@near-js/types"
import {
  VOTE_REJECTION_REASONS,
  parseGovernanceVoteOutcome,
  resolveGovernanceVoteOutcome,
} from "../contracts/governance/vote-outcome"

function governanceEventLog(event: string, data: Record<string, unknown>): string {
  return `EVENT_JSON:${JSON.stringify({
    standard: "citizens-house-vote",
    version: "1.0.0",
    event,
    data,
  })}`
}

function mockOutcome(params: {
  txLogs?: string[]
  receiptLogs?: string[]
  topLevelFailure?: string
  receiptFailure?: string
}): FinalExecutionOutcome {
  const topLevelFailure = params.topLevelFailure
  const receiptFailure = params.receiptFailure

  return {
    status: topLevelFailure
      ? {
          Failure: {
            ActionError: {
              kind: {
                FunctionCallError: {
                  ExecutionError: topLevelFailure,
                },
              },
            },
          },
        }
      : { SuccessValue: "" },
    transaction_outcome: {
      id: "tx-id",
      outcome: {
        logs: params.txLogs ?? [],
        status: { SuccessValue: "" },
      },
    },
    receipts_outcome: [
      {
        id: "receipt-id",
        outcome: {
          logs: params.receiptLogs ?? [],
          status: receiptFailure
            ? {
                Failure: {
                  ActionError: {
                    kind: {
                      FunctionCallError: {
                        ExecutionError: receiptFailure,
                      },
                    },
                  },
                },
              }
            : { SuccessValue: "" },
        },
      },
    ],
  } as unknown as FinalExecutionOutcome
}

describe("resolveGovernanceVoteOutcome", () => {
  it("parses vote_cast from receipt logs", () => {
    const outcome = resolveGovernanceVoteOutcome(
      mockOutcome({
        receiptLogs: [
          governanceEventLog("vote_cast", {
            proposal_id: 7,
            voter: "alice.near",
            choice: "yes",
          }),
        ],
      }),
    )

    expect(outcome).toEqual({
      kind: "vote_cast",
      proposalId: 7,
      voter: "alice.near",
      choice: "yes",
    })
  })

  it("parses all vote_rejected reasons", () => {
    for (const reason of VOTE_REJECTION_REASONS) {
      const outcome = resolveGovernanceVoteOutcome(
        mockOutcome({
          receiptLogs: [
            governanceEventLog("vote_rejected", {
              proposal_id: 9,
              voter: "bob.near",
              reason,
            }),
          ],
        }),
      )

      expect(outcome).toEqual({
        kind: "vote_rejected",
        proposalId: 9,
        voter: "bob.near",
        reason,
      })
    }
  })

  it("prefers vote_rejected when both vote events exist", () => {
    const outcome = resolveGovernanceVoteOutcome(
      mockOutcome({
        receiptLogs: [
          governanceEventLog("vote_cast", {
            proposal_id: 1,
            voter: "charlie.near",
            choice: "yes",
          }),
          governanceEventLog("vote_rejected", {
            proposal_id: 1,
            voter: "charlie.near",
            reason: "callback_failed",
          }),
        ],
      }),
    )

    expect(outcome).toEqual({
      kind: "vote_rejected",
      proposalId: 1,
      voter: "charlie.near",
      reason: "callback_failed",
    })
  })

  it("returns tx_failed when execution fails", () => {
    const outcome = resolveGovernanceVoteOutcome(
      mockOutcome({
        receiptFailure: "Smart contract panicked: ERR_PROPOSAL_ENDED",
      }),
    )

    expect(outcome).toEqual({
      kind: "tx_failed",
      error: "Smart contract panicked: ERR_PROPOSAL_ENDED",
    })
  })
})

describe("parseGovernanceVoteOutcome", () => {
  it("normalizes unknown rejection reasons", () => {
    const parsed = parseGovernanceVoteOutcome({
      kind: "vote_rejected",
      reason: "new_reason_from_future_contract",
      proposalId: 42,
    })

    expect(parsed).toEqual({
      kind: "vote_rejected",
      reason: "unknown",
      proposalId: 42,
      voter: undefined,
    })
  })
})
