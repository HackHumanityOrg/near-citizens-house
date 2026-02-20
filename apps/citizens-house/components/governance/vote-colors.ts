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
    text: "text-emerald-800 dark:text-emerald-300",
    actionText: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    button: "bg-emerald-500 hover:bg-emerald-600 text-white",
    progressSegment: "bg-emerald-500",
    legendChip: "bg-emerald-500",
  },
  no: {
    text: "text-red-800 dark:text-red-300",
    actionText: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
    button: "bg-red-500 hover:bg-red-600 text-white",
    progressSegment: "bg-red-500",
    legendChip: "bg-red-500",
  },
}

export function formatVoteChoiceLabel(choice: VoteChoice): "Yes" | "No" {
  return choice === "yes" ? "Yes" : "No"
}

export const VOTE_POSITIVE_TEXT_CLASS = VOTE_CHOICE_COLOR_TOKENS.yes.actionText

export const VOTE_STATUS_COLOR_TOKENS = {
  active: VOTE_CHOICE_COLOR_TOKENS.yes.badge,
  succeeded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  failed: VOTE_CHOICE_COLOR_TOKENS.no.badge,
} as const
