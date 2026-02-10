"use client"

interface Props {
  yesVotes: number
  noVotes: number
  quorumBps: number
  snapshotVerifiedCount: number
  compact?: boolean
}

export function VoteProgressBar({ yesVotes, noVotes, quorumBps, snapshotVerifiedCount, compact }: Props) {
  const totalVotes = yesVotes + noVotes
  const yesPct = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0
  const noPct = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0
  const quorumRequired = Math.ceil((snapshotVerifiedCount * quorumBps) / 10_000)
  const quorumPct = quorumRequired > 0 ? Math.min((totalVotes / quorumRequired) * 100, 100) : 100

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1 h-1.5 bg-[#e2e8f0] dark:bg-white/10 rounded-full overflow-hidden flex">
          {totalVotes > 0 && (
            <>
              <div className="bg-[#22c55e] h-full" style={{ width: `${yesPct}%` }} />
              <div className="bg-[#ef4444] h-full" style={{ width: `${noPct}%` }} />
            </>
          )}
        </div>
        <span className="text-[11px] text-[#64748b] dark:text-[#94a3b8] whitespace-nowrap font-inter">
          {yesVotes}/{noVotes}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Vote bar */}
      <div className="relative h-3 bg-[#e2e8f0] dark:bg-white/10 rounded-full overflow-hidden flex">
        {totalVotes > 0 && (
          <>
            <div className="bg-[#22c55e] h-full transition-all" style={{ width: `${yesPct}%` }} />
            <div className="bg-[#ef4444] h-full transition-all" style={{ width: `${noPct}%` }} />
          </>
        )}
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs font-inter">
        <span className="text-[#166534] dark:text-[#bbf7d0]">Yes: {yesVotes}</span>
        <span className="text-[#991b1b] dark:text-[#fecaca]">No: {noVotes}</span>
      </div>

      {/* Quorum progress */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] text-[#64748b] dark:text-[#94a3b8] font-inter">
          <span>
            Quorum: {totalVotes} / {quorumRequired} votes
          </span>
          <span>{Math.round(quorumPct)}%</span>
        </div>
        <div className="h-1.5 bg-[#e2e8f0] dark:bg-white/10 rounded-full overflow-hidden">
          <div className="bg-[#3b82f6] h-full transition-all rounded-full" style={{ width: `${quorumPct}%` }} />
        </div>
      </div>
    </div>
  )
}
