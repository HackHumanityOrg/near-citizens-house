import { NextRequest, NextResponse } from "next/server"
import { governanceDb } from "@near-citizens/shared"

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET /api/governance/proposals/[id]
 * Get a single proposal with vote counts and stats
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const proposalId = parseInt(params.id, 10)

    if (isNaN(proposalId) || proposalId < 0) {
      return NextResponse.json({ error: "Invalid proposal ID" }, { status: 400 })
    }

    // Get proposal from contract
    const proposal = await governanceDb.getProposal(proposalId)

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Get vote counts
    const voteCounts = await governanceDb.getVoteCounts(proposalId)

    // Get total citizens count for quorum calculation
    const totalCitizens = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/verified-accounts/count`,
    )
      .then((res) => res.json())
      .then((data) => data.count as number)
      .catch(() => 0)

    const quorumRequired = Math.floor((totalCitizens * 10) / 100)

    // Check if current user has voted (if accountId provided)
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get("accountId")
    let userVote = null

    if (accountId) {
      userVote = await governanceDb.getVote(proposalId, accountId)
    }

    return NextResponse.json({
      proposal,
      voteCounts,
      quorumRequired,
      totalCitizens,
      userVote,
    })
  } catch (error) {
    console.error("[API] Error fetching proposal:", error)
    return NextResponse.json({ error: "Failed to fetch proposal" }, { status: 500 })
  }
}
