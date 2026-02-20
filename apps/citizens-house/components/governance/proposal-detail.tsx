"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { NEAR_CONFIG } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ArrowLeft, Clock3, ExternalLink, Flag, Play, Plus } from "lucide-react"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { formatUtcDateTime } from "@/lib/governance-dates"
import { StatusBadge } from "./status-badge"
import { VoteProgressBar } from "./vote-progress-bar"
import { MarkdownContent } from "./markdown-content"
import {
  deriveProposalTimelineModel,
  type ProposalTimelineStep,
  type TimelineStepIcon,
} from "./proposal-timeline-state"

interface ProposalProps {
  proposal: ProposalView
}

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setNow(Date.now()), 0)
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])

  return now
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
  }
}

function stepNodeClasses(step: ProposalTimelineStep) {
  if (step.state === "current") {
    return "border-[#FFE66C] bg-[#FFE66C] dark:border-[#E9C85A] dark:bg-[#E9C85A]"
  }

  if (step.state === "upcoming") {
    return "border-[#d1d5db] bg-white dark:border-[#cbd5e1] dark:bg-[#f8fafc]"
  }

  return "border-[#94a3b8] bg-[#e2e8f0] dark:border-[#94a3b8] dark:bg-[#64748b]"
}

function stepIconClasses(step: ProposalTimelineStep) {
  if (step.state === "current") {
    return "text-black dark:text-black"
  }

  if (step.state === "upcoming") {
    return "text-[#64748b] dark:text-[#475569]"
  }

  return "text-[#475569] dark:text-[#f8fafc]"
}

function stepTitleClasses(step: ProposalTimelineStep) {
  if (step.state === "current") return "text-black dark:text-white"
  if (step.state === "upcoming") return "text-[#0f172a] dark:text-white"
  return "text-[#64748b] dark:text-[#94a3b8]"
}

export function ProposalHeader({ proposal }: ProposalProps) {
  return (
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-[14px] font-inter text-[#64748b] dark:text-[#94a3b8]"
      >
        <Link href="/proposals" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
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
  const now = useNow()
  const isScheduled = now !== null && proposal.status === "active" && proposal.startAt > now
  const isFinished = now !== null && proposal.status === "active" && proposal.endsAt < now
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
  const now = useNow()
  const timelineNow = now ?? proposal.createdAt
  const timeline = deriveProposalTimelineModel(proposal, timelineNow, {
    includeRelativeCountdownInTitles: now !== null,
  })

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
                    <p className={`font-fk-grotesk font-medium text-[18px] leading-[24px] ${stepTitleClasses(step)}`}>
                      {step.title}
                    </p>
                  </>
                ) : (
                  <div className="flex h-9 items-center">
                    <p className={`font-fk-grotesk font-medium text-[18px] leading-[30px] ${stepTitleClasses(step)}`}>
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
    </div>
  )
}
