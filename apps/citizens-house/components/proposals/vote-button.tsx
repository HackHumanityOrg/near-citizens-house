"use client"

import { useState } from "react"
import { Button } from "@near-citizens/ui"
import { type Vote } from "@near-citizens/shared"
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"

interface VoteButtonProps {
  proposalId: number
  currentVote?: Vote | null
  disabled?: boolean
  onVoteSuccess?: () => void
}

export function VoteButton({ proposalId, currentVote, disabled = false, onVoteSuccess }: VoteButtonProps) {
  const [voting, setVoting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVote = async (vote: Vote) => {
    setVoting(true)
    setError(null)

    try {
      const response = await fetch("/api/governance/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, vote }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to vote")
      }

      // Success
      onVoteSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote")
    } finally {
      setVoting(false)
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
          disabled={disabled || voting}
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {voting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
          Vote Yes
        </Button>
        <Button onClick={() => handleVote("No")} disabled={disabled || voting} variant="destructive" className="flex-1">
          {voting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsDown className="mr-2 h-4 w-4" />}
          Vote No
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
