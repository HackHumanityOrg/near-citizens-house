"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import type { ProposalView, VoteChoice, VoteView } from "@/lib/schemas/governance-contract"
import type { TransformedVerificationSummary } from "@/lib/schemas/verification-contract"
import { buildCastVoteTx } from "@/lib/contracts/governance/transactions"
import {
  checkHasVoted,
  getVote,
  checkIsVoteFree,
  checkAccountBalance,
  checkIsBlocklisted,
  revalidateGovernance,
} from "@/app/governance/actions"
import { getVerificationSummary } from "@/app/citizens/actions"
import { NEAR_CONFIG } from "@/lib/config"
import { encodeSignedDelegate } from "@near-js/transactions"
import { GAS_100_TGAS } from "@/lib/contracts/gas"
import {
  getTransactionFailureMessage,
  getVoteRejectionReasonMessage,
  isVoteRejectionReason,
  parseGovernanceVoteOutcome,
  resolveGovernanceVoteOutcome,
  type GovernanceVoteOutcome,
} from "@/lib/contracts/governance/vote-outcome"

interface Props {
  proposal: ProposalView
}

// Minimum balance to cover gas (~0.01 NEAR in yoctoNEAR)
const MIN_GAS_BALANCE = BigInt("10000000000000000000000")

interface EligibilityResult {
  accountId: string
  existingVote: VoteView | null
  verification: TransformedVerificationSummary | null
  isBlocklisted: boolean
  isVoteFree: boolean
  balance: string
}

function getVoteOutcomeToast(
  outcome: GovernanceVoteOutcome,
  choice: VoteChoice,
): { type: "success" | "error" | "warning"; message: string } {
  if (outcome.kind === "vote_cast") {
    return { type: "success", message: `Vote "${outcome.choice ?? choice}" cast successfully` }
  }

  if (outcome.kind === "vote_rejected") {
    return { type: "error", message: getVoteRejectionReasonMessage(outcome.reason) }
  }

  if (outcome.kind === "tx_failed") {
    return { type: "error", message: getTransactionFailureMessage(outcome.error) }
  }

  return { type: "warning", message: "Vote submitted, but the final outcome could not be confirmed." }
}

