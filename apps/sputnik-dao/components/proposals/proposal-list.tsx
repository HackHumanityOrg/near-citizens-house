"use client"

import { useState, useMemo } from "react"
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@near-citizens/ui"
import {
  type SputnikProposal,
  type ProposalCategory,
  getProposalCategory,
  PROPOSAL_CATEGORY_LABELS,
} from "@near-citizens/shared"
import { ProposalCard } from "./proposal-card"
import { getProposalsReversed } from "@/lib/actions/sputnik-dao"
import { Loader2, RefreshCw } from "lucide-react"

interface ProposalListProps {
  initialProposals: SputnikProposal[]
  initialHasMore: boolean
  initialTotal: number
}

const CATEGORIES: ProposalCategory[] = ["all", "vote", "membership", "policy"]

export function ProposalList({ initialProposals, initialHasMore, initialTotal }: ProposalListProps) {
  const [proposals, setProposals] = useState<SputnikProposal[]>(initialProposals)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [total, setTotal] = useState(initialTotal)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ProposalCategory>("vote")

  // Filter proposals by category
  const filteredProposals = useMemo(() => {
    if (activeCategory === "all") {
      return proposals
    }
    return proposals.filter((p) => getProposalCategory(p.kind) === activeCategory)
  }, [proposals, activeCategory])

  // Count proposals per category
  const categoryCounts = useMemo(() => {
    const counts: Record<ProposalCategory, number> = {
      all: proposals.length,
      vote: 0,
      membership: 0,
      policy: 0,
    }
    for (const p of proposals) {
      const cat = getProposalCategory(p.kind)
      counts[cat]++
    }
    return counts
  }, [proposals])

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
          Showing {filteredProposals.length} of {total} proposals
          {activeCategory !== "all" && ` (filtered by ${PROPOSAL_CATEGORY_LABELS[activeCategory]})`}
        </p>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ProposalCategory)}>
        <TabsList className="grid w-full grid-cols-4">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat} value={cat}>
              {PROPOSAL_CATEGORY_LABELS[cat]}
              <span className="ml-1.5 text-xs text-muted-foreground">({categoryCounts[cat]})</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Single content area for all tabs since we filter the same list */}
        <TabsContent value={activeCategory} className="mt-6">
          {filteredProposals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">No {PROPOSAL_CATEGORY_LABELS[activeCategory].toLowerCase()} proposals</p>
              <p className="text-sm">Try selecting a different category.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Load More - only show when viewing all */}
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
