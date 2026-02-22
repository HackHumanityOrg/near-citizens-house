import { describe, expect, it } from "vitest"
import {
  utf8ByteLength,
  validateCreateProposalInput,
  firstCreateProposalValidationError,
} from "../governance-proposal-validation"

const ONE_NEAR_IN_YOCTO = "1000000000000000000000000"

function toUtcDatetimeLocal(ms: number): string {
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  const hour = String(date.getUTCHours()).padStart(2, "0")
  const minute = String(date.getUTCMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hour}:${minute}`
}

describe("governance proposal validation", () => {
  it("validates a scheduled proposal within contract limits", () => {
    const nowMs = Date.UTC(2026, 1, 13, 12, 0, 0)
    const startAt = toUtcDatetimeLocal(nowMs + 60 * 60 * 1000)

    const result = validateCreateProposalInput({
      title: "Launch Community Working Group",
      author: "Citizens Council",
      description: "This proposal creates a focused working group.",
      scheduled: true,
      startAt,
      bondNear: "1.5",
      minProposalBondYocto: ONE_NEAR_IN_YOCTO,
      maxStartDelaySecs: 90 * 24 * 60 * 60,
      nowMs,
    })

    expect(result.isValid).toBe(true)
    expect(result.normalized?.title).toBe("Launch Community Working Group")
    expect(result.normalized?.author).toBe("Citizens Council")
    expect(result.normalized?.description).toBe("This proposal creates a focused working group.")
    expect(result.normalized?.bondYocto).toBe("1500000000000000000000000")
    expect(result.normalized?.startAtNs).toBe("1770987600000000000")
  })

  it("uses UTF-8 byte limits like the contract", () => {
    const nowMs = Date.UTC(2026, 1, 13, 12, 0, 0)
    const title = "😀".repeat(36) // 144 bytes

    expect(utf8ByteLength(title)).toBe(144)

    const result = validateCreateProposalInput({
      title,
      author: "author",
      description: "description",
      scheduled: false,
      startAt: "",
      bondNear: "",
      minProposalBondYocto: ONE_NEAR_IN_YOCTO,
      maxStartDelaySecs: 90 * 24 * 60 * 60,
      nowMs,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.title).toBe("Title must be 140 bytes or less.")
  })

  it("rejects scheduled starts beyond max_start_delay_secs", () => {
    const nowMs = Date.UTC(2026, 1, 13, 12, 0, 0)
    const startAt = toUtcDatetimeLocal(nowMs + 2 * 60 * 60 * 1000)

    const result = validateCreateProposalInput({
      title: "title",
      author: "author",
      description: "description",
      scheduled: true,
      startAt,
      bondNear: "",
      minProposalBondYocto: ONE_NEAR_IN_YOCTO,
      maxStartDelaySecs: 60 * 60,
      nowMs,
    })

    expect(result.isValid).toBe(false)
    expect(result.errors.startAt).toContain("within 1 hour from now")
  })

  it("rejects malformed or insufficient bond values", () => {
    const nowMs = Date.UTC(2026, 1, 13, 12, 0, 0)

    const emptyBond = validateCreateProposalInput({
      title: "title",
      author: "author",
      description: "description",
      scheduled: false,
      startAt: "",
      bondNear: "",
      minProposalBondYocto: ONE_NEAR_IN_YOCTO,
      maxStartDelaySecs: 90 * 24 * 60 * 60,
      nowMs,
    })
    expect(emptyBond.isValid).toBe(false)
    expect(emptyBond.errors.bondNear).toBe("Bond is required (minimum 1 NEAR).")

    const invalidFormat = validateCreateProposalInput({
      title: "title",
      author: "author",
      description: "description",
      scheduled: false,
      startAt: "",
      bondNear: "1e-3",
      minProposalBondYocto: ONE_NEAR_IN_YOCTO,
      maxStartDelaySecs: 90 * 24 * 60 * 60,
      nowMs,
    })
    expect(invalidFormat.isValid).toBe(false)
    expect(invalidFormat.errors.bondNear).toBe("Bond must be a valid NEAR amount.")

    const belowMin = validateCreateProposalInput({
      title: "title",
      author: "author",
      description: "description",
      scheduled: false,
      startAt: "",
      bondNear: "0.5",
      minProposalBondYocto: ONE_NEAR_IN_YOCTO,
      maxStartDelaySecs: 90 * 24 * 60 * 60,
      nowMs,
    })
    expect(belowMin.isValid).toBe(false)
    expect(belowMin.errors.bondNear).toBe("Bond must be at least 1 NEAR.")
  })

  it("returns the first validation error in field order", () => {
    const error = firstCreateProposalValidationError({
      description: "Description is required.",
      title: "Title is required.",
      bondNear: "Bond is invalid.",
    })

    expect(error).toBe("Title is required.")
  })
})
