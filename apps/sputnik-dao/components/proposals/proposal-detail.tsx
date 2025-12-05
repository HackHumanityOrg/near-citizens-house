import { Card, CardHeader, CardTitle, CardContent, Badge } from "@near-citizens/ui"
import { type SputnikProposal, type SputnikVote, getProposalKindLabel } from "@near-citizens/shared"
import { ProposalStatusBadge } from "./proposal-status-badge"
import { VoteProgress } from "./vote-progress"
import { VoteButton } from "./vote-button"
import { Clock, User, Hash } from "lucide-react"

interface ProposalDetailProps {
  proposal: SputnikProposal
  userVote: SputnikVote | null
  canVote: boolean
  isConnected: boolean
  onVoteSuccess: () => void
}

export function ProposalDetail({
  proposal,
  userVote,
  canVote,
  isConnected,
  onVoteSuccess,
}: ProposalDetailProps) {
  const kindLabel = getProposalKindLabel(proposal.kind)
  const submittedDate = new Date(proposal.submissionTime).toLocaleDateString()
  const submittedTime = new Date(proposal.submissionTime).toLocaleTimeString()
  const isInProgress = proposal.status === "InProgress"
  const isVoteProposal = "Vote" in proposal.kind

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <ProposalStatusBadge status={proposal.status} />
                <Badge variant="outline" className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {proposal.id}
                </Badge>
                {!isVoteProposal && (
                  <Badge variant="secondary">{kindLabel}</Badge>
                )}
              </div>
              <CardTitle className="text-2xl mb-2">
                {isVoteProposal ? "Vote Proposal" : kindLabel}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Proposed by {proposal.proposer}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {submittedDate} at {submittedTime}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <p className="whitespace-pre-wrap">{proposal.description}</p>
            </div>
          </div>

          {/* Member details for AddMemberToRole */}
          {"AddMemberToRole" in proposal.kind && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Member Addition Details</h4>
              <p className="text-sm">
                <span className="text-muted-foreground">Account: </span>
                <code className="bg-background px-1 rounded">{proposal.kind.AddMemberToRole.member_id}</code>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Role: </span>
                <code className="bg-background px-1 rounded">{proposal.kind.AddMemberToRole.role}</code>
              </p>
            </div>
          )}

          {/* Member details for RemoveMemberFromRole */}
          {"RemoveMemberFromRole" in proposal.kind && (
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Member Removal Details</h4>
              <p className="text-sm">
                <span className="text-muted-foreground">Account: </span>
                <code className="bg-background px-1 rounded">{proposal.kind.RemoveMemberFromRole.member_id}</code>
              </p>
              <p className="text-sm">
                <span className="text-muted-foreground">Role: </span>
                <code className="bg-background px-1 rounded">{proposal.kind.RemoveMemberFromRole.role}</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voting Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Voting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vote Progress */}
          <VoteProgress
            totalApprove={proposal.totalApprove}
            totalReject={proposal.totalReject}
            totalRemove={proposal.totalRemove}
            totalVotes={proposal.totalVotes}
            showLabels={true}
          />

          {/* Vote Button or Status */}
          <div className="pt-4 border-t">
            {!isConnected ? (
              <p className="text-sm text-muted-foreground">Connect your wallet to vote</p>
            ) : !isInProgress ? (
              <p className="text-sm text-muted-foreground">
                Voting has ended. Final status: {proposal.status}
              </p>
            ) : !canVote && !userVote ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to vote on this proposal.
                Only members with the appropriate role can vote.
              </p>
            ) : (
              <VoteButton
                proposalId={proposal.id}
                proposalKind={proposal.kind}
                currentVote={userVote}
                disabled={!canVote}
                onVoteSuccess={onVoteSuccess}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vote Details Card */}
      {proposal.totalVotes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vote Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(proposal.votes).map(([accountId, vote]) => (
                <div key={accountId} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{accountId}</span>
                  <Badge
                    variant="outline"
                    className={
                      vote === "Approve"
                        ? "text-green-600 border-green-600"
                        : vote === "Reject"
                          ? "text-red-600 border-red-600"
                          : "text-orange-600 border-orange-600"
                    }
                  >
                    {vote}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
