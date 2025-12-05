"use client"

import { Button } from "@near-citizens/ui"
import { type SputnikAction, type SputnikProposalKind, type SputnikVote, useNearWallet } from "@near-citizens/shared"
import { ThumbsUp, ThumbsDown, Trash2, Loader2 } from "lucide-react"
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
              <ThumbsUp className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Approve</span>
            </>
          )}
          {currentVote === "Reject" && (
            <>
              <ThumbsDown className="h-4 w-4 text-red-600" />
              <span className="text-red-600">Reject</span>
            </>
          )}
          {currentVote === "Remove" && (
            <>
              <Trash2 className="h-4 w-4 text-orange-600" />
              <span className="text-orange-600">Remove</span>
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
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
          Approve
        </Button>
        <Button
          onClick={() => handleVote("VoteReject")}
          disabled={disabled || isLoading}
          variant="destructive"
          className="flex-1"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
          Reject
        </Button>
        <Button
          onClick={() => handleVote("VoteRemove")}
          disabled={disabled || isLoading}
          variant="outline"
          className="flex-1 text-orange-600 border-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
          title="Vote to remove as spam"
        >
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Remove
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
