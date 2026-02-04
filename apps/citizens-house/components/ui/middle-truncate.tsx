"use client"

import { cn } from "./utils"

interface MiddleTruncateProps {
  text: string
  className?: string
}

/**
 * CSS-only middle truncation component.
 *
 * Uses the flexbox "sliding door" technique:
 * - First span: shrinks with ellipsis overflow
 * - Second span: fixed 6 characters, always visible
 *
 * Example: "very-long-account-name.near" → "very-long-ac….near"
 *
 * @see https://github.com/w3c/csswg-drafts/issues/3937
 */
export function MiddleTruncate({ text, className }: MiddleTruncateProps) {
  // Fixed suffix length of 6 characters (e.g., ".near" or "tnet" from ".testnet")
  const SUFFIX_LENGTH = 6

  // Handle copy event to prevent space being inserted between spans
  const handleCopy = (e: React.ClipboardEvent) => {
    e.preventDefault()
    e.clipboardData.setData("text/plain", text)
  }

  // If text is short enough, no need to split
  if (text.length <= SUFFIX_LENGTH + 3) {
    return (
      <span className={cn("whitespace-nowrap", className)} title={text}>
        {text}
      </span>
    )
  }

  const prefix = text.slice(0, -SUFFIX_LENGTH)
  const suffix = text.slice(-SUFFIX_LENGTH)

  return (
    <span className={cn("inline-flex min-w-0 max-w-full", className)} title={text} onCopy={handleCopy}>
      {/* Prefix: shrinks with ellipsis when space is limited */}
      <span className="shrink overflow-hidden text-ellipsis whitespace-nowrap">{prefix}</span>
      {/* Suffix: never shrinks, always visible */}
      <span className="shrink-0 whitespace-nowrap">{suffix}</span>
    </span>
  )
}
