import { NextRequest, NextResponse } from "next/server"
import { governanceDb, db as verificationDb } from "@near-citizens/shared"

/**
 * GET /api/governance/proposals/[id]
 * Get a single proposal with vote counts and stats
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const proposalId = parseInt(id, 10)

    if (isNaN(proposalId) || proposalId < 0) {
      return NextResponse.json({ error: "Invalid proposal ID" }, { status: 400 })
    }

    // Get proposal from contract
    const proposal = await governanceDb.getProposal(proposalId)

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 })
    }

    // Get vote counts and total citizens count in parallel
    const [voteCounts, { total: totalCitizens }] = await Promise.all([
      governanceDb.getVoteCounts(proposalId),
      verificationDb.getVerifiedAccounts(0, 1), // Just need the total count
    ])

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
