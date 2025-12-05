"use client"

import { useState, useEffect } from "react"
import { Button } from "@near-citizens/ui"
import { type SputnikProposal } from "@near-citizens/shared"
import { ProposalCard } from "./proposal-card"
import { getProposalsReversed } from "@/lib/actions/sputnik-dao"
import { Loader2, RefreshCw } from "lucide-react"

interface ProposalListProps {
  initialProposals: SputnikProposal[]
  initialHasMore: boolean
  initialTotal: number
}

export function ProposalList({ initialProposals, initialHasMore, initialTotal }: ProposalListProps) {
  const [proposals, setProposals] = useState<SputnikProposal[]>(initialProposals)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [total, setTotal] = useState(initialTotal)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const loadMore = async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    try {
      const result = await getProposalsReversed(page, 10)
      setProposals((prev) => [...prev, ...result.proposals])
      setHasMore(result.hasMore)
      setTotal(result.total)
      setPage((p) => p + 1)
    } catch (error) {
      console.error("Error loading more proposals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      const result = await getProposalsReversed(0, 10)
      setProposals(result.proposals)
      setHasMore(result.hasMore)
      setTotal(result.total)
      setPage(1)
    } catch (error) {
      console.error("Error refreshing proposals:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No proposals yet</p>
        <p className="text-sm">Proposals will appear here when created.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with count and refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {proposals.length} of {total} proposals
        </p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          {isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Proposal Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button onClick={loadMore} disabled={isLoading} variant="outline">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
