import { Progress } from "@near-citizens/ui"
import { ThumbsUp, ThumbsDown, Trash2 } from "lucide-react"

interface VoteProgressProps {
  totalApprove: number
  totalReject: number
  totalRemove: number
  totalVotes: number
  showLabels?: boolean
}

export function VoteProgress({
  totalApprove,
  totalReject,
  totalRemove,
  totalVotes,
  showLabels = true,
}: VoteProgressProps) {
  // Calculate percentages (only from approve/reject for main bar)
  const approveRejectTotal = totalApprove + totalReject
  const approvePercent = approveRejectTotal > 0 ? (totalApprove / approveRejectTotal) * 100 : 50

  return (
    <div className="space-y-2">
      {/* Progress bar showing approve vs reject ratio */}
      <div className="relative h-3 w-full rounded-full bg-red-200 dark:bg-red-900 overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${approvePercent}%` }}
        />
      </div>

      {/* Vote counts */}
      {showLabels && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <ThumbsUp className="h-3 w-3" />
            <span>
              {totalApprove} Approve
              {approveRejectTotal > 0 && ` (${Math.round(approvePercent)}%)`}
            </span>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground">
            {totalRemove > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <Trash2 className="h-3 w-3" />
                <span>{totalRemove} Remove</span>
              </div>
            )}
            <span className="text-xs">Total: {totalVotes}</span>
          </div>

          <div className="flex items-center gap-1 text-red-600">
            <ThumbsDown className="h-3 w-3" />
            <span>
              {totalReject} Reject
              {approveRejectTotal > 0 && ` (${Math.round(100 - approvePercent)}%)`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
