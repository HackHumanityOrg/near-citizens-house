"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@near-citizens/ui"
import { type Proposal, type VoteCounts } from "@near-citizens/shared"
import { ProposalStatusBadge } from "./proposal-status-badge"
import { CountdownTimer } from "../shared/countdown-timer"
import { VoteProgress } from "../shared/vote-progress"
import { ExternalLink } from "lucide-react"

interface ProposalCardProps {
  proposal: Proposal
  voteCounts?: VoteCounts
  quorumRequired?: number
  totalCitizens?: number
}

export function ProposalCard({ proposal, voteCounts, quorumRequired, totalCitizens }: ProposalCardProps) {
  const isActive = proposal.status === "Active"
  const hasEnded = Date.now() >= proposal.votingEndsAt

  return (
    <Link href={`/proposals/${proposal.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <ProposalStatusBadge status={proposal.status} />
                {isActive && !hasEnded && <CountdownTimer endTime={proposal.votingEndsAt} />}
              </div>
              <CardTitle className="text-xl line-clamp-2">{proposal.title}</CardTitle>
              <CardDescription className="mt-1">Proposed by {proposal.proposer.split(".")[0]}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description Preview */}
          <p className="text-sm text-muted-foreground line-clamp-3">{proposal.description}</p>

          {/* Vote Progress */}
          {voteCounts && (
            <VoteProgress
              voteCounts={voteCounts}
              quorumRequired={quorumRequired}
              totalCitizens={totalCitizens}
              quorumPercentage={proposal.quorumPercentage}
              showLabels={true}
            />
          )}

          {/* Discourse Link */}
          {proposal.discourseUrl && (
            <div className="pt-2 border-t">
              <a
                href={proposal.discourseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                View Discussion
              </a>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Created {new Date(proposal.createdAt).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
