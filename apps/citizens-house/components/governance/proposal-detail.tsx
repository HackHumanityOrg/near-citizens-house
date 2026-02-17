"use client"

import Link from "next/link"
import { useState } from "react"
import { NEAR_CONFIG } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { Clock3, ExternalLink, Flag, Play, Plus, Vote } from "lucide-react"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { formatUtcDateTime } from "@/lib/governance-dates"
import { StatusBadge } from "./status-badge"
import { VoteProgressBar } from "./vote-progress-bar"
import { CountdownTimer } from "./countdown-timer"
import { MarkdownContent } from "./markdown-content"
import {
  deriveProposalTimelineModel,
  type ProposalTimelineStep,
  type TimelineStepIcon,
  type ViewerTimelineVote,
} from "./proposal-timeline-state"

interface ProposalProps {
  proposal: ProposalView
}

function renderTimelineIcon(icon: TimelineStepIcon) {
  switch (icon) {
    case "created":
      return <Plus className="h-4 w-4" />
    case "start":
      return <Play className="h-4 w-4" />
    case "end":
      return <Flag className="h-4 w-4" />
    case "in_progress":
      return <Clock3 className="h-4 w-4" />
    case "voted":
      return <Vote className="h-4 w-4" />
  }
}

function stepNodeClasses(step: ProposalTimelineStep) {
  if (step.state === "current") {
    return "border-[#d97706] bg-[#fde68a] dark:border-[#facc15] dark:bg-[#78350f]"
  }

  if (step.state === "upcoming") {
    return "border-[#cbd5e1] bg-[#f8fafc] dark:border-[#475569] dark:bg-[#0f172a]"
  }

  return "border-[#16a34a] bg-[#dcfce7] dark:border-[#22c55e] dark:bg-[#14532d]"
}

function stepIconClasses(step: ProposalTimelineStep) {
  if (step.state === "current") {
    return "text-[#78350f] dark:text-[#fde68a]"
  }

  if (step.state === "upcoming") {
    return "text-[#64748b] dark:text-[#94a3b8]"
  }

  return "text-[#166534] dark:text-[#bbf7d0]"
}

function stepTitleClasses(step: ProposalTimelineStep) {
  if (step.state === "current") return "text-black dark:text-white"
  if (step.state === "upcoming") return "text-[#94a3b8] dark:text-[#64748b]"
  return "text-[#0f172a] dark:text-[#e2e8f0]"
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

interface ProposalTimelineProps extends ProposalProps {
  viewerVote?: ViewerTimelineVote | null
}

export function ProposalTimeline({ proposal, viewerVote = null }: ProposalTimelineProps) {
  const [now] = useState(Date.now)
  const timeline = deriveProposalTimelineModel(proposal, now, viewerVote)

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-4">Timeline</h3>
      <div className="relative pl-0">
        <div className="absolute left-[17px] top-4 bottom-4 w-px bg-[#cbd5e1] dark:bg-[#334155]" />
        <ol className="relative flex flex-col gap-5">
          {timeline.steps.map((step) => (
            <li key={step.key} className="relative flex gap-3">
              <div
                className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${step.timestampMs !== null ? "mt-0.5" : ""} ${stepNodeClasses(step)}`}
              >
                <span className={stepIconClasses(step)}>{renderTimelineIcon(step.icon)}</span>
              </div>
              <div className="min-w-0 flex-1">
                {step.timestampMs !== null ? (
                  <>
                    <p className="font-inter text-[12px] leading-[16px] text-[#64748b] dark:text-[#94a3b8]">
                      {formatUtcDateTime(step.timestampMs)}
                    </p>
                    <p className={`font-fk-grotesk font-medium text-[20px] leading-[26px] ${stepTitleClasses(step)}`}>
                      {step.title}
                    </p>
                  </>
                ) : (
                  <div className="flex h-9 items-center">
                    <p className={`font-fk-grotesk font-medium text-[20px] leading-[36px] ${stepTitleClasses(step)}`}>
                      {step.title}
                    </p>
                  </div>
                )}
                {step.subtitle && (
                  <p className="font-inter text-[12px] leading-[16px] text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                    {step.subtitle}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {timeline.countdown ? (
        <div className="flex justify-between items-center pt-3 border-t border-[#e2e8f0] dark:border-white/10 mt-4">
          <span className="font-medium text-black dark:text-white">{timeline.countdown.label}</span>
          <CountdownTimer targetMs={timeline.countdown.targetMs} endedLabel={timeline.countdown.endedLabel} />
        </div>
      ) : null}
    </div>
  )
}
