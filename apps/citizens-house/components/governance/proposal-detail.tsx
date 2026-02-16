"use client"

import Link from "next/link"
import { useState } from "react"
import { NEAR_CONFIG } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink } from "lucide-react"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { formatUtcDateTime } from "@/lib/governance-dates"
import { StatusBadge } from "./status-badge"
import { VoteProgressBar } from "./vote-progress-bar"
import { CountdownTimer } from "./countdown-timer"
import { MarkdownContent } from "./markdown-content"

interface ProposalProps {
  proposal: ProposalView
}

export function ProposalHeader({ proposal }: ProposalProps) {
  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[14px] font-inter text-[#64748b] dark:text-[#94a3b8]"
      >
        <Link href="/governance" className="hover:underline">
          Proposals
        </Link>
        <span>/</span>
        <span>Proposal</span>
      </nav>
      <h1 className="font-fk-grotesk font-medium text-[28px] md:text-[36px] leading-[32px] md:leading-[40px] text-black dark:text-white">
        {proposal.title}
      </h1>
      <div className="flex items-center gap-2 text-[14px] font-inter text-[#64748b] dark:text-[#94a3b8]">
        <span>Authored by {proposal.author}</span>
        <span>·</span>
        <span>Published by</span>
        <a
          href={NEAR_CONFIG.explorerAccountUrl(proposal.creator)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <MiddleTruncate text={proposal.creator} className="max-w-[140px]" />
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
    </div>
  )
}

export function ProposalDescription({ proposal }: ProposalProps) {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <MarkdownContent>{proposal.description}</MarkdownContent>
    </div>
  )
}

export function VotingProgressCard({ proposal }: ProposalProps) {
  const [now] = useState(Date.now)
  const isScheduled = proposal.status === "active" && proposal.startAt > now
  const isFinished = proposal.status === "active" && proposal.endsAt < now
  const displayStatus = isScheduled ? "scheduled" : isFinished ? "finished" : proposal.status

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white">Voting Progress</h3>
        <StatusBadge status={displayStatus} failureKind={proposal.failureKind} />
      </div>
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
  )
}

export function ProposalTimeline({ proposal }: ProposalProps) {
  const [now] = useState(Date.now)
  const isScheduled = proposal.status === "active" && proposal.startAt > now

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-4">Timeline</h3>
      <div className="flex flex-col gap-2 text-[13px] font-inter text-[#475569] dark:text-[#94a3b8]">
        <div className="flex justify-between">
          <span>Created</span>
          <span>{formatUtcDateTime(proposal.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Voting starts</span>
          <span>{formatUtcDateTime(proposal.startAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Voting ends</span>
          <span>{formatUtcDateTime(proposal.endsAt)}</span>
        </div>
        {isScheduled ? (
          <div className="flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-white/10 mt-1">
            <span className="font-medium text-black dark:text-white">Voting starts in</span>
            <CountdownTimer targetMs={proposal.startAt} endedLabel="Starting..." />
          </div>
        ) : proposal.status === "active" ? (
          <div className="flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-white/10 mt-1">
            <span className="font-medium text-black dark:text-white">Time remaining</span>
            <CountdownTimer targetMs={proposal.endsAt} endedLabel="Voting ended" />
          </div>
        ) : proposal.status === "pending" ? (
          <div className="flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-white/10 mt-1">
            <span className="font-medium text-black dark:text-white">Starts in</span>
            <CountdownTimer targetMs={proposal.startAt} endedLabel="Starting..." />
          </div>
        ) : null}
      </div>
    </div>
  )
}
