import { describe, it, expect } from "vitest"
import {
  castVoteArgsSchema,
  MAX_SIGNED_DELEGATE_BASE64_LENGTH,
  relayRequestSchema,
} from "../schemas/governance-contract"

describe("relayRequestSchema", () => {
  it("accepts valid base64 payload within limit", () => {
    const payload = Buffer.from("valid signed delegate payload").toString("base64")
    const result = relayRequestSchema.safeParse({ signedDelegate: payload })
    expect(result.success).toBe(true)
  })

  it("rejects non-base64 payload", () => {
    const result = relayRequestSchema.safeParse({ signedDelegate: "not@base64" })
    expect(result.success).toBe(false)
  })

  it("rejects payload above max base64 length", () => {
    const tooLong = "A".repeat(MAX_SIGNED_DELEGATE_BASE64_LENGTH + 1)
    const result = relayRequestSchema.safeParse({ signedDelegate: tooLong })
    expect(result.success).toBe(false)
  })
})

describe("castVoteArgsSchema", () => {
  it("accepts valid cast_vote arguments", () => {
    const result = castVoteArgsSchema.safeParse({ proposal_id: 42, choice: "yes" })
    expect(result.success).toBe(true)
  })

  it("rejects negative proposal IDs", () => {
    const result = castVoteArgsSchema.safeParse({ proposal_id: -1, choice: "no" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid vote choices", () => {
    const result = castVoteArgsSchema.safeParse({ proposal_id: 7, choice: "maybe" })
    expect(result.success).toBe(false)
  })
})
