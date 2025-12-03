"use client"

import { Progress } from "@near-citizens/ui"
import { type VoteCounts } from "@near-citizens/shared"

interface VoteProgressProps {
  voteCounts: VoteCounts
  quorumRequired?: number
  totalCitizens?: number
  quorumPercentage?: number
  showLabels?: boolean
}

export function VoteProgress({
  voteCounts,
  quorumRequired,
  totalCitizens,
  quorumPercentage,
  showLabels = true,
}: VoteProgressProps) {
  const { yesVotes, noVotes, abstainVotes, totalVotes } = voteCounts

  // Only Yes + No count toward quorum (not Abstain)
  const quorumVotes = yesVotes + noVotes

  // Calculate percentages for Yes vs No (excluding Abstain)
  const yesPercentage = quorumVotes > 0 ? (yesVotes / quorumVotes) * 100 : 0
  const noPercentage = quorumVotes > 0 ? (noVotes / quorumVotes) * 100 : 0

  // Quorum progress: how close to meeting quorum requirement
  const quorumProgress = quorumRequired && quorumRequired > 0 ? (quorumVotes / quorumRequired) * 100 : 0

  return (
    <div className="space-y-3">
      {/* Quorum Progress */}
      {quorumRequired !== undefined && quorumRequired > 0 && (
        <div className="space-y-1">
          {showLabels && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quorum Progress</span>
              <span className="font-medium">
                {quorumVotes} / {quorumRequired} votes
                {quorumProgress >= 100 && <span className="ml-1 text-green-600">(met)</span>}
              </span>
            </div>
          )}
          <Progress value={Math.min(quorumProgress, 100)} className="h-2" />
          {showLabels && (
            <div className="text-xs text-muted-foreground">
              {quorumPercentage !== undefined
                ? `${quorumPercentage}% of ${totalCitizens ?? "?"} citizens required`
                : `${quorumRequired} Yes/No votes required`}
            </div>
          )}
        </div>
      )}

      {/* Vote Distribution */}
      <div className="space-y-1">
        {showLabels && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Votes</span>
            <span className="font-medium">
              {yesVotes} Yes / {noVotes} No{abstainVotes > 0 && ` / ${abstainVotes} Abstain`}
            </span>
          </div>
        )}
        <div className="flex h-2 overflow-hidden rounded">
          {quorumVotes > 0 ? (
            <>
              <div className="bg-green-500 transition-all" style={{ width: `${yesPercentage}%` }} />
              <div className="bg-red-500 transition-all" style={{ width: `${noPercentage}%` }} />
            </>
          ) : (
            <div className="bg-muted w-full" />
          )}
        </div>
        {showLabels && quorumVotes > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="text-green-600">Yes: {yesPercentage.toFixed(1)}%</span>
            <span className="text-red-600">No: {noPercentage.toFixed(1)}%</span>
          </div>
        )}
        {showLabels && abstainVotes > 0 && (
          <div className="text-xs text-muted-foreground">
            Abstain votes ({abstainVotes}) do not count toward quorum
          </div>
        )}
      </div>
    </div>
  )
}
