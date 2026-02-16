import { describe, expect, it } from "vitest"
import { classifyRelayResponse } from "../../scripts/helpers/relay-vote-utils"

describe("relay vote response classification", () => {
  it("classifies successful vote outcomes", () => {
    const result = classifyRelayResponse(200, {
      success: true,
      txHash: "ABC123",
      outcome: { kind: "vote_cast", proposalId: 1, voter: "alice.near", choice: "yes" },
    })

    expect(result.status).toBe("voted")
    expect(result.relayTxHash).toBe("ABC123")
  })

  it("classifies not_verified relay errors", () => {
    const result = classifyRelayResponse(403, {
      error: "Only verified accounts can use gasless voting",
      reason: "not_verified",
    })

    expect(result.status).toBe("skipped_unverified")
    expect(result.relayReason).toBe("not_verified")
  })

  it("classifies already-voted errors", () => {
    const result = classifyRelayResponse(422, {
      error: "Smart contract panicked: ERR_ALREADY_VOTED",
    })

    expect(result.status).toBe("already_voted")
    expect(result.error).toBeNull()
  })

  it("fails malformed success payloads", () => {
    const result = classifyRelayResponse(200, {
      success: true,
      txHash: 123,
    })

    expect(result.status).toBe("failed")
  })
})
