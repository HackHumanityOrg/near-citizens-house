"use client"

import { Button } from "@near-citizens/ui"
import { type SputnikAction, type SputnikProposalKind, type SputnikVote, useNearWallet } from "@near-citizens/shared"
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { useSputnikDao } from "@/hooks/sputnik-dao"

interface VoteButtonProps {
  proposalId: number
  proposalKind: SputnikProposalKind
  currentVote?: SputnikVote | null
  disabled?: boolean
  onVoteSuccess?: () => void
}

export function VoteButton({
  proposalId,
  proposalKind,
  currentVote,
  disabled = false,
  onVoteSuccess,
}: VoteButtonProps) {
  const { vote, isLoading, error, clearError } = useSputnikDao()
  const { isConnected, connect } = useNearWallet()

  const handleVote = async (action: SputnikAction) => {
    if (!isConnected) {
      await connect()
      return
    }

    clearError()

    try {
      await vote(proposalId, action, proposalKind)
      onVoteSuccess?.()
    } catch {
      // Error is already set by the hook
    }
  }

  // Show current vote if already voted
  if (currentVote) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">You voted:</span>
        <div className="flex items-center gap-1 font-medium">
          {currentVote === "Approve" && (
            <>
              <ThumbsUp className="h-4 w-4 text-vote-for" />
              <span className="text-vote-for">For</span>
            </>
          )}
          {currentVote === "Reject" && (
            <>
              <ThumbsDown className="h-4 w-4 text-vote-against" />
              <span className="text-vote-against">Against</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          onClick={() => handleVote("VoteApprove")}
          disabled={disabled || isLoading}
          variant="default"
          className="flex-1 bg-vote-for-bg hover:bg-vote-for-hover text-white dark:text-black"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
          For
        </Button>
        <Button
          onClick={() => handleVote("VoteReject")}
          disabled={disabled || isLoading}
          variant="default"
          className="flex-1 bg-vote-against-bg hover:bg-vote-against text-white dark:text-black"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
          Against
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
