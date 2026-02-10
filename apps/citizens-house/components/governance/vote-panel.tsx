"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import type { ProposalView, VoteChoice, VoteView } from "@/lib/schemas/governance-contract"
import { buildCastVoteTx } from "@/lib/contracts/governance/transactions"
import { checkHasVoted, getVote, checkIsVoteFree, revalidateGovernance } from "@/app/governance/actions"
import { checkIsVerified } from "@/app/citizens/actions"
import { trackEvent } from "@/lib/analytics"

interface Props {
  proposal: ProposalView
}

interface EligibilityResult {
  accountId: string
  existingVote: VoteView | null
  isVerified: boolean
  isVoteFree: boolean
}

export function VotePanel({ proposal }: Props) {
  const { accountId, isConnected, connect, signAndSendTransaction } = useNearWallet()
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null)
  const [txLoading, setTxLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!isConnected || !accountId) return

    Promise.all([
      checkHasVoted(proposal.id, accountId).then((voted) => (voted ? getVote(proposal.id, accountId) : null)),
      checkIsVerified(accountId),
      checkIsVoteFree(),
    ]).then(([vote, verified, voteFree]) => {
      setEligibility({ accountId, existingVote: vote, isVerified: verified, isVoteFree: voteFree })
    })
  }, [isConnected, accountId, proposal.id])

  // Derive current state — stale results for a different account are ignored
  const current = eligibility?.accountId === accountId ? eligibility : null
  const checking = isConnected && !!accountId && !current
  const existingVote = current?.existingVote ?? null
  const isVerified = current ? current.isVerified : null
  const isVoteFree = current?.isVoteFree ?? false

  const handleVote = async (choice: VoteChoice) => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    try {
      const deposit = isVoteFree ? "0" : "10000000000000000000000" // 0.01 NEAR storage deposit
      await signAndSendTransaction(buildCastVoteTx(proposal.id, choice, deposit))
      trackEvent({ domain: "governance", action: "vote_cast", proposalId: proposal.id, choice, accountId })
      startTransition(() => {
        revalidateGovernance()
      })
      toast.success(`Vote "${choice}" cast successfully`)
      // Refresh vote state
      const vote = await getVote(proposal.id, accountId)
      setEligibility((prev) => (prev ? { ...prev, existingVote: vote } : null))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      trackEvent({ domain: "governance", action: "vote_cast_fail", proposalId: proposal.id, errorMessage, accountId })
      toast.error(errorMessage)
    } finally {
      setTxLoading(false)
    }
  }

  const loading = txLoading || isPending || checking

  // Not connected
  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Cast Your Vote</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8] mb-4">
          Connect your wallet to vote on this proposal.
        </p>
        <Button variant="citizens-primary" size="citizens-lg" onClick={connect}>
          Connect Wallet
        </Button>
      </div>
    )
  }

  // Proposal not active
  if (proposal.status !== "active") {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Voting</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
          {proposal.status === "pending" ? "Voting has not started yet." : "Voting has ended for this proposal."}
        </p>
      </div>
    )
  }

  // Active but voting hasn't started yet (scheduled)
  if (proposal.startAt > Date.now()) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Voting</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
          Voting has not started yet. Scheduled to open on{" "}
          {new Date(proposal.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{" "}
          UTC.
        </p>
      </div>
    )
  }

  // Loading state
  if (checking) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Cast Your Vote</h3>
        <div className="flex items-center gap-2 text-[#64748b]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-inter text-[14px]">Checking eligibility...</span>
        </div>
      </div>
    )
  }

  // Already voted
  if (existingVote) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Your Vote</h3>
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-[#22c55e]" />
          <span className="font-inter text-[14px] text-[#334155] dark:text-[#cbd5e1]">
            You voted{" "}
            <strong className={existingVote.choice === "yes" ? "text-[#22c55e]" : "text-[#ef4444]"}>
              {existingVote.choice.toUpperCase()}
            </strong>
          </span>
        </div>
      </div>
    )
  }

  // Not verified
  if (isVerified === false) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Cast Your Vote</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
          Only verified accounts can vote. Please complete identity verification first.
        </p>
      </div>
    )
  }

  // Vote buttons
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-4">Cast Your Vote</h3>
      <div className="flex gap-3">
        <Button
          className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-fk-grotesk font-bold"
          size="citizens-lg"
          onClick={() => handleVote("yes")}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Yes
        </Button>
        <Button
          className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-fk-grotesk font-bold"
          size="citizens-lg"
          onClick={() => handleVote("no")}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          No
        </Button>
      </div>
      {!isVoteFree && (
        <p className="font-inter text-[11px] text-[#94a3b8] mt-2">
          A small storage deposit (0.01 NEAR) is required for your vote.
        </p>
      )}
    </div>
  )
}
