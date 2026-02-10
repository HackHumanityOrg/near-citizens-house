"use client"

import type { ProposalStatus, FailureKind } from "@/lib/schemas/governance-contract"

export type DisplayStatus = ProposalStatus | "scheduled"

const statusStyles: Record<DisplayStatus, string> = {
  pending: "bg-[#e2e8f0] text-[#475569] dark:bg-[#334155] dark:text-[#cbd5e1]",
  active: "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#bbf7d0]",
  scheduled: "bg-[#dbeafe] text-[#1e40af] dark:bg-[#1e3a5f] dark:text-[#93c5fd]",
  succeeded: "bg-[#bbf7d0] text-[#14532d] dark:bg-[#166534] dark:text-[#dcfce7]",
  failed: "bg-[#fecaca] text-[#991b1b] dark:bg-[#7f1d1d] dark:text-[#fecaca]",
  cancelled: "bg-[#f1f5f9] text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]",
}

const statusLabels: Record<DisplayStatus, string> = {
  pending: "Pending",
  active: "Active",
  scheduled: "Scheduled",
  succeeded: "Succeeded",
  failed: "Failed",
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
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {statusLabels[status]}
      {failureKind && <span className="text-[10px] opacity-75">({failureLabels[failureKind]})</span>}
    </span>
  )
}
