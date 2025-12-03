"use client"

import { Button } from "@near-citizens/ui"
import { type Vote, useNearWallet } from "@near-citizens/shared"
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { useGovernance } from "@/hooks/governance"

interface VoteButtonProps {
  proposalId: number
  currentVote?: Vote | null
  disabled?: boolean
  onVoteSuccess?: () => void
}

export function VoteButton({ proposalId, currentVote, disabled = false, onVoteSuccess }: VoteButtonProps) {
  const { vote, isLoading, error, clearError } = useGovernance()
  const { isConnected, connect } = useNearWallet()

  const handleVote = async (voteChoice: Vote) => {
    if (!isConnected) {
      await connect()
      return
    }

    clearError()

    try {
      await vote(proposalId, voteChoice)
      onVoteSuccess?.()
    } catch {
      // Error is already set by the hook
    }
  }

  if (currentVote) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">You voted:</span>
        <div className="flex items-center gap-1 font-medium">
          {currentVote === "Yes" ? (
            <>
              <ThumbsUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Yes</span>
            </>
          ) : (
            <>
              <ThumbsDown className="h-4 w-4 text-red-600" />
              <span className="text-red-600">No</span>
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
          onClick={() => handleVote("Yes")}
          disabled={disabled || isLoading}
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
          Vote Yes
        </Button>
        <Button
          onClick={() => handleVote("No")}
          disabled={disabled || isLoading}
          variant="destructive"
          className="flex-1"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
          Vote No
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
