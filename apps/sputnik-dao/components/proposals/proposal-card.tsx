"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@near-citizens/ui"
import { type SputnikProposal, getProposalKindLabel } from "@near-citizens/shared"
import { ProposalStatusBadge } from "./proposal-status-badge"
import { VoteProgress } from "./vote-progress"
import { Clock, User } from "lucide-react"

interface ProposalCardProps {
  proposal: SputnikProposal
}

export function ProposalCard({ proposal }: ProposalCardProps) {
  const isInProgress = proposal.status === "InProgress"
  const kindLabel = getProposalKindLabel(proposal.kind)

  // Format submission time
  const submittedDate = new Date(proposal.submissionTime).toLocaleDateString()

  return (
    <Link href={`/proposals/${proposal.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <ProposalStatusBadge status={proposal.status} />
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  #{proposal.id}
                </span>
                {"Vote" in proposal.kind ? null : (
                  <span className="text-xs text-muted-foreground">
                    {kindLabel}
                  </span>
                )}
              </div>
              <CardTitle className="text-lg line-clamp-2">
                {/* For Vote proposals, use description as title. For AddMember, use kind label */}
                {"Vote" in proposal.kind
                  ? proposal.description.slice(0, 100) + (proposal.description.length > 100 ? "..." : "")
                  : kindLabel}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-1">
                <User className="h-3 w-3" />
                {proposal.proposer.split(".")[0]}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description Preview (only for Vote proposals with longer descriptions) */}
          {"Vote" in proposal.kind && proposal.description.length > 100 && (
            <p className="text-sm text-muted-foreground line-clamp-2">{proposal.description}</p>
          )}

          {/* Vote Progress */}
          <VoteProgress
            totalApprove={proposal.totalApprove}
            totalReject={proposal.totalReject}
            totalRemove={proposal.totalRemove}
            totalVotes={proposal.totalVotes}
            showLabels={true}
          />

          {/* Metadata */}
          <div className="text-xs text-muted-foreground pt-2 border-t flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Created {submittedDate}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
