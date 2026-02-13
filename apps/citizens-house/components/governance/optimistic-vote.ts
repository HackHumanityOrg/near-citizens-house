import type { VoteChoice } from "@/lib/schemas/governance-contract"

export interface VoteLifecyclePayload {
  proposalId: number
  voter: string
  choice: VoteChoice
  votedAt: number
}

export interface OptimisticVote extends VoteLifecyclePayload {
  status: "pending" | "confirmed"
}
