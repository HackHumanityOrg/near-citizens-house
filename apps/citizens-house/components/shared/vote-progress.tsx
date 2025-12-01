"use client"

import { Progress } from "@near-citizens/ui"
import { type VoteCounts } from "@near-citizens/shared"

interface VoteProgressProps {
  voteCounts: VoteCounts
  quorumRequired?: number
  totalCitizens?: number
  showLabels?: boolean
}

export function VoteProgress({ voteCounts, quorumRequired, totalCitizens, showLabels = true }: VoteProgressProps) {
  const { yesVotes, noVotes, totalVotes } = voteCounts

  // Calculate percentages
  const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0
  const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0
  const participationPercentage = totalCitizens && totalCitizens > 0 ? (totalVotes / totalCitizens) * 100 : 0

  return (
    <div className="space-y-3">
      {/* Participation Progress */}
      {quorumRequired !== undefined && totalCitizens !== undefined && (
        <div className="space-y-1">
          {showLabels && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Participation</span>
              <span className="font-medium">
                {totalVotes} / {totalCitizens} citizens ({participationPercentage.toFixed(1)}%)
              </span>
            </div>
          )}
          <Progress value={participationPercentage} className="h-2" />
          {showLabels && quorumRequired > 0 && (
            <div className="text-xs text-muted-foreground">
              Quorum: {quorumRequired} votes required ({((quorumRequired / totalCitizens) * 100).toFixed(0)}%)
            </div>
          )}
        </div>
      )}

      {/* Vote Distribution */}
      <div className="space-y-1">
        {showLabels && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Approval</span>
            <span className="font-medium">
              {yesVotes} Yes / {noVotes} No
            </span>
          </div>
        )}
        <div className="flex gap-1 h-2">
          <div className="bg-green-500 rounded-l transition-all" style={{ width: `${yesPercentage}%` }} />
          <div className="bg-red-500 rounded-r transition-all" style={{ width: `${noPercentage}%` }} />
        </div>
        {showLabels && totalVotes > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="text-green-600">Yes: {yesPercentage.toFixed(1)}%</span>
            <span className="text-red-600">No: {noPercentage.toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
