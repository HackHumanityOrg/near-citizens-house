import { Badge } from "@near-citizens/ui"
import { type SputnikProposalStatus, getStatusColor } from "@near-citizens/shared"

interface ProposalStatusBadgeProps {
  status: SputnikProposalStatus
}

export function ProposalStatusBadge({ status }: ProposalStatusBadgeProps) {
  return <Badge className={getStatusColor(status)}>{status}</Badge>
}
