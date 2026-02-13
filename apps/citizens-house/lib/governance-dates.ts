const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "UTC",
})

export function formatUtcDate(timestampMs: number): string {
  return utcDateFormatter.format(new Date(timestampMs))
}

export function formatUtcDateTime(timestampMs: number): string {
  return `${utcDateTimeFormatter.format(new Date(timestampMs))} UTC`
}

export function parseDatetimeLocalToEpochMs(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!match) return null

  const year = Number.parseInt(match[1], 10)
  const monthIndex = Number.parseInt(match[2], 10) - 1
  const day = Number.parseInt(match[3], 10)
  const hour = Number.parseInt(match[4], 10)
  const minute = Number.parseInt(match[5], 10)

  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null
  }

  const ms = Date.UTC(year, monthIndex, day, hour, minute, 0, 0)
  const parsed = new Date(ms)

  // Guard against overflow dates (e.g. day 31 in short months)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute
  ) {
    return null
  }

  return ms
}

export function epochMsToNanoseconds(ms: number): string {
  return (BigInt(ms) * BigInt(1_000_000)).toString()
}
