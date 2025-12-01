"use client"

import { useState, useEffect } from "react"
import { type Proposal, type ProposalStatus } from "@near-citizens/shared"
import { ProposalCard } from "./proposal-card"
import { Button } from "@near-citizens/ui"
import { Loader2 } from "lucide-react"

interface ProposalWithStats {
  proposal: Proposal
  voteCounts: {
    yesVotes: number
    noVotes: number
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
      const params = new URLSearchParams({
        from: (page * 10).toString(),
        limit: "10",
      })

      if (statusFilter) {
        params.set("status", statusFilter)
      }

      const response = await fetch(`/api/governance/proposals?${params}`)
      const data = await response.json()

      if (data.proposals && data.proposals.length > 0) {
        setProposals((prev) => [...prev, ...data.proposals])
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

  // Load initial data if not provided
  useEffect(() => {
    if (initialProposals.length === 0 && !loading) {
      loadMore()
    }
  }, [])

  if (proposals.length === 0 && !loading) {
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
