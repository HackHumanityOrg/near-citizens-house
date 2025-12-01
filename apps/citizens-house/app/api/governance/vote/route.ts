import { NextRequest, NextResponse } from "next/server"
import { governanceDb, voteRequestSchema } from "@near-citizens/shared"

/**
 * POST /api/governance/vote
 * Cast a vote on a proposal (requires verified citizenship via contract)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = voteRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validation.error.errors,
        },
        { status: 400 },
      )
    }

    const { proposalId, vote } = validation.data

    // Cast vote via contract
    // Note: The contract will verify citizenship via cross-contract call
    await governanceDb.vote(proposalId, vote)

    console.log(`[API] Voted ${vote} on proposal ${proposalId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Error voting:", error)

    // Handle contract errors
    if (error instanceof Error) {
      // Check for specific contract errors
      if (error.message.includes("Only verified citizens")) {
        return NextResponse.json({ error: "You must be a verified citizen to vote" }, { status: 403 })
      }

      if (error.message.includes("Already voted")) {
        return NextResponse.json({ error: "You have already voted on this proposal" }, { status: 400 })
      }

      if (error.message.includes("Voting period has ended")) {
        return NextResponse.json({ error: "Voting period has ended for this proposal" }, { status: 400 })
      }

      if (error.message.includes("not active")) {
        return NextResponse.json({ error: "This proposal is not active" }, { status: 400 })
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 })
  }
}
