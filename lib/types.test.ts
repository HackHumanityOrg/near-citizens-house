import { describe, it, expect } from "vitest"
import { verifyRequestSchema, zkProofSchema } from "./types"

describe("verifyRequestSchema", () => {
  const validProof = {
    a: ["123", "456"],
    b: [
      ["111", "222"],
      ["333", "444"],
    ],
    c: ["555", "666"],
  }

  const validRequest = {
    attestationId: "1",
    proof: validProof,
    publicSignals: ["signal1", "signal2"],
    userContextData: "hexdata123",
  }

  it("validates a correct request", () => {
    const result = verifyRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
  })

  it("accepts attestationId as string '1', '2', '3'", () => {
    for (const id of ["1", "2", "3"]) {
      const result = verifyRequestSchema.safeParse({ ...validRequest, attestationId: id })
      expect(result.success).toBe(true)
    }
  })

  it("accepts attestationId as number 1, 2, 3", () => {
    for (const id of [1, 2, 3]) {
      const result = verifyRequestSchema.safeParse({ ...validRequest, attestationId: id })
      expect(result.success).toBe(true)
    }
  })

  it("rejects invalid attestationId", () => {
    const result = verifyRequestSchema.safeParse({ ...validRequest, attestationId: "4" })
    expect(result.success).toBe(false)
  })

  it("rejects missing proof", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { proof: _proof, ...noProof } = validRequest
    const result = verifyRequestSchema.safeParse(noProof)
    expect(result.success).toBe(false)
  })

  it("rejects missing publicSignals", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { publicSignals: _publicSignals, ...noSignals } = validRequest
    const result = verifyRequestSchema.safeParse(noSignals)
    expect(result.success).toBe(false)
  })

  it("rejects missing userContextData", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userContextData: _userContextData, ...noContext } = validRequest
    const result = verifyRequestSchema.safeParse(noContext)
    expect(result.success).toBe(false)
  })
})

describe("zkProofSchema", () => {
  it("validates correct ZK proof structure", () => {
    const validProof = {
      a: ["123", "456"],
      b: [
        ["111", "222"],
        ["333", "444"],
      ],
      c: ["555", "666"],
    }
    const result = zkProofSchema.safeParse(validProof)
    expect(result.success).toBe(true)
  })

  it("rejects proof with wrong 'a' length", () => {
    const invalidProof = {
      a: ["123"], // Should be 2 elements
      b: [
        ["111", "222"],
        ["333", "444"],
      ],
      c: ["555", "666"],
    }
    const result = zkProofSchema.safeParse(invalidProof)
    expect(result.success).toBe(false)
  })

  it("rejects proof with wrong 'b' structure", () => {
    const invalidProof = {
      a: ["123", "456"],
      b: [["111", "222"]], // Should be 2x2
      c: ["555", "666"],
    }
    const result = zkProofSchema.safeParse(invalidProof)
    expect(result.success).toBe(false)
  })

  it("rejects proof with non-string values", () => {
    const invalidProof = {
      a: [123, 456], // Should be strings
      b: [
        ["111", "222"],
        ["333", "444"],
      ],
      c: ["555", "666"],
    }
    const result = zkProofSchema.safeParse(invalidProof)
    expect(result.success).toBe(false)
  })
})
