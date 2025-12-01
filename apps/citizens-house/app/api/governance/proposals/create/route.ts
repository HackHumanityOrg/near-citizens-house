import { NextRequest, NextResponse } from "next/server"
import { governanceDb, createProposalRequestSchema } from "@near-citizens/shared"

/**
 * POST /api/governance/proposals/create
 * Create a new proposal (requires verified citizenship via contract)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request body
    const validation = createProposalRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: validation.error.errors,
        },
        { status: 400 },
      )
    }

    const { title, description, discourseUrl } = validation.data

    // Create proposal via contract
    // Note: The contract will verify citizenship via cross-contract call
    const proposalId = await governanceDb.createProposal(title, description, discourseUrl)

    console.log(`[API] Created proposal ${proposalId}`)

    return NextResponse.json({ proposalId }, { status: 201 })
  } catch (error) {
    console.error("[API] Error creating proposal:", error)

    // Handle contract errors
    if (error instanceof Error) {
      // Check for specific contract errors
      if (error.message.includes("Only verified citizens")) {
        return NextResponse.json({ error: "You must be a verified citizen to create proposals" }, { status: 403 })
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 })
  }
}