export function VotePanel({ proposal }: Props) {
  const {
    accountId,
    walletName,
    isConnected,
    connect,
    signAndSendTransaction,
    signDelegateActions,
    supportsMetaTransactions,
  } = useNearWallet()
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null)
  const [txLoading, setTxLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!isConnected || !accountId) return

    Promise.all([
      checkHasVoted(proposal.id, accountId).then((voted) => (voted ? getVote(proposal.id, accountId) : null)),
      getVerificationSummary(accountId),
      checkIsBlocklisted(accountId),
      checkIsVoteFree(),
      checkAccountBalance(accountId),
    ]).then(([vote, verification, isBlocklisted, voteFree, balance]) => {
      setEligibility({ accountId, existingVote: vote, verification, isBlocklisted, isVoteFree: voteFree, balance })
    })
  }, [isConnected, accountId, proposal.id])

  // Derive current state — stale results for a different account are ignored
  const current = eligibility?.accountId === accountId ? eligibility : null
  const checking = isConnected && !!accountId && !current
  const existingVote = current?.existingVote ?? null
  const verification = current?.verification ?? null
  const isVerified = verification !== null
  const isVerifiedAfterProposalCreation = verification ? verification.verifiedAt > proposal.createdAt : false
  const isBlocklisted = current?.isBlocklisted ?? false
  const isVoteFree = current?.isVoteFree ?? false
  const isZeroBalance = current ? BigInt(current.balance) < MIN_GAS_BALANCE : false
  const needsRelay = isZeroBalance && isVoteFree && supportsMetaTransactions

  const handleVote = async (choice: VoteChoice) => {
    if (!isConnected || !accountId) return

    setTxLoading(true)
    try {
      let voteOutcome: GovernanceVoteOutcome = { kind: "unknown" }

      if (needsRelay && signDelegateActions) {
        // Meta-transaction path: wallet signs a DelegateAction, relayer pays gas
        const contractId = NEAR_CONFIG.governanceContractId
        if (!contractId) throw new Error("Governance contract not configured")

        const results = await signDelegateActions({
          delegateActions: [
            {
              receiverId: contractId,
              actions: [
                {
                  type: "FunctionCall",
                  params: {
                    methodName: "cast_vote",
                    args: { proposal_id: proposal.id, choice },
                    gas: GAS_100_TGAS,
                    deposit: "0",
                  },
                },
              ],
            },
          ],
        })

        const encoded = encodeSignedDelegate(results[0].signedDelegate)
        const res = await fetch("/api/governance/relay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedDelegate: Buffer.from(encoded).toString("base64") }),
        })

        const relayBody = await res.json().catch(() => null)
        if (!res.ok) {
          const relayError = relayBody as { error?: unknown; reason?: unknown } | null
          const reason = typeof relayError?.reason === "string" ? relayError.reason : null

          if (reason && isVoteRejectionReason(reason)) {
            toast.error(getVoteRejectionReasonMessage(reason))
          } else {
            const message = typeof relayError?.error === "string" ? relayError.error : `Relay failed (${res.status})`
            toast.error(message)
          }
          return
        }

        const relayResponse = relayBody as { outcome?: unknown } | null
        voteOutcome = parseGovernanceVoteOutcome(relayResponse?.outcome) ?? { kind: "unknown" }
      } else {
        // Direct transaction path
        const deposit = isVoteFree ? "0" : "10000000000000000000000" // 0.01 NEAR storage deposit
        const result = await signAndSendTransaction(buildCastVoteTx(proposal.id, choice, deposit))
        voteOutcome = resolveGovernanceVoteOutcome(result)
      }

      const voteToast = getVoteOutcomeToast(voteOutcome, choice)
      if (voteToast.type === "success") {
        toast.success(voteToast.message)
      } else if (voteToast.type === "error") {
        toast.error(voteToast.message)
      } else {
        toast.warning(voteToast.message)
      }

      if (voteOutcome.kind !== "tx_failed") {
        startTransition(() => {
          revalidateGovernance()
        })
        // Refresh vote state
        const vote = await getVote(proposal.id, accountId)
        setEligibility((prev) => (prev ? { ...prev, existingVote: vote } : null))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      toast.error(getTransactionFailureMessage(errorMessage))
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

  // Active but voting period has passed (not yet finalized)
  if (proposal.endsAt <= Date.now()) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Voting</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">Voting has ended for this proposal.</p>
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

  if (isBlocklisted) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Cast Your Vote</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
          Your account is blocklisted and cannot vote on proposals.
        </p>
      </div>
    )
  }

  // Not verified
  if (!isVerified) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Cast Your Vote</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
          Only verified accounts can vote. Please complete identity verification first.
        </p>
      </div>
    )
  }

  if (isVerifiedAfterProposalCreation) {
    return (
      <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">Cast Your Vote</h3>
        <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
          You were verified after this proposal was created, so this vote is not eligible.
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
      {needsRelay ? (
        <p className="font-inter text-[11px] text-[#22c55e] mt-2">Gas sponsored — no NEAR required</p>
      ) : isZeroBalance && isVoteFree && !supportsMetaTransactions ? (
        <p className="font-inter text-[11px] text-[#f59e0b] mt-2">
          {walletName ?? "Your wallet"} doesn&apos;t support gasless voting. Please add NEAR for gas fees or switch to
          Meteor Wallet.
        </p>
      ) : !isVoteFree ? (
        <p className="font-inter text-[11px] text-[#94a3b8] mt-2">
          A small storage deposit (0.01 NEAR) is required for your vote.
        </p>
      ) : null}
    </div>
  )
}
