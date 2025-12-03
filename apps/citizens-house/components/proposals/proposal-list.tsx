"use client"

import { useState, useEffect } from "react"
import { type Proposal, type ProposalStatus } from "@near-citizens/shared"
import { ProposalCard } from "./proposal-card"
import { Button } from "@near-citizens/ui"
import { Loader2 } from "lucide-react"
import { getProposalsWithStats } from "@/lib/actions/governance"

interface ProposalWithStats {
  proposal: Proposal
  voteCounts: {
    yesVotes: number
    noVotes: number
    abstainVotes: number
    totalVotes: number
  }
  quorumRequired: number
  totalCitizens: number
}

interface ProposalListProps {
  initialProposals?: ProposalWithStats[]
  statusFilter?: ProposalStatus
}

export function ProposalList({ initialProposals = [], statusFilter }: ProposalListProps) {
  const [proposals, setProposals] = useState<ProposalWithStats[]>(initialProposals)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

  const loadMore = async () => {
    setLoading(true)
    try {
      const { proposals: newProposals } = await getProposalsWithStats(page * 10, 10, statusFilter)

      if (newProposals && newProposals.length > 0) {
        setProposals((prev) => [...prev, ...newProposals])
        setPage((p) => p + 1)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error("Error loading proposals:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load initial data when component mounts or statusFilter changes
  useEffect(() => {
    // Reset state when filter changes
    setProposals([])
    setPage(0)
    setHasMore(true)

    const loadInitial = async () => {
      setLoading(true)
      try {
        const { proposals: newProposals } = await getProposalsWithStats(0, 10, statusFilter)
        if (newProposals && newProposals.length > 0) {
          setProposals(newProposals)
          setPage(1)
        } else {
          setHasMore(false)
        }
      } catch (error) {
        console.error("Error loading proposals:", error)
      } finally {
        setLoading(false)
      }
    }

    if (initialProposals.length === 0) {
      loadInitial()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  if (loading && proposals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {statusFilter
            ? `No ${statusFilter.toLowerCase()} proposals found.`
            : "No proposals yet. Be the first to create one!"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Proposal Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((item) => (
          <ProposalCard
            key={item.proposal.id}
            proposal={item.proposal}
            voteCounts={item.voteCounts}
            quorumRequired={item.quorumRequired}
            totalCitizens={item.totalCitizens}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? (
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
