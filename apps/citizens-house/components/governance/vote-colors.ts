import type { VoteChoice } from "@/lib/schemas/governance-contract"

type VoteChoiceColorTokens = {
  text: string
  actionText: string
  badge: string
  button: string
  progressSegment: string
  legendChip: string
}

export const VOTE_CHOICE_COLOR_TOKENS: Record<VoteChoice, VoteChoiceColorTokens> = {
  yes: {
    text: "text-[#166534] dark:text-[#bbf7d0]",
    actionText: "text-[#22c55e] dark:text-[#4ade80]",
    badge: "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#bbf7d0]",
    button: "bg-[#22c55e] hover:bg-[#16a34a] text-white",
    progressSegment: "bg-[#22c55e]",
    legendChip: "bg-[#22c55e]",
  },
  no: {
    text: "text-[#991b1b] dark:text-[#fecaca]",
    actionText: "text-[#ef4444] dark:text-[#f87171]",
    badge: "bg-[#fecaca] text-[#991b1b] dark:bg-[#7f1d1d] dark:text-[#fecaca]",
    button: "bg-[#ef4444] hover:bg-[#dc2626] text-white",
    progressSegment: "bg-[#ef4444]",
    legendChip: "bg-[#ef4444]",
  },
}

export function formatVoteChoiceLabel(choice: VoteChoice): "Yes" | "No" {
  return choice === "yes" ? "Yes" : "No"
}

export const VOTE_POSITIVE_TEXT_CLASS = VOTE_CHOICE_COLOR_TOKENS.yes.actionText

export const VOTE_STATUS_COLOR_TOKENS = {
  active: VOTE_CHOICE_COLOR_TOKENS.yes.badge,
  succeeded: "bg-[#bbf7d0] text-[#14532d] dark:bg-[#166534] dark:text-[#dcfce7]",
  failed: VOTE_CHOICE_COLOR_TOKENS.no.badge,
} as const
