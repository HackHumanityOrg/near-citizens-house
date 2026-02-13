"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@near-citizens/ui"
import { NEAR_CONFIG } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2 } from "lucide-react"
import type { VoteView } from "@/lib/schemas/governance-contract"
import { formatUtcDateTime } from "@/lib/governance-dates"
import { getProposalVotes } from "@/app/governance/actions"
import type { OptimisticVote } from "./optimistic-vote"

const PAGE_SIZE = 20

interface Props {
  proposalId: number
  initialVotes: VoteView[]
  totalVotes: number
  optimisticVote?: OptimisticVote | null
  optimisticTotalDelta?: number
}

type DisplayVote = {
  proposalId: number
  voter: string
  choice: VoteView["choice"]
  votedAt: number
  status: "pending" | "confirmed"
  isOptimistic: boolean
}

export function VotesTable({
  proposalId,
  initialVotes,
  totalVotes,
  optimisticVote = null,
  optimisticTotalDelta = 0,
}: Props) {
  const [votes, setVotes] = useState(initialVotes)
  const [page, setPage] = useState(0)
  const [isPending, startTransition] = useTransition()
  const hasMore = votes.length < totalVotes
  const displayCount = Math.max(0, totalVotes + optimisticTotalDelta)

  const renderedVotes = useMemo<DisplayVote[]>(() => {
    const dedupedVotes = optimisticVote
      ? votes.filter((vote) => !(vote.proposalId === optimisticVote.proposalId && vote.voter === optimisticVote.voter))
      : votes

    const mappedVotes: DisplayVote[] = dedupedVotes.map((vote) => ({
      proposalId: vote.proposalId,
      voter: vote.voter,
      choice: vote.choice,
      votedAt: vote.votedAt,
      status: "confirmed",
      isOptimistic: false,
    }))

    if (!optimisticVote) return mappedVotes

    return [
      {
        proposalId: optimisticVote.proposalId,
        voter: optimisticVote.voter,
        choice: optimisticVote.choice,
        votedAt: optimisticVote.votedAt,
        status: optimisticVote.status,
        isOptimistic: true,
      },
      ...mappedVotes,
    ]
  }, [votes, optimisticVote])

  const loadMore = () => {
    const nextPage = page + 1
    startTransition(async () => {
      const result = await getProposalVotes(proposalId, nextPage, PAGE_SIZE, totalVotes)
      if (result.votes.length === 0) return
      setVotes((prev) => [...prev, ...result.votes])
      setPage(nextPage)
    })
  }

  if (displayCount === 0 && renderedVotes.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] w-full">
      <div className="px-4 py-4">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white">
          Votes ({displayCount > 0 ? displayCount : renderedVotes.length})
        </h3>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#64748b]" />
        </div>
      ) : renderedVotes.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="font-inter text-[14px] text-[#828282] dark:text-neutral-400">No votes yet.</p>
        </div>
      ) : (
        renderedVotes.map((vote, index) => (
          <div
            key={vote.isOptimistic ? `optimistic-${vote.voter}-${vote.proposalId}` : `${vote.voter}-${vote.proposalId}`}
            className={`px-4 py-3 flex flex-col gap-1 ${index !== renderedVotes.length - 1 ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
          >
            <div className="flex items-center justify-between">
              <a
                href={NEAR_CONFIG.explorerAccountUrl(vote.voter)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-inter text-[13px] text-black dark:text-white hover:underline inline-flex items-center gap-1 min-w-0"
              >
                <MiddleTruncate text={vote.voter} className="max-w-[200px]" />
                <ExternalLink className="h-3 w-3 shrink-0 text-[#64748b]" />
              </a>
              <span
                className={`text-[12px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                  vote.status === "pending"
                    ? "bg-[#e2e8f0] text-[#334155] dark:bg-[#334155] dark:text-[#cbd5e1]"
                    : vote.choice === "yes"
                      ? "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#bbf7d0]"
                      : "bg-[#fecaca] text-[#991b1b] dark:bg-[#7f1d1d] dark:text-[#fecaca]"
                }`}
              >
                {vote.status === "pending" ? "PENDING" : vote.choice.toUpperCase()}
              </span>
            </div>
            <span className="font-inter text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              {formatUtcDateTime(vote.votedAt)}
            </span>
          </div>
        ))
      )}

      {/* Lazy loading */}
      {hasMore && (
        <div className="flex items-center justify-center px-4 py-3 border-t border-[#cbd5e1] dark:border-white/10">
          <Button variant="citizens-outline" size="sm" onClick={loadMore} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : (
              "Load more votes"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
