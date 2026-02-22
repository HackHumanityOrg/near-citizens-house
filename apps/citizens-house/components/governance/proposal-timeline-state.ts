import type { ProposalView } from "@/lib/schemas/governance-contract"

export type TimelineStepState = "completed" | "current" | "upcoming"

export type TimelineStepIcon = "created" | "start" | "end" | "in_progress"

export interface ProposalTimelineStep {
  key: "created" | "voting_start" | "voting_in_progress" | "voting_end"
  title: string
  timestampMs: number | null
  subtitle?: string
  state: TimelineStepState
  icon: TimelineStepIcon
}

export interface ProposalTimelineModel {
  steps: ProposalTimelineStep[]
}

interface DeriveProposalTimelineOptions {
  includeRelativeCountdownInTitles?: boolean
}

type TimelineStepKey = ProposalTimelineStep["key"]

function failedBeforeActivation(proposal: ProposalView): boolean {
  if (proposal.status !== "failed") return false

  if (
    proposal.failureKind === "pending_expired" ||
    proposal.failureKind === "snapshot_callback_failed" ||
    proposal.failureKind === "zero_snapshot"
  ) {
    return true
  }

  if (proposal.failureKind === "quorum_not_met" || proposal.failureKind === "rejected") {
    return false
  }

  // Defensive fallback for malformed/legacy data.
  return proposal.snapshotVerifiedCount === 0
}

function wasActivated(proposal: ProposalView): boolean {
  if (proposal.status === "active" || proposal.status === "succeeded") return true
  if (proposal.status === "failed") return !failedBeforeActivation(proposal)

  // Cancelled proposals do not carry a reason; infer from snapshot presence.
  if (proposal.status === "cancelled") return proposal.snapshotVerifiedCount > 0

  return false
}

const STEP_TITLE_BY_STATE: Record<TimelineStepKey, Record<TimelineStepState, string>> = {
  created: {
    completed: "Created",
    current: "Creating",
    upcoming: "Will be created",
  },
  voting_start: {
    completed: "Voting started",
    current: "Voting starts",
    upcoming: "Voting will start",
  },
  voting_in_progress: {
    completed: "Voting was in progress",
    current: "Voting is in progress",
    upcoming: "Voting will be in progress",
  },
  voting_end: {
    completed: "Voting ended",
    current: "Voting ends",
    upcoming: "Voting will end",
  },
}

function resolveStepTitle(key: TimelineStepKey, state: TimelineStepState): string {
  return STEP_TITLE_BY_STATE[key][state]
}

function formatTimelineCountdown(diffMs: number): string {
  if (diffMs <= 0) return "0s"

  const totalSecs = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const minutes = Math.floor((totalSecs % 3600) / 60)
  const seconds = totalSecs % 60
  const parts: string[] = []

  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (days === 0) parts.push(`${seconds}s`)

  return parts.join(" ")
}

export function deriveProposalTimelineModel(
  proposal: ProposalView,
  now: number,
  options: DeriveProposalTimelineOptions = {},
): ProposalTimelineModel {
  const includeRelativeCountdownInTitles = options.includeRelativeCountdownInTitles ?? true
  const isClosedStatus =
    proposal.status === "succeeded" || proposal.status === "failed" || proposal.status === "cancelled"
  const activated = wasActivated(proposal)
  const votingDidNotStart = isClosedStatus && (!activated || now < proposal.startAt)
  const hasStarted = activated && now >= proposal.startAt && !votingDidNotStart
  const hasEnded = (activated && now >= proposal.endsAt) || isClosedStatus
  const isActiveAndInWindow = proposal.status === "active" && now >= proposal.startAt && now < proposal.endsAt
  const isOpenStatus = proposal.status === "pending" || proposal.status === "active"
  const votingStartState: TimelineStepState = hasStarted || votingDidNotStart ? "completed" : "current"
  const votingEndState: TimelineStepState = hasEnded ? "completed" : "upcoming"
  let votingStartsTitle = resolveStepTitle("voting_start", votingStartState)
  if (votingDidNotStart) {
    votingStartsTitle = "Voting did not start"
  } else if (includeRelativeCountdownInTitles && isOpenStatus && now < proposal.startAt) {
    votingStartsTitle = `Voting will start in ${formatTimelineCountdown(proposal.startAt - now)}`
  }

  let votingEndsTitle = resolveStepTitle("voting_end", votingEndState)
  if (
    includeRelativeCountdownInTitles &&
    proposal.status === "active" &&
    now >= proposal.startAt &&
    now < proposal.endsAt
  ) {
    votingEndsTitle = `Voting will end in ${formatTimelineCountdown(proposal.endsAt - now)}`
  }

  const startStep: ProposalTimelineStep = {
    key: "voting_start",
    title: votingStartsTitle,
    timestampMs: proposal.startAt,
    state: votingStartState,
    icon: "start",
  }

  const endStep: ProposalTimelineStep = {
    key: "voting_end",
    title: votingEndsTitle,
    timestampMs: proposal.endsAt,
    state: votingEndState,
    icon: "end",
  }

  const steps: ProposalTimelineStep[] = [
    {
      key: "created",
      title: resolveStepTitle("created", "completed"),
      timestampMs: proposal.createdAt,
      state: "completed",
      icon: "created",
    },
    startStep,
  ]

  if (isActiveAndInWindow) {
    steps.push({
      key: "voting_in_progress",
      title: resolveStepTitle("voting_in_progress", "current"),
      timestampMs: null,
      state: "current",
      icon: "in_progress",
    })
  }

  steps.push(endStep)
  return { steps }
}
