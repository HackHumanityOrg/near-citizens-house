"use client"

import { useState, useEffect, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import type { ProposalView, VoteChoice, VoteView } from "@/lib/schemas/governance-contract"
import type { TransformedVerificationSummary } from "@/lib/schemas/verification-contract"
import { formatUtcDate } from "@/lib/governance-dates"
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
import type { OptimisticVote, VoteLifecyclePayload } from "./optimistic-vote"
import { VOTE_CHOICE_COLOR_TOKENS, VOTE_POSITIVE_TEXT_CLASS } from "./vote-colors"
import { deriveVotePanelState } from "./vote-panel-state"

interface Props {
  proposal: ProposalView
  optimisticVote?: OptimisticVote | null
  onVoteProcessing?: (payload: VoteLifecyclePayload) => void
  onVoteSuccess?: (payload: VoteLifecyclePayload) => void
  onVoteFailure?: () => void
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

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getVoteOutcomeToast(
  outcome: GovernanceVoteOutcome,
  choice: VoteChoice,
): { type: "success" | "error"; message: string } {
  if (outcome.kind === "vote_cast") {
    return { type: "success", message: `Vote "${outcome.choice ?? choice}" cast successfully` }
  }

  if (outcome.kind === "vote_rejected") {
    return { type: "error", message: getVoteRejectionReasonMessage(outcome.reason) }
  }

  if (outcome.kind === "tx_failed") {
    return { type: "error", message: getTransactionFailureMessage(outcome.error) }
  }

  return { type: "error", message: "Vote outcome could not be confirmed. Please refresh and check again." }
}

function VotePanelSkeletonState({ title, withActions }: { title: string; withActions: boolean }) {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">{title}</h3>

      {withActions ? (
        <>
          <div className="flex gap-3">
            <Skeleton className="h-[36px] flex-1 rounded-[4px]" />
            <Skeleton className="h-[36px] flex-1 rounded-[4px]" />
          </div>
          <Skeleton className="h-[16px] w-[190px] mt-3" />
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-[20px] w-[85%]" />
          <Skeleton className="h-[20px] w-[66%]" />
        </div>
      )}
    </div>
  )
}

function VotePanelCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] p-6">
      <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white mb-3">{title}</h3>
      {children}
    </div>
  )
}

function ConfirmedVoteMessage({ choice }: { choice: VoteChoice }) {
  return (
    <div className="flex items-center gap-2">
      <Check className={`h-5 w-5 ${VOTE_POSITIVE_TEXT_CLASS}`} />
      <span className="font-inter text-[14px] text-[#334155] dark:text-[#cbd5e1]">
        You voted <strong className={VOTE_CHOICE_COLOR_TOKENS[choice].actionText}>{choice.toUpperCase()}</strong>
      </span>
    </div>
  )
}

