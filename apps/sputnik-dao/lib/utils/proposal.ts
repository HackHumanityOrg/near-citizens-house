/**
 * Extract the title from a proposal description (markdown).
 * Uses the first heading (any level: #, ##, ###, etc.) if present.
 * Falls back to first paragraph if no heading found.
 * Truncates to maxLength if needed.
 */
export function extractProposalTitle(description: string, maxLength: number = 100): string {
  if (!description) return "Vote Proposal"

  // Look for first markdown heading (any level)
  const headingMatch = description.match(/^#{1,6}\s+(.+)$/m)
  if (headingMatch) {
    const title = headingMatch[1].trim()
    if (title) {
      if (title.length <= maxLength) return title
      return title.slice(0, maxLength) + "..."
    }
  }

  // Fallback: use first non-empty line
  const firstLine = description
    .split("\n")
    .find((line) => line.trim())
    ?.trim()
  if (!firstLine) return "Vote Proposal"

  if (firstLine.length <= maxLength) return firstLine
  return firstLine.slice(0, maxLength) + "..."
}
