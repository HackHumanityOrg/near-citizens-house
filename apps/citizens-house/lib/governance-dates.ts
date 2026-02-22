const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const

export function formatUtcDate(timestampMs: number): string {
  const date = new Date(timestampMs)
  const month = MONTHS_SHORT[date.getUTCMonth()]
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  return `${month} ${day}, ${year}`
}

export function formatUtcDateTime(timestampMs: number): string {
  const date = new Date(timestampMs)
  const baseDate = formatUtcDate(timestampMs)
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${baseDate}, ${hour12}:${minutes} ${ampm} UTC`
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
