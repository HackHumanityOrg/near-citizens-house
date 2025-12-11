import { ThumbsUp, ThumbsDown, Trash2 } from "lucide-react"

interface VoteProgressProps {
  totalApprove: number
  totalReject: number
  totalRemove: number
  showLabels?: boolean
}

export function VoteProgress({ totalApprove, totalReject, totalRemove, showLabels = true }: VoteProgressProps) {
  // Calculate percentages (only from approve/reject for main bar)
  const approveRejectTotal = totalApprove + totalReject
  const approvePercent = approveRejectTotal > 0 ? (totalApprove / approveRejectTotal) * 100 : 50

  return (
    <div className="space-y-2">
      {/* Progress bar showing approve vs reject ratio */}
      {approveRejectTotal === 0 ? (
        <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden" />
      ) : (
        <div className="relative h-3 w-full rounded-full bg-vote-against-bg-light overflow-hidden">
          <div className="h-full bg-vote-for-bg transition-all duration-300" style={{ width: `${approvePercent}%` }} />
        </div>
      )}

      {/* Vote counts */}
      {showLabels && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-vote-for">
            <ThumbsUp className="h-3 w-3" />
            <span>
              {totalApprove} For
              {approveRejectTotal > 0 && ` (${Math.round(approvePercent)}%)`}
            </span>
          </div>

          {totalRemove > 0 && (
            <div className="flex items-center gap-1 text-vote-remove">
              <Trash2 className="h-3 w-3" />
              <span>{totalRemove} Remove</span>
            </div>
          )}

          <div className="flex items-center gap-1 text-vote-against">
            <ThumbsDown className="h-3 w-3" />
            <span>
              {totalReject} Against
              {approveRejectTotal > 0 && ` (${Math.round(100 - approvePercent)}%)`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
