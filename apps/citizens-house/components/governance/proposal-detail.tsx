"use client"

import { useEffect, useState, useTransition } from "react"
import { Button } from "@near-citizens/ui"
import { NEAR_CONFIG, useNearWallet } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { StatusBadge } from "./status-badge"
import { VoteProgressBar } from "./vote-progress-bar"
import { CountdownTimer } from "./countdown-timer"
import {
  buildCancelProposalTx,
  buildExpirePendingProposalTx,
  buildFinalizeProposalTx,
} from "@/lib/contracts/governance/transactions"
import { checkIsAdmin, revalidateGovernance } from "@/app/governance/actions"
import { trackEvent } from "@/lib/analytics"
import { MarkdownContent } from "./markdown-content"

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const month = months[date.getUTCMonth()]
  const day = date.getUTCDate()
  const year = date.getUTCFullYear()
  const hours = date.getUTCHours()
  const minutes = date.getUTCMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${month} ${day}, ${year}, ${hour12}:${minutes} ${ampm} UTC`
}

interface ProposalProps {
  proposal: ProposalView
}

export function ProposalHeader({ proposal }: ProposalProps) {
  const [now] = useState(Date.now)
  const isScheduled = proposal.status === "active" && proposal.startAt > now
  const isFinished = proposal.status === "active" && proposal.endsAt < now
  const displayStatus = isScheduled ? "scheduled" : isFinished ? "finished" : proposal.status

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={displayStatus} failureKind={proposal.failureKind} />
        <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">#{proposal.id}</span>
      </div>
      <h1 className="font-fk-grotesk font-medium text-[28px] md:text-[36px] leading-[32px] md:leading-[40px] text-black dark:text-white">
        {proposal.title}
      </h1>
      <div className="flex items-center gap-2 text-[14px] font-inter text-[#64748b] dark:text-[#94a3b8]">
        <span>by {proposal.author}</span>
        <span>·</span>
        <a
          href={NEAR_CONFIG.explorerAccountUrl(proposal.creator)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:underline"
        >
          <MiddleTruncate text={proposal.creator} className="max-w-[140px]" />
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
    </div>
  )
}

export function ProposalDescription({ proposal }: ProposalProps) {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <MarkdownContent>{proposal.description}</MarkdownContent>
    </div>
  )
}

export function VotingProgressCard({ proposal }: ProposalProps) {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-4">Voting Progress</h3>
      <VoteProgressBar
        yesVotes={proposal.yesVotes}
        noVotes={proposal.noVotes}
        quorumBps={proposal.quorumBps}
        snapshotVerifiedCount={proposal.snapshotVerifiedCount}
      />
      {proposal.pendingVoteCount > 0 && (
        <p className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter mt-2">
          {proposal.pendingVoteCount} vote(s) pending verification
        </p>
      )}
    </div>
  )
}

export function ProposalTimeline({ proposal }: ProposalProps) {
  const [now] = useState(Date.now)
  const isScheduled = proposal.status === "active" && proposal.startAt > now

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-4">Timeline</h3>
      <div className="flex flex-col gap-2 text-[13px] font-inter text-[#475569] dark:text-[#94a3b8]">
        <div className="flex justify-between">
          <span>Created</span>
          <span>{formatDate(proposal.createdAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Voting starts</span>
          <span>{formatDate(proposal.startAt)}</span>
        </div>
        <div className="flex justify-between">
          <span>Voting ends</span>
          <span>{formatDate(proposal.endsAt)}</span>
        </div>
        {isScheduled ? (
          <div className="flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-white/10 mt-1">
            <span className="font-medium text-black dark:text-white">Voting starts in</span>
            <CountdownTimer targetMs={proposal.startAt} endedLabel="Starting..." />
          </div>
        ) : proposal.status === "active" ? (
          <div className="flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-white/10 mt-1">
            <span className="font-medium text-black dark:text-white">Time remaining</span>
            <CountdownTimer targetMs={proposal.endsAt} endedLabel="Voting ended" />
          </div>
        ) : proposal.status === "pending" ? (
          <div className="flex justify-between items-center pt-1 border-t border-[#e2e8f0] dark:border-white/10 mt-1">
            <span className="font-medium text-black dark:text-white">Starts in</span>
            <CountdownTimer targetMs={proposal.startAt} endedLabel="Starting..." />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function FinalizeButton({ proposal }: ProposalProps) {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [isPending, startTransition] = useTransition()
  const [txLoading, setTxLoading] = useState(false)

  if (proposal.status !== "active" || Date.now() <= proposal.endsAt) return null

  const loading = isPending || txLoading

  const handleFinalize = async () => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    try {
      await signAndSendTransaction(buildFinalizeProposalTx(proposal.id))
      trackEvent({
        domain: "governance",
        action: "proposal_finalize",
        proposalId: proposal.id,
        accountId,
      })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success("Proposal finalized successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  return (
    <Button variant="citizens-primary" size="citizens-lg" onClick={handleFinalize} disabled={loading || !isConnected}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Finalize Proposal
    </Button>
  )
}

export function ProposalAdminActions({ proposal }: ProposalProps) {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [isPending, startTransition] = useTransition()
  const [txLoading, setTxLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!isConnected || !accountId) return
    checkIsAdmin(accountId).then(setIsAdmin)
  }, [isConnected, accountId])

  if (!isAdmin) return null

  const handleAdminAction = async (action: "cancel" | "expire") => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    try {
      const tx = action === "cancel" ? buildCancelProposalTx(proposal.id) : buildExpirePendingProposalTx(proposal.id)
      await signAndSendTransaction(tx)
      trackEvent({
        domain: "governance",
        action: "proposal_cancel",
        proposalId: proposal.id,
        accountId,
      })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success(`Proposal ${action === "cancel" ? "cancelled" : "expired"} successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(false)
    }
  }

  const loading = isPending || txLoading

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-4">Admin Actions</h3>
      <div className="flex flex-wrap gap-3">
        {(proposal.status === "pending" || proposal.status === "active") && (
          <Button
            variant="citizens-outline"
            size="citizens-lg"
            onClick={() => handleAdminAction("cancel")}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancel Proposal
          </Button>
        )}
        {proposal.status === "pending" && Date.now() > proposal.pendingExpiresAt && (
          <Button
            variant="citizens-outline"
            size="citizens-lg"
            onClick={() => handleAdminAction("expire")}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Expire Pending
          </Button>
        )}
      </div>
    </div>
  )
}
