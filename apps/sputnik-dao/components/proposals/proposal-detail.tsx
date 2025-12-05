import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@near-citizens/ui"
import {
  type SputnikProposal,
  type SputnikVote,
  type TransformedPolicy,
  getProposalKindLabel,
} from "@near-citizens/shared"
import { ProposalStatusBadge } from "./proposal-status-badge"
import { VoteProgress } from "./vote-progress"
import { VoteButton } from "./vote-button"
import { FinalizeButton } from "./finalize-button"
import { Clock, User, Hash, Timer, AlertTriangle } from "lucide-react"

interface ProposalDetailProps {
  proposal: SputnikProposal
  policy: TransformedPolicy
  userVote: SputnikVote | null
  canVote: boolean
  isConnected: boolean
  onVoteSuccess: () => void
}

/**
 * Calculate voting requirements based on policy
 */
function calculateVotingRequirements(policy: TransformedPolicy, proposalKind: string) {
  // Find the citizen role (or the role that votes on this proposal type)
  const citizenRole = policy.roles.find((r) => r.name === "citizen")
  if (!citizenRole) {
    return null
  }

  // Get role size (number of members)
  const roleKind = citizenRole.kind
  let totalMembers = 0
  if (typeof roleKind === "object" && "Group" in roleKind) {
    totalMembers = roleKind.Group.length
  }

  // Get vote policy for this proposal kind, or use default
  const votePolicy = citizenRole.votePolicy?.[proposalKind] || policy.defaultVotePolicy

  // Parse quorum (minimum votes required)
  const quorum = parseInt(votePolicy.quorum, 10)

  // Parse threshold
  let thresholdVotes = 0
  const threshold = votePolicy.threshold
  if (Array.isArray(threshold)) {
    // Ratio: [num, denom] means > num/denom of total
    const [num, denom] = threshold
    thresholdVotes = Math.min(Math.floor((num * totalMembers) / denom) + 1, totalMembers)
  } else if (typeof threshold === "object" && "Weight" in threshold) {
    // Fixed weight
    thresholdVotes = parseInt(threshold.Weight, 10)
  }

  // Effective threshold is max(quorum, threshold)
  const effectiveThreshold = Math.max(quorum, thresholdVotes)

  return {
    totalMembers,
    quorum,
    thresholdVotes,
    effectiveThreshold,
    thresholdRatio: Array.isArray(threshold) ? threshold : null,
  }
}

export function ProposalDetail({
  proposal,
  policy,
  userVote,
  canVote,
  isConnected,
  onVoteSuccess,
}: ProposalDetailProps) {
  const kindLabel = getProposalKindLabel(proposal.kind)
  const submittedDate = new Date(proposal.submissionTime).toLocaleDateString()
  const isInProgress = proposal.status === "InProgress"
  const isVoteProposal = proposal.kind === "Vote"

  // Calculate expiration time
  const expirationTime = proposal.submissionTime + policy.proposalPeriodMs
  const now = Date.now()
  const isExpired = now > expirationTime
  const timeRemaining = expirationTime - now

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Expired"
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h remaining`
    }
    if (hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
  }

  // Get proposal kind label for policy lookup
  const proposalKindLabel =
    proposal.kind === "Vote"
      ? "vote"
      : typeof proposal.kind === "object" && "AddMemberToRole" in proposal.kind
        ? "add_member_to_role"
        : typeof proposal.kind === "object" && "RemoveMemberFromRole" in proposal.kind
          ? "remove_member_from_role"
          : typeof proposal.kind === "object" && "ChangePolicyAddOrUpdateRole" in proposal.kind
            ? "policy_add_or_update_role"
            : "vote"

  // Calculate voting requirements
  const votingReqs = calculateVotingRequirements(policy, proposalKindLabel)

  // Can finalize if expired or failed
  const canFinalize = proposal.status === "InProgress" && isExpired

  return (
    <div className="space-y-6">
      {/* Main Proposal Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <ProposalStatusBadge status={proposal.status} />
                <Badge variant="outline" className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {proposal.id}
                </Badge>
                {!isVoteProposal && <Badge variant="secondary">{kindLabel}</Badge>}
              </div>
              <CardTitle className="text-2xl mb-2">{isVoteProposal ? "Vote Proposal" : kindLabel}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {proposal.proposer}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {submittedDate}
                </span>
                {isInProgress && (
                  <span
                    className={`flex items-center gap-1 font-medium ${isExpired ? "text-destructive" : timeRemaining < 3600000 ? "text-orange-500" : "text-blue-500"}`}
                  >
                    <Timer className="h-4 w-4" />
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                )}
              </div>
            </div>

            {/* Voting Stats - Right side on desktop */}
            {votingReqs && (
              <TooltipProvider>
                <div className="flex gap-4 items-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center cursor-help">
                        <div className="text-2xl font-bold text-green-600">{proposal.totalApprove}</div>
                        <div className="text-xs text-muted-foreground">Approvals</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Number of citizens who voted to approve this proposal</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className="text-muted-foreground">/</div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center cursor-help">
                        <div className="text-2xl font-bold">{votingReqs.effectiveThreshold}</div>
                        <div className="text-xs text-muted-foreground">Required</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-left">
                      <p className="font-medium mb-1">Votes required to pass</p>
                      <p className="text-xs opacity-90">
                        Calculated as max(quorum, threshold).
                        {votingReqs.thresholdRatio && (
                          <>
                            {" "}
                            Threshold is {votingReqs.thresholdRatio[0]}/{votingReqs.thresholdRatio[1]} (
                            {Math.round((votingReqs.thresholdRatio[0] / votingReqs.thresholdRatio[1]) * 100)}%) of{" "}
                            {votingReqs.totalMembers} citizens = {votingReqs.thresholdVotes} votes.
                          </>
                        )}
                        {votingReqs.quorum > 0 && (
                          <>
                            {" "}
                            Quorum is {votingReqs.quorum} (7% of {votingReqs.totalMembers} citizens, rounded up).
                          </>
                        )}{" "}
                        The higher value ({votingReqs.effectiveThreshold}) applies.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center pl-2 border-l cursor-help">
                        <div className="text-2xl font-bold">{votingReqs.totalMembers}</div>
                        <div className="text-xs text-muted-foreground">Citizens</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Total verified citizens who can vote on proposals</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
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
          {typeof proposal.kind === "object" && "AddMemberToRole" in proposal.kind && (
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
          {typeof proposal.kind === "object" && "RemoveMemberFromRole" in proposal.kind && (
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
              <p className="text-sm text-muted-foreground">Voting has ended. Final status: {proposal.status}</p>
            ) : canFinalize ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-orange-500">
                  <AlertTriangle className="h-4 w-4" />
                  <span>This proposal has expired and needs to be finalized.</span>
                </div>
                <FinalizeButton
                  proposalId={proposal.id}
                  proposalKind={proposal.kind}
                  onFinalizeSuccess={onVoteSuccess}
                />
              </div>
            ) : !canVote && !userVote ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to vote on this proposal. Only members with the appropriate role can
                vote.
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
