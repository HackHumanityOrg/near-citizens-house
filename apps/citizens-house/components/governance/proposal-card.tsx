"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { StatusBadge } from "./status-badge"
import { VoteProgressBar } from "./vote-progress-bar"

interface Props {
  proposal: ProposalView
}

export function ProposalCard({ proposal }: Props) {
  const { id, title, author, status, startAt, endsAt } = proposal
  const [now, setNow] = useState(Date.now)
  const isScheduled = status === "active" && startAt > now
  const isFinished = status === "active" && endsAt < now
  const displayStatus = isScheduled ? "scheduled" : isFinished ? "finished" : status

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Link
      href={`/governance/${id}`}
      className="block h-full bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-5 md:p-6 hover:bg-[#f8fafc] dark:hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-fk-grotesk font-medium text-[20px] leading-[26px] md:text-[22px] md:leading-[28px] text-black dark:text-white line-clamp-2 break-words">
              {title}
            </h3>
            <p className="font-inter text-[13px] text-[#64748b] dark:text-[#94a3b8] mt-1">Authored by {author}</p>
          </div>
          <StatusBadge status={displayStatus} failureKind={proposal.failureKind} />
        </div>

        <div className="rounded-[12px] border border-[#e2e8f0] dark:border-white/10 p-4 mt-auto">
          <h4 className="font-fk-grotesk font-bold text-[14px] text-black dark:text-white mb-3">Voting Progress</h4>
          <VoteProgressBar
            yesVotes={proposal.yesVotes}
            noVotes={proposal.noVotes}
            quorumBps={proposal.quorumBps}
            snapshotVerifiedCount={proposal.snapshotVerifiedCount}
          />
          {proposal.pendingVoteCount > 0 && (
            <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter mt-2">
              {proposal.pendingVoteCount} vote(s) pending verification
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
