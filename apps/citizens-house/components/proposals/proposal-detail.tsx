"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@near-citizens/ui"
import { type Proposal, type VoteCounts, type Vote } from "@near-citizens/shared"
import { ProposalStatusBadge } from "./proposal-status-badge"
import { CountdownTimer } from "../shared/countdown-timer"
import { VoteProgress } from "../shared/vote-progress"
import { VoteButton } from "./vote-button"
import { ExternalLink, Calendar, User } from "lucide-react"

interface ProposalDetailProps {
  proposal: Proposal
  voteCounts: VoteCounts
  quorumRequired: number
  totalCitizens: number
  userVote?: Vote | null
  canVote: boolean
  onVoteSuccess?: () => void
}

export function ProposalDetail({
  proposal,
  voteCounts,
  quorumRequired,
  totalCitizens,
  userVote,
  canVote,
  onVoteSuccess,
}: ProposalDetailProps) {
  const isActive = proposal.status === "Active"
  const hasEnded = Date.now() >= proposal.votingEndsAt

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <ProposalStatusBadge status={proposal.status} />
                {isActive && !hasEnded && <CountdownTimer endTime={proposal.votingEndsAt} />}
              </div>
              <CardTitle className="text-3xl mb-2">{proposal.title}</CardTitle>
              <CardDescription className="flex items-center gap-4 flex-wrap text-base">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {proposal.proposer}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(proposal.createdAt).toLocaleDateString()}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{proposal.description}</div>
          </div>

          {/* Discourse Link */}
          {proposal.discourseUrl && (
            <div>
              <h3 className="font-semibold mb-2">Discussion</h3>
              <a
                href={proposal.discourseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View on Discourse Forum
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voting Card */}
      <Card>
        <CardHeader>
          <CardTitle>Voting</CardTitle>
          <CardDescription>
            {isActive && !hasEnded ? "Cast your vote on this proposal" : "Voting has ended"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Vote Progress */}
          <VoteProgress
            voteCounts={voteCounts}
            quorumRequired={quorumRequired}
            totalCitizens={totalCitizens}
            quorumPercentage={proposal.quorumPercentage}
            showLabels={true}
          />

          {/* Voting Buttons */}
          {isActive && !hasEnded && (
            <div>
              {canVote ? (
                <VoteButton proposalId={proposal.id} currentVote={userVote} onVoteSuccess={onVoteSuccess} />
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>You must be a verified citizen to vote</p>
                </div>
              )}
            </div>
          )}

          {/* Final Results */}
          {!isActive && (
            <div className="pt-4 border-t">
              <h3 className="font-semibold mb-2">Final Results</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{voteCounts.yesVotes}</div>
                  <div className="text-sm text-muted-foreground">Yes</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{voteCounts.noVotes}</div>
                  <div className="text-sm text-muted-foreground">No</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground">{voteCounts.abstainVotes}</div>
                  <div className="text-sm text-muted-foreground">Abstain</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Proposal ID</dt>
              <dd className="font-medium">#{proposal.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">{new Date(proposal.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Voting Ends</dt>
              <dd className="font-medium">{new Date(proposal.votingEndsAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <ProposalStatusBadge status={proposal.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quorum Requirement</dt>
              <dd className="font-medium">
                {proposal.quorumPercentage}% ({quorumRequired} votes)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Citizens</dt>
              <dd className="font-medium">{totalCitizens}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