export function VotePanel({ proposal, optimisticVote, onVoteProcessing, onVoteSuccess, onVoteFailure }: Props) {
  const router = useRouter()
  const { accountId, walletName, isConnected, signAndSendTransaction, signDelegateActions, supportsMetaTransactions } =
    useNearWallet()
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

  useEffect(() => {
    if (!isConnected || !accountId) return

    let cancelled = false

    getVote(proposal.id, accountId)
      .then((vote) => {
        if (cancelled || !vote) return

        setEligibility((prev) => {
          if (!prev || prev.accountId !== accountId) return prev
          if (prev.existingVote?.choice === vote.choice && prev.existingVote.votedAt === vote.votedAt) return prev
          return { ...prev, existingVote: vote }
        })
      })
      .catch((error) => {
        console.error("[vote-panel] Failed to sync vote state from server:", error)
      })

    return () => {
      cancelled = true
    }
  }, [isConnected, accountId, proposal.id, proposal.yesVotes, proposal.noVotes])

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
  const optimisticForCurrentAccount =
    optimisticVote && accountId && optimisticVote.proposalId === proposal.id && optimisticVote.voter === accountId
      ? optimisticVote
      : null
  const optimisticPendingChoice =
    optimisticForCurrentAccount?.status === "pending" ? optimisticForCurrentAccount.choice : null
  const confirmedChoice =
    existingVote?.choice ??
    (optimisticForCurrentAccount?.status === "confirmed" ? optimisticForCurrentAccount.choice : null)
  const now = Date.now()
  const panelState = deriveVotePanelState({
    proposal,
    now,
    isConnected,
    checking,
    optimisticPendingChoice,
    confirmedChoice,
    isBlocklisted,
    isVerified,
    isVerifiedAfterProposalCreation,
  })

  const handleVote = async (choice: VoteChoice) => {
    if (!isConnected || !accountId) return

    const voteLifecyclePayload: VoteLifecyclePayload = {
      proposalId: proposal.id,
      voter: accountId,
      choice,
      votedAt: Date.now(),
    }

    setTxLoading(true)
    let pendingToastId: string | number | null = null

    const startProcessingFeedback = () => {
      onVoteProcessing?.(voteLifecyclePayload)
      pendingToastId = toast.loading("Vote submitted. Processing on-chain...", {
        duration: Infinity,
        className: "!bg-[#f1f5f9] !text-[#0f172a] dark:!bg-[#334155] dark:!text-[#e2e8f0]",
        icon: <Loader2 className="h-4 w-4 animate-spin text-[#475569] dark:text-[#cbd5e1]" />,
      })
    }
    const safeRefreshGovernanceView = async () => {
      try {
        await revalidateGovernance()
      } catch (error) {
        console.error("[vote-panel] Failed to revalidate governance cache after vote:", error)
      } finally {
        startTransition(() => {
          router.refresh()
        })
      }
    }
    const syncVoteFromChain = async (targetAccountId: string, attempts: number) => {
      let syncedVote: VoteView | null = null

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          syncedVote = await getVote(proposal.id, targetAccountId)
        } catch (error) {
          console.error("[vote-panel] Failed to fetch vote state after submission:", error)
          syncedVote = null
        }

        if (syncedVote) break
        if (attempt < attempts - 1) {
          await wait(250 * (attempt + 1))
        }
      }

      if (syncedVote) {
        setEligibility((prev) => {
          if (!prev || prev.accountId !== targetAccountId) return prev
          if (
            prev.existingVote?.choice === syncedVote.choice &&
            prev.existingVote.votedAt === syncedVote.votedAt &&
            prev.existingVote.voter === syncedVote.voter
          ) {
            return prev
          }
          return { ...prev, existingVote: syncedVote }
        })
      }

      return syncedVote
    }

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
        const signedDelegate = results[0]?.signedDelegate
        if (!signedDelegate) throw new Error("Wallet did not return a signed delegate action")

        startProcessingFeedback()
        const encoded = encodeSignedDelegate(signedDelegate)
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
            if (pendingToastId !== null) toast.dismiss(pendingToastId)
            toast.error(getVoteRejectionReasonMessage(reason))
          } else {
            const message = typeof relayError?.error === "string" ? relayError.error : `Relay failed (${res.status})`
            if (pendingToastId !== null) toast.dismiss(pendingToastId)
            toast.error(message)
          }
          await safeRefreshGovernanceView()
          onVoteFailure?.()
          return
        }

        const relayResponse = relayBody as { outcome?: unknown } | null
        voteOutcome = parseGovernanceVoteOutcome(relayResponse?.outcome) ?? { kind: "unknown" }
      } else {
        // Direct transaction path
        const deposit = isVoteFree ? "0" : "10000000000000000000000" // 0.01 NEAR storage deposit
        const result = await signAndSendTransaction(buildCastVoteTx(proposal.id, choice, deposit))
        startProcessingFeedback()
        voteOutcome = resolveGovernanceVoteOutcome(result)
      }

      let syncedVote: VoteView | null = null
      if (voteOutcome.kind !== "tx_failed") {
        await safeRefreshGovernanceView()
        const retries = voteOutcome.kind === "vote_rejected" ? 1 : 3
        syncedVote = await syncVoteFromChain(accountId, retries)
      }

      const effectiveOutcome: GovernanceVoteOutcome = syncedVote
        ? {
            kind: "vote_cast",
            proposalId: syncedVote.proposalId,
            voter: syncedVote.voter,
            choice: syncedVote.choice,
          }
        : voteOutcome

      const voteToast = getVoteOutcomeToast(effectiveOutcome, choice)
      if (voteToast.type === "success") {
        if (pendingToastId !== null) toast.dismiss(pendingToastId)
        toast.success(voteToast.message)
        onVoteSuccess?.(voteLifecyclePayload)
      } else {
        if (pendingToastId !== null) toast.dismiss(pendingToastId)
        toast.error(voteToast.message)
        onVoteFailure?.()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Transaction failed"
      if (pendingToastId !== null) toast.dismiss(pendingToastId)
      toast.error(getTransactionFailureMessage(errorMessage))
      onVoteFailure?.()
    } finally {
      if (pendingToastId !== null) toast.dismiss(pendingToastId)
      setTxLoading(false)
    }
  }

  const loading = txLoading || isPending || checking
  switch (panelState.kind) {
    case "vote_processing":
      return (
        <VotePanelCard title="Your Vote">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#64748b] dark:text-[#94a3b8]" />
            <span className="font-inter text-[14px] text-[#334155] dark:text-[#cbd5e1]">
              Your vote{" "}
              <strong className={VOTE_CHOICE_COLOR_TOKENS[panelState.choice].actionText}>
                {panelState.choice.toUpperCase()}
              </strong>{" "}
              is being processed.
            </span>
          </div>
        </VotePanelCard>
      )
    case "proposal_not_started_pending":
      return (
        <VotePanelCard title="Voting">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">Voting has not started yet.</p>
        </VotePanelCard>
      )
    case "proposal_not_started_scheduled":
      return (
        <VotePanelCard title="Voting">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
            Voting has not started yet. Scheduled to open on {formatUtcDate(panelState.startAt)} UTC.
          </p>
        </VotePanelCard>
      )
    case "proposal_ended_loading":
      return <VotePanelSkeletonState title="Your Vote" withActions={false} />
    case "proposal_ended_with_vote":
      return (
        <VotePanelCard title="Your Vote">
          <ConfirmedVoteMessage choice={panelState.choice} />
        </VotePanelCard>
      )
    case "proposal_ended_without_vote":
      return (
        <VotePanelCard title="Your Vote">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
            Voting has ended. You did not vote.
          </p>
        </VotePanelCard>
      )
    case "wallet_not_connected":
      return (
        <VotePanelCard title="Cast Your Vote">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
            Connect your wallet to check eligibility and vote while voting is active.
          </p>
        </VotePanelCard>
      )
    case "eligibility_loading":
      return <VotePanelSkeletonState title="Cast Your Vote" withActions />
    case "already_voted":
      return (
        <VotePanelCard title="Your Vote">
          <ConfirmedVoteMessage choice={panelState.choice} />
        </VotePanelCard>
      )
    case "ineligible_blocklisted":
      return (
        <VotePanelCard title="Cast Your Vote">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
            Your account is blocklisted and cannot vote on proposals.
          </p>
        </VotePanelCard>
      )
    case "ineligible_unverified":
      return (
        <VotePanelCard title="Cast Your Vote">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
            This account is not NEAR Verified and cannot vote on this proposal.
          </p>
        </VotePanelCard>
      )
    case "ineligible_verified_after_snapshot":
      return (
        <VotePanelCard title="Cast Your Vote">
          <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8]">
            This account was verified after this proposal was created and is not eligible to vote on it.
          </p>
        </VotePanelCard>
      )
    case "eligible_can_vote":
      return (
        <VotePanelCard title="Cast Your Vote">
          <div className="flex gap-3">
            <Button
              className={`flex-1 font-fk-grotesk font-bold ${VOTE_CHOICE_COLOR_TOKENS.yes.button}`}
              size="citizens-lg"
              onClick={() => handleVote("yes")}
              disabled={loading}
            >
              Yes
            </Button>
            <Button
              className={`flex-1 font-fk-grotesk font-bold ${VOTE_CHOICE_COLOR_TOKENS.no.button}`}
              size="citizens-lg"
              onClick={() => handleVote("no")}
              disabled={loading}
            >
              No
            </Button>
          </div>
          {needsRelay ? (
            <p className={`font-inter text-[11px] mt-2 ${VOTE_POSITIVE_TEXT_CLASS}`}>
              Gas sponsored — no NEAR required
            </p>
          ) : isZeroBalance && isVoteFree && !supportsMetaTransactions ? (
            <p className="font-inter text-[11px] text-[#f59e0b] mt-2">
              {walletName ?? "Your wallet"} doesn&apos;t support gasless voting. Please add NEAR for gas fees or switch
              to Meteor Wallet.
            </p>
          ) : !isVoteFree ? (
            <p className="font-inter text-[11px] text-[#94a3b8] mt-2">
              A small storage deposit (0.01 NEAR) is required for your vote.
            </p>
          ) : null}
        </VotePanelCard>
      )
  }
}
