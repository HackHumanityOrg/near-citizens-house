import { NextRequest, NextResponse } from "next/server"
import { governanceDb, db as verificationDb, type ProposalStatus } from "@near-citizens/shared"

/**
 * GET /api/governance/proposals
 * Get paginated list of proposals with optional status filter
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = parseInt(searchParams.get("from") || "0", 10)
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const status = searchParams.get("status") as ProposalStatus | undefined

    // Validate parameters
    if (from < 0 || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 })
    }

    // Get proposals from contract and total citizens count in parallel
    const [proposals, { total: totalCitizens }] = await Promise.all([
      governanceDb.getProposals(from, limit, status),
      verificationDb.getVerifiedAccounts(0, 1), // Just need the total count
    ])

    // Get vote counts for each proposal
    const proposalsWithStats = await Promise.all(
      proposals.map(async (proposal) => {
        const voteCounts = await governanceDb.getVoteCounts(proposal.id)
        const quorumRequired = Math.floor((totalCitizens * 10) / 100)

        return {
          proposal,
          voteCounts,
          quorumRequired,
          totalCitizens,
        }
      }),
    )

    return NextResponse.json({ proposals: proposalsWithStats })
  } catch (error) {
    console.error("[API] Error fetching proposals:", error)
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 })
  }
}
