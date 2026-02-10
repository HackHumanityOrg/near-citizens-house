"use client"

import { useState, useTransition } from "react"
import { Button } from "@near-citizens/ui"
import { NEAR_CONFIG } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, Loader2 } from "lucide-react"
import type { VoteView } from "@/lib/schemas/governance-contract"
import { getProposalVotes } from "@/app/governance/actions"

const PAGE_SIZE = 20

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

interface Props {
  proposalId: number
  initialVotes: VoteView[]
  totalVotes: number
}

export function VotesTable({ proposalId, initialVotes, totalVotes }: Props) {
  const [votes, setVotes] = useState(initialVotes)
  const [page, setPage] = useState(0)
  const [isPending, startTransition] = useTransition()
  const hasMore = votes.length < totalVotes

  const loadMore = () => {
    const nextPage = page + 1
    startTransition(async () => {
      const result = await getProposalVotes(proposalId, nextPage, PAGE_SIZE)
      if (result.votes.length === 0) return
      setVotes((prev) => [...prev, ...result.votes])
      setPage(nextPage)
    })
  }

  if (totalVotes === 0 && votes.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] w-full">
      <div className="px-4 py-4">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white">
          Votes ({totalVotes > 0 ? totalVotes : votes.length})
        </h3>
      </div>

      {isPending ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-[#64748b]" />
        </div>
      ) : votes.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="font-inter text-[14px] text-[#828282] dark:text-neutral-400">No votes yet.</p>
        </div>
      ) : (
        votes.map((vote, index) => (
          <div
            key={`${vote.voter}-${vote.proposalId}`}
            className={`px-4 py-3 flex flex-col gap-1 ${index !== votes.length - 1 ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
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
                  vote.choice === "yes"
                    ? "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#bbf7d0]"
                    : "bg-[#fecaca] text-[#991b1b] dark:bg-[#7f1d1d] dark:text-[#fecaca]"
                }`}
              >
                {vote.choice.toUpperCase()}
              </span>
            </div>
            <span className="font-inter text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              {formatDate(vote.votedAt)}
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
