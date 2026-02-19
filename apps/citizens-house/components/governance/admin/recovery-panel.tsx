"use client"

import { useState, useEffect } from "react"
import { Button, Input, Label } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { buildClearStalePendingVoteTx, buildClearStaleBlocklistOpTx } from "@/lib/contracts/governance/transactions"
import { trackEvent } from "@/lib/analytics"
import {
  invalidateGovernanceCache,
  getBlocklistLockInfo,
  getPendingVotesCount,
  type BlocklistLockInfo,
} from "@/app/proposals/actions"

export function RecoveryPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [proposalId, setProposalId] = useState("")
  const [voteAccountId, setVoteAccountId] = useState("")
  const [txLoading, setTxLoading] = useState(false)

  // Pending vote count for the entered proposal
  const [pendingVoteCount, setPendingVoteCount] = useState<number | null>(null)
  const [pendingVoteLoading, setPendingVoteLoading] = useState(false)

  // Blocklist lock state
  const [lockInfo, setLockInfo] = useState<BlocklistLockInfo | null>(null)

  // Fetch pending vote count when proposal ID changes
  useEffect(() => {
    const id = parseInt(proposalId)
    if (isNaN(id) || id < 0) {
      setPendingVoteCount(null)
      return
    }
    setPendingVoteLoading(true)
    getPendingVotesCount(id).then((count) => {
      setPendingVoteCount(count)
      setPendingVoteLoading(false)
    })
  }, [proposalId])

  // Fetch blocklist lock state on mount
  useEffect(() => {
    getBlocklistLockInfo().then(setLockInfo)
  }, [])

  const loading = txLoading

  const handleClearPendingVote = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isConnected || !accountId || !proposalId || !voteAccountId.trim()) return

    const parsedProposalId = parseInt(proposalId)
    setTxLoading(true)
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "recovery",
      operation: "clear_stale_pending_vote",
      accountId,
      proposalId: parsedProposalId,
      targetAccountId: voteAccountId.trim(),
    })
    try {
      await signAndSendTransaction(buildClearStalePendingVoteTx(parsedProposalId, voteAccountId.trim()))
      await invalidateGovernanceCache({ op: "recovery_update", proposalId: parsedProposalId, accountId })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "recovery",
        operation: "clear_stale_pending_vote",
        outcome: "success",
        accountId,
        proposalId: parsedProposalId,
        targetAccountId: voteAccountId.trim(),
      })
      toast.success("Stale pending vote cleared")
      setProposalId("")
      setVoteAccountId("")
      setPendingVoteCount(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "recovery",
        operation: "clear_stale_pending_vote",
        outcome: "fail",
        accountId,
        proposalId: parsedProposalId,
        targetAccountId: voteAccountId.trim(),
        errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setTxLoading(false)
    }
  }

  const handleClearBlocklistOp = async () => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    trackEvent({
      domain: "governance",
      action: "admin_tx_submit",
      area: "recovery",
      operation: "clear_stale_blocklist_op",
      accountId,
    })
    try {
      await signAndSendTransaction(buildClearStaleBlocklistOpTx())
      await invalidateGovernanceCache({ op: "recovery_update", accountId })
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "recovery",
        operation: "clear_stale_blocklist_op",
        outcome: "success",
        accountId,
      })
      toast.success("Stale blocklist operation cleared")
      setLockInfo({ locked: false, hasActiveProposals: false })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      trackEvent({
        domain: "governance",
        action: "admin_tx_result",
        area: "recovery",
        operation: "clear_stale_blocklist_op",
        outcome: "fail",
        accountId,
        errorMessage,
      })
      toast.error(errorMessage)
    } finally {
      setTxLoading(false)
    }
  }

  const hasValidProposalId = proposalId !== "" && !isNaN(parseInt(proposalId)) && parseInt(proposalId) >= 0
  const noPendingVotes = hasValidProposalId && pendingVoteCount === 0

  return (
    <div className="flex flex-col gap-6">
      {/* Clear stale pending vote */}
      <div className="flex flex-col gap-3">
        <h4 className="font-fk-grotesk font-bold text-[14px] text-black dark:text-white">Clear Stale Pending Vote</h4>
        <p className="font-inter text-[12px] text-[#64748b] dark:text-[#94a3b8]">
          Remove a pending vote that got stuck due to a failed cross-contract callback. The voter&apos;s deposit (if
          any) will be refunded.
        </p>
        <form onSubmit={handleClearPendingVote} className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[12px]">Proposal ID</Label>
            <Input
              type="number"
              value={proposalId}
              onChange={(e) => setProposalId(e.target.value)}
              placeholder="0"
              className="h-8 text-sm"
            />
            {hasValidProposalId && !pendingVoteLoading && pendingVoteCount !== null && (
              <span
                className={`font-inter text-[11px] ${pendingVoteCount > 0 ? "text-[#f59e0b]" : "text-[#64748b] dark:text-[#94a3b8]"}`}
              >
                {pendingVoteCount} pending vote{pendingVoteCount !== 1 ? "s" : ""} on this proposal
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[12px]">Account ID</Label>
            <Input
              value={voteAccountId}
              onChange={(e) => setVoteAccountId(e.target.value)}
              placeholder="account.near"
              className="h-8 text-sm"
            />
          </div>
          <Button
            variant="citizens-outline"
            size="sm"
            type="submit"
            disabled={loading || !hasValidProposalId || !voteAccountId.trim() || noPendingVotes}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Clear Pending Vote
          </Button>
          {noPendingVotes && (
            <span className="font-inter text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              No pending votes to clear on this proposal.
            </span>
          )}
        </form>
      </div>

      <hr className="border-[#e2e8f0] dark:border-white/10" />

      {/* Clear stale blocklist op */}
      <div className="flex flex-col gap-3">
        <h4 className="font-fk-grotesk font-bold text-[14px] text-black dark:text-white">
          Clear Stale Blocklist Operation
        </h4>
        <p className="font-inter text-[12px] text-[#64748b] dark:text-[#94a3b8]">
          Unlock the blocklist if a cross-contract callback failed during a blocklist operation. Does not change the
          blocklist itself.
        </p>
        <Button
          variant="citizens-outline"
          size="sm"
          onClick={handleClearBlocklistOp}
          disabled={loading || !lockInfo?.locked || lockInfo?.hasActiveProposals}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Clear Blocklist Lock
        </Button>
        {lockInfo && !lockInfo.locked && (
          <span className="font-inter text-[11px] text-[#64748b] dark:text-[#94a3b8]">
            No pending blocklist operation to clear.
          </span>
        )}
        {lockInfo?.locked && lockInfo.hasActiveProposals && (
          <span className="font-inter text-[11px] text-[#64748b] dark:text-[#94a3b8]">
            Blocklist is locked by active proposals, not a pending operation.
          </span>
        )}
      </div>
    </div>
  )
}
