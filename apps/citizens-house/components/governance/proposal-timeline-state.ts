import type { ProposalView } from "@/lib/schemas/governance-contract"

export type TimelineStepState = "completed" | "current" | "upcoming"

export type TimelineStepIcon = "created" | "start" | "end" | "in_progress" | "voted"

export interface ProposalTimelineStep {
  key: "created" | "voting_start" | "viewer_vote" | "voting_in_progress" | "voting_end"
  title: string
  timestampMs: number | null
  subtitle?: string
  state: TimelineStepState
  icon: TimelineStepIcon
}

export interface ViewerTimelineVote {
  votedAt: number
}

export interface ProposalTimelineCountdown {
  label: "Starts in" | "Ends in"
  targetMs: number
  endedLabel: "Starting..." | "Voting ended"
}

export interface ProposalTimelineModel {
  steps: ProposalTimelineStep[]
  countdown: ProposalTimelineCountdown | null
}

function insertViewerVoteStep(
  steps: ProposalTimelineStep[],
  proposal: ProposalView,
  viewerVote: ViewerTimelineVote | null | undefined,
): ProposalTimelineStep[] {
  if (!viewerVote) return steps
  if (proposal.status === "pending") return steps

  const voteStep: ProposalTimelineStep = {
    key: "viewer_vote",
    title: "You voted",
    timestampMs: viewerVote.votedAt,
    state: "completed",
    icon: "voted",
  }

  const createdIndex = steps.findIndex((step) => step.key === "created")
  const startIndex = steps.findIndex((step) => step.key === "voting_start")
  const inProgressIndex = steps.findIndex((step) => step.key === "voting_in_progress")
  const endIndex = steps.findIndex((step) => step.key === "voting_end")
  const voteAt = viewerVote.votedAt

  let insertAt = endIndex

  if (voteAt <= proposal.createdAt) {
    insertAt = createdIndex + 1
  } else if (voteAt < proposal.startAt) {
    insertAt = startIndex
  } else if (voteAt === proposal.startAt) {
    insertAt = startIndex + 1
  } else if (voteAt <= proposal.endsAt) {
    insertAt = inProgressIndex >= 0 ? inProgressIndex : endIndex
  } else {
    insertAt = endIndex
  }

  insertAt = Math.max(0, Math.min(insertAt, endIndex))

  return [...steps.slice(0, insertAt), voteStep, ...steps.slice(insertAt)]
}

export function deriveProposalTimelineModel(
  proposal: ProposalView,
  now: number,
  viewerVote: ViewerTimelineVote | null = null,
): ProposalTimelineModel {
  const isClosedStatus =
    proposal.status === "succeeded" || proposal.status === "failed" || proposal.status === "cancelled"
  const hasStarted = now >= proposal.startAt || isClosedStatus
  const hasEnded = now >= proposal.endsAt || isClosedStatus
  const isActiveAndInWindow = proposal.status === "active" && now >= proposal.startAt && now < proposal.endsAt

  const startStep: ProposalTimelineStep = {
    key: "voting_start",
    title: "Voting starts",
    timestampMs: proposal.startAt,
    state: hasStarted ? "completed" : "current",
    icon: "start",
  }

  const endStep: ProposalTimelineStep = {
    key: "voting_end",
    title: "Voting ends",
    timestampMs: proposal.endsAt,
    state: hasEnded ? "completed" : "upcoming",
    icon: "end",
  }

  const steps: ProposalTimelineStep[] = [
    {
      key: "created",
      title: "Created",
      timestampMs: proposal.createdAt,
      state: "completed",
      icon: "created",
    },
    startStep,
  ]

  if (isActiveAndInWindow) {
    steps.push({
      key: "voting_in_progress",
      title: "Voting in progress",
      timestampMs: null,
      state: "current",
      icon: "in_progress",
    })
  }

  steps.push(endStep)

  const stepsWithViewerVote = insertViewerVoteStep(steps, proposal, viewerVote)

  let countdown: ProposalTimelineCountdown | null = null
  const isOpenStatus = proposal.status === "pending" || proposal.status === "active"
  if (isOpenStatus && now < proposal.startAt) {
    countdown = {
      label: "Starts in",
      targetMs: proposal.startAt,
      endedLabel: "Starting...",
    }
  } else if (proposal.status === "active" && now < proposal.endsAt) {
    countdown = {
      label: "Ends in",
      targetMs: proposal.endsAt,
      endedLabel: "Voting ended",
    }
  }

  return { steps: stepsWithViewerVote, countdown }
}
