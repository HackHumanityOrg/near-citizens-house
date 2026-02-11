"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { Button } from "@near-citizens/ui"
import { useNearWallet } from "@/lib"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ProposalView } from "@/lib/schemas/governance-contract"
import { StatusBadge, type DisplayStatus } from "../status-badge"
import {
  buildCancelProposalTx,
  buildExpirePendingProposalTx,
  buildFinalizeProposalTx,
} from "@/lib/contracts/governance/transactions"
import { getProposals, revalidateGovernance } from "@/app/governance/actions"

const PAGE_SIZE = 10

function getDisplayStatus(proposal: ProposalView): DisplayStatus {
  const now = Date.now()
  if (proposal.status === "active" && proposal.startAt > now) return "scheduled"
  if (proposal.status === "active" && proposal.endsAt < now) return "finished"
  return proposal.status
}

export function ProposalsPanel() {
  const { signAndSendTransaction, accountId, isConnected } = useNearWallet()
  const [proposals, setProposals] = useState<ProposalView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [txLoading, setTxLoading] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchPage = (p: number) => {
    setLoading(true)
    getProposals(p, PAGE_SIZE).then(({ proposals: data, total: t }) => {
      setProposals(data)
      setTotal(t)
      setLoading(false)
    })
  }

  useEffect(() => {
    fetchPage(page)
  }, [page])

  const handleAction = async (proposalId: number, action: "cancel" | "expire" | "finalize") => {
    if (!isConnected || !accountId) return

    setTxLoading(proposalId)
    try {
      const txBuilders = {
        cancel: () => buildCancelProposalTx(proposalId),
        expire: () => buildExpirePendingProposalTx(proposalId),
        finalize: () => buildFinalizeProposalTx(proposalId),
      }
      await signAndSendTransaction(txBuilders[action]())
      startTransition(() => {
        revalidateGovernance()
      })
      const labels = { cancel: "cancelled", expire: "expired", finalize: "finalized" } as const
      toast.success(`Proposal ${labels[action]} successfully`)
      fetchPage(page)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Transaction failed")
    } finally {
      setTxLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-[#64748b]" />
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <p className="font-inter text-[14px] text-[#64748b] dark:text-[#94a3b8] text-center py-8">No proposals yet</p>
    )
  }

  const hasMore = total > 0 && (page + 1) * PAGE_SIZE < total

  return (
    <div className="flex flex-col gap-4">
      {proposals.map((proposal) => {
        const now = Date.now()
        const isActionLoading = txLoading === proposal.id || isPending
        const canCancel = proposal.status === "pending" || proposal.status === "active"
        const canExpire = proposal.status === "pending" && now > proposal.pendingExpiresAt
        const canFinalize = proposal.status === "active" && now > proposal.endsAt

        return (
          <div key={proposal.id} className="flex flex-col gap-2 p-3 rounded-lg bg-[#f8fafc] dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter shrink-0">
                  #{proposal.id}
                </span>
                <Link
                  href={`/governance/${proposal.id}`}
                  className="font-fk-grotesk text-[14px] text-black dark:text-white hover:underline truncate"
                >
                  {proposal.title}
                </Link>
              </div>
              <StatusBadge status={getDisplayStatus(proposal)} failureKind={proposal.failureKind} />
            </div>
            {(canCancel || canExpire || canFinalize) && (
              <div className="flex flex-wrap gap-2">
                {canCancel && (
                  <Button
                    variant="citizens-outline"
                    size="sm"
                    onClick={() => handleAction(proposal.id, "cancel")}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Cancel
                  </Button>
                )}
                {canExpire && (
                  <Button
                    variant="citizens-outline"
                    size="sm"
                    onClick={() => handleAction(proposal.id, "expire")}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Expire Pending
                  </Button>
                )}
                {canFinalize && (
                  <Button
                    variant="citizens-primary"
                    size="sm"
                    onClick={() => handleAction(proposal.id, "finalize")}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Finalize
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between pt-2">
          <Button variant="citizens-outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            Previous
          </Button>
          <span className="text-[12px] text-[#64748b] dark:text-[#94a3b8] font-inter">Page {page + 1}</span>
          <Button variant="citizens-outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
