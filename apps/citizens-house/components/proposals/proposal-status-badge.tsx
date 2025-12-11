import { Badge } from "@near-citizens/ui"
import { type SputnikProposalStatus, getStatusColor, PROPOSAL_STATUS_LABELS } from "@near-citizens/shared"

interface ProposalStatusBadgeProps {
  status: SputnikProposalStatus
}

export function ProposalStatusBadge({ status }: ProposalStatusBadgeProps) {
  return <Badge className={getStatusColor(status)}>{PROPOSAL_STATUS_LABELS[status]}</Badge>
}
