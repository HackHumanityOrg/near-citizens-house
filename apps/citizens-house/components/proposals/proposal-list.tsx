"use client"

import { useState, useMemo } from "react"
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from "@near-citizens/ui"
import {
  type SputnikProposal,
  type ProposalCategory,
  getProposalCategory,
  PROPOSAL_CATEGORY_LABELS,
} from "@near-citizens/shared"
import { ProposalCard, ProposalCardSkeleton } from "./proposal-card"
import { getProposalsReversed } from "@/lib/actions/sputnik-dao"
import { Loader2 } from "lucide-react"

interface ProposalListProps {
  initialProposals: SputnikProposal[]
  initialHasMore: boolean
  /** When true, shows all proposal types with category tabs. When false (default), shows only Vote proposals. */
  showAllKinds?: boolean
}

const CATEGORIES: ProposalCategory[] = ["all", "vote", "membership", "policy"]

export function ProposalList({ initialProposals, initialHasMore, showAllKinds = false }: ProposalListProps) {
  const [proposals, setProposals] = useState<SputnikProposal[]>(initialProposals)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoading, setIsLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ProposalCategory>("all")

  // Filter proposals by category (or vote-only when showAllKinds is false)
  const filteredProposals = useMemo(() => {
    if (!showAllKinds) {
      // Only show Vote proposals (explicit check, not category mapping which has fallbacks)
      return proposals.filter((p) => p.kind === "Vote")
    }
    if (activeCategory === "all") {
      return proposals
    }
    return proposals.filter((p) => getProposalCategory(p.kind) === activeCategory)
  }, [proposals, activeCategory, showAllKinds])

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
      // Deduplicate proposals by ID when merging
      setProposals((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newProposals = result.proposals.filter((p) => !existingIds.has(p.id))
        return [...prev, ...newProposals]
      })
      setHasMore(result.hasMore)
      setPage((p) => p + 1)
    } catch (error) {
      console.error("Error loading more proposals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Note: Removed early return for empty proposals to allow Load More to still work if hasMore is true

  const proposalGrid = (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredProposals.map((proposal) => (
        <ProposalCard key={proposal.id} proposal={proposal} />
      ))}
    </div>
  )

  const emptyState = (
    <div className="text-center py-12 text-muted-foreground">
      <p className="text-lg mb-2">
        {showAllKinds ? `No ${PROPOSAL_CATEGORY_LABELS[activeCategory].toLowerCase()} proposals` : "No vote proposals"}
      </p>
      <p className="text-sm">
        {showAllKinds ? "Try selecting a different category." : "Vote proposals will appear here when created."}
      </p>
    </div>
  )

  return (
    <div className="space-y-6">
      {showAllKinds ? (
        /* Category Tabs - only shown when showAllKinds is true */
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ProposalCategory)}>
          <TabsList className="grid w-full grid-cols-4">
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {PROPOSAL_CATEGORY_LABELS[cat]}
                <span className="ml-1.5 text-xs text-muted-foreground">({categoryCounts[cat]})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-6">
            {filteredProposals.length === 0 ? emptyState : proposalGrid}
          </TabsContent>
        </Tabs>
      ) : (
        /* Simple list without tabs - for vote-only view */
        <div className="mt-6">{filteredProposals.length === 0 ? emptyState : proposalGrid}</div>
      )}

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

export function ProposalListSkeleton({ showAllKinds = false }: { showAllKinds?: boolean }) {
  const cards = Array.from({ length: 6 })
  const tabs = Array.from({ length: 4 })

  return (
    <div className="space-y-6">
      {showAllKinds && (
        <div className="grid w-full grid-cols-4 gap-2">
          {tabs.map((_, index) => (
            <div key={index} className="h-9 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      )}

      <div className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((_, index) => (
            <ProposalCardSkeleton key={index} />
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <div className="h-10 w-28 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  )
}
