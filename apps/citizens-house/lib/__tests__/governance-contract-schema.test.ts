import { describe, it, expect } from "vitest"
import { MAX_SIGNED_DELEGATE_BASE64_LENGTH, relayRequestSchema } from "../schemas/governance-contract"

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
