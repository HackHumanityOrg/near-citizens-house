"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { StatusBadge } from "./status-badge"
import { VoteProgressBar } from "./vote-progress-bar"
import { CountdownTimer } from "./countdown-timer"

interface Props {
  proposal: ProposalView
}

export function ProposalCard({ proposal }: Props) {
  const { id, title, author, status, yesVotes, noVotes, quorumBps, snapshotVerifiedCount, startAt, endsAt } = proposal
  const [now, setNow] = useState(Date.now)
  const isScheduled = status === "active" && startAt > now
  const isFinished = status === "active" && endsAt < now
  const displayStatus = isScheduled ? "scheduled" : isFinished ? "finished" : status

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Link href={`/governance/${id}`} className="block">
      {/* Mobile Card */}
      <div className="md:hidden flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-fk-grotesk font-medium text-[14px] leading-[20px] text-black dark:text-white truncate">
              {title}
            </p>
            <p className="font-inter text-[12px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">by {author}</p>
          </div>
          <StatusBadge status={displayStatus} failureKind={proposal.failureKind} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <VoteProgressBar
            yesVotes={yesVotes}
            noVotes={noVotes}
            quorumBps={quorumBps}
            snapshotVerifiedCount={snapshotVerifiedCount}
            compact
          />
          {isScheduled ? (
            <CountdownTimer targetMs={startAt} label="Starts in" endedLabel="Starting..." />
          ) : status === "active" ? (
            <CountdownTimer targetMs={endsAt} label="Ends in" endedLabel="Voting ended" />
          ) : status === "pending" ? (
            <CountdownTimer targetMs={startAt} label="Starts in" endedLabel="Starting..." />
          ) : null}
        </div>
      </div>

      {/* Desktop Row */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_200px_140px_140px] gap-4 items-center px-10 py-4">
        <div className="min-w-0">
          <p className="font-fk-grotesk font-medium text-[16px] leading-[28px] text-black dark:text-white truncate">
            {title}
          </p>
          <p className="font-inter text-[12px] text-[#64748b] dark:text-[#94a3b8]">by {author}</p>
        </div>
        <div className="flex justify-center">
          <StatusBadge status={displayStatus} failureKind={proposal.failureKind} />
        </div>
        <div className="flex justify-center">
          <VoteProgressBar
            yesVotes={yesVotes}
            noVotes={noVotes}
            quorumBps={quorumBps}
            snapshotVerifiedCount={snapshotVerifiedCount}
            compact
          />
        </div>
        <div className="flex justify-center">
          {isScheduled ? (
            <CountdownTimer targetMs={startAt} label="Starts in" endedLabel="Starting..." />
          ) : status === "active" ? (
            <CountdownTimer targetMs={endsAt} label="Ends in" endedLabel="Voting ended" />
          ) : status === "pending" ? (
            <CountdownTimer targetMs={startAt} label="Starts in" endedLabel="Starting..." />
          ) : (
            <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">--</span>
          )}
        </div>
      </div>
    </Link>
  )
}
