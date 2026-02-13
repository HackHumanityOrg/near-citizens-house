import { describe, expect, it } from "vitest"
import {
  epochMsToNanoseconds,
  formatUtcDate,
  formatUtcDateTime,
  parseDatetimeLocalToEpochMs,
} from "../governance-dates"

describe("governance date utilities", () => {
  it("formats UTC date and datetime without local timezone drift", () => {
    const timestampMs = Date.UTC(2026, 1, 13, 12, 0, 0)

    expect(formatUtcDate(timestampMs)).toBe("Feb 13, 2026")
    expect(formatUtcDateTime(timestampMs)).toBe("Feb 13, 2026, 12:00 PM UTC")
  })

  it("parses datetime-local values and converts to nanoseconds", () => {
    const parsed = parseDatetimeLocalToEpochMs("2026-02-13T12:00")
    const expectedMs = Date.UTC(2026, 1, 13, 12, 0, 0)

    expect(parsed).toBe(expectedMs)
    expect(epochMsToNanoseconds(parsed!)).toBe((BigInt(expectedMs) * BigInt(1_000_000)).toString())
  })

  it("returns null for invalid datetime-local input", () => {
    expect(parseDatetimeLocalToEpochMs("not-a-date")).toBeNull()
  })
})
