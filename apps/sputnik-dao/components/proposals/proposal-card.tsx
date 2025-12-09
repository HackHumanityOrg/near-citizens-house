import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from "@near-citizens/ui"
import { type SputnikProposal, getProposalKindLabel } from "@near-citizens/shared"
import { ProposalStatusBadge } from "./proposal-status-badge"
import { VoteProgress } from "./vote-progress"
import { User, Hash } from "lucide-react"

interface ProposalCardProps {
  proposal: SputnikProposal
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const kindLabel = getProposalKindLabel(proposal.kind)
  const isVoteProposal = proposal.kind === "Vote"

  // Extract title from description (first line or first 80 chars)
  const getTitle = () => {
    const firstLine = proposal.description.split("\n")[0].trim()
    if (firstLine.length <= 80) return firstLine
    return firstLine.slice(0, 80) + "..."
  }

  return (
    <Link href={`/proposals/${proposal.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader className="space-y-1">
          {/* Top row: #ID + Title (left), Status badge (right) */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                <Hash className="h-3 w-3" />
                {proposal.id}
              </Badge>
              <CardTitle className="text-lg line-clamp-2">{isVoteProposal ? getTitle() : kindLabel}</CardTitle>
            </div>
            <ProposalStatusBadge status={proposal.status} />
          </div>
          {/* Author */}
          <CardDescription className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {proposal.proposer.split(".")[0]}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Vote Progress */}
          <VoteProgress
            totalApprove={proposal.totalApprove}
            totalReject={proposal.totalReject}
            totalRemove={proposal.totalRemove}
            showLabels={true}
          />
        </CardContent>
      </Card>
    </Link>
  )
}
