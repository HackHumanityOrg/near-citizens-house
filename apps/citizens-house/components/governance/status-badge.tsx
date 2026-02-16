"use client"

import type { ProposalStatus, FailureKind } from "@/lib/schemas/governance-contract"
import { VOTE_STATUS_COLOR_TOKENS } from "./vote-colors"

export type DisplayStatus = ProposalStatus | "scheduled" | "finished"

const statusStyles: Record<DisplayStatus, string> = {
  pending: "bg-[#e2e8f0] text-[#475569] dark:bg-[#334155] dark:text-[#cbd5e1]",
  active: VOTE_STATUS_COLOR_TOKENS.active,
  scheduled: "bg-[#dbeafe] text-[#1e40af] dark:bg-[#1e3a5f] dark:text-[#93c5fd]",
  finished: "bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fbbf24]",
  succeeded: VOTE_STATUS_COLOR_TOKENS.succeeded,
  failed: VOTE_STATUS_COLOR_TOKENS.failed,
  cancelled: "bg-[#f1f5f9] text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]",
}

const statusLabels: Record<DisplayStatus, string> = {
  pending: "Pending",
  active: "Active",
  scheduled: "Scheduled",
  finished: "Finished",
  succeeded: "Passed",
  failed: "Rejected",
  cancelled: "Cancelled",
}

const failureLabels: Record<FailureKind, string> = {
  quorum_not_met: "Quorum not met",
  rejected: "Rejected",
  pending_expired: "Expired",
  zero_snapshot: "Zero snapshot",
  snapshot_callback_failed: "Snapshot failed",
}

interface Props {
  status: DisplayStatus
  failureKind?: FailureKind | null
}

export function StatusBadge({ status, failureKind }: Props) {
  const showFailureReasonOnly = status === "failed" && !!failureKind

  return (
    <span className="inline-flex items-center gap-1.5 flex-nowrap">
      {!showFailureReasonOnly && (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}>
          {statusLabels[status]}
        </span>
      )}
      {failureKind && (
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}>
          {failureLabels[failureKind]}
        </span>
      )}
    </span>
  )
}
