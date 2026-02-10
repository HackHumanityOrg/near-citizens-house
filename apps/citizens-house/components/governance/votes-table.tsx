"use client"

import { useState, useTransition } from "react"
import { Button } from "@near-citizens/ui"
import { NEAR_CONFIG } from "@/lib"
import { MiddleTruncate } from "@/components/ui/middle-truncate"
import { ExternalLink, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
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
  const hasMore = (page + 1) * PAGE_SIZE < totalVotes

  const loadPage = (newPage: number) => {
    startTransition(async () => {
      const result = await getProposalVotes(proposalId, newPage, PAGE_SIZE)
      setVotes(result.votes)
      setPage(newPage)
    })
  }

  if (totalVotes === 0 && votes.length === 0) return null

  return (
    <div className="bg-white dark:bg-[#191a23] border border-[rgba(0,0,0,0.1)] dark:border-white/20 rounded-[16px] w-full max-w-[800px] mx-auto">
      <div className="px-4 py-4 md:px-6">
        <h3 className="font-fk-grotesk font-bold text-[16px] text-black dark:text-white">
          Votes ({totalVotes > 0 ? totalVotes : votes.length})
        </h3>
      </div>

      {/* Desktop table header */}
      <div className="hidden md:grid grid-cols-[minmax(0,1fr)_80px_200px] gap-4 px-6 py-3 bg-[#e2e8f0] dark:bg-white/10 border-y border-[#cbd5e1] dark:border-white/10">
        <span className="font-fk-grotesk font-bold text-[14px] text-black dark:text-white">Voter</span>
        <span className="font-fk-grotesk font-bold text-[14px] text-black dark:text-white text-center">Choice</span>
        <span className="font-fk-grotesk font-bold text-[14px] text-black dark:text-white text-center">Voted At</span>
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
            className={`px-4 py-3 md:px-6 ${index !== votes.length - 1 ? "border-b border-[#cbd5e1] dark:border-white/10" : ""}`}
          >
            {/* Mobile */}
            <div className="md:hidden flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <a
                  href={NEAR_CONFIG.explorerAccountUrl(vote.voter)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-inter text-[13px] text-black dark:text-white hover:underline inline-flex items-center gap-1"
                >
                  <MiddleTruncate text={vote.voter} className="max-w-[160px]" />
                  <ExternalLink className="h-3 w-3 shrink-0 text-[#64748b]" />
                </a>
                <span
                  className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
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

            {/* Desktop */}
            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_80px_200px] gap-4 items-center">
              <a
                href={NEAR_CONFIG.explorerAccountUrl(vote.voter)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-inter text-[14px] text-black dark:text-white hover:underline inline-flex items-center gap-1"
              >
                <MiddleTruncate text={vote.voter} className="max-w-[200px]" />
                <ExternalLink className="h-3 w-3 shrink-0 text-[#64748b]" />
              </a>
              <div className="flex justify-center">
                <span
                  className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${
                    vote.choice === "yes"
                      ? "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#bbf7d0]"
                      : "bg-[#fecaca] text-[#991b1b] dark:bg-[#7f1d1d] dark:text-[#fecaca]"
                  }`}
                >
                  {vote.choice.toUpperCase()}
                </span>
              </div>
              <span className="font-inter text-[13px] text-[#64748b] dark:text-[#94a3b8] text-center">
                {formatDate(vote.votedAt)}
              </span>
            </div>
          </div>
        ))
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between px-4 py-3 md:px-6 border-t border-[#cbd5e1] dark:border-white/10">
          <Button
            variant="citizens-outline"
            size="sm"
            onClick={() => loadPage(page - 1)}
            disabled={page === 0 || isPending}
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </Button>
          <span className="font-inter text-[12px] text-[#64748b]">Page {page + 1}</span>
          <Button
            variant="citizens-outline"
            size="sm"
            onClick={() => loadPage(page + 1)}
            disabled={!hasMore || isPending}
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
