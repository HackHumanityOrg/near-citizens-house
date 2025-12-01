"use client"

import { type ProposalStatus } from "@near-citizens/shared"
import { Badge } from "@near-citizens/ui"

interface ProposalStatusBadgeProps {
  status: ProposalStatus
}

export function ProposalStatusBadge({ status }: ProposalStatusBadgeProps) {
  const variants: Record<
    ProposalStatus,
    { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
  > = {
    Active: { variant: "default", label: "Active" },
    Passed: { variant: "default", label: "✓ Passed" },
    Failed: { variant: "destructive", label: "✗ Failed" },
    QuorumNotMet: { variant: "secondary", label: "Quorum Not Met" },
    Cancelled: { variant: "outline", label: "Cancelled" },
  }

  const config = variants[status]

  return (
    <Badge variant={config.variant} className="font-medium">
      {config.label}
    </Badge>
  )
}
