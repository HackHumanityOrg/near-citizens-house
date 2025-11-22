import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { NearContractDatabase } from "@/lib/near-contract-db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "0", 10)
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10)

    // Validate parameters
    if (page < 0 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: "Invalid pagination parameters" }, { status: 400 })
    }

    // Calculate offset
    const fromIndex = page * pageSize

    // Get paginated accounts from contract
    if (db instanceof NearContractDatabase) {
      const result = await db.getVerifiedAccounts(fromIndex, pageSize)

      return NextResponse.json({
        accounts: result.accounts,
        total: result.total,
        page,
        pageSize,
      })
    }

    // Fallback for other database types
    const allAccounts = await db.getAllVerifiedAccounts()
    const total = allAccounts.length
    const accounts = allAccounts.slice(fromIndex, fromIndex + pageSize)

    return NextResponse.json({
      accounts,
      total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("[API] Error fetching verifications:", error)
    return NextResponse.json({ error: "Failed to fetch verifications" }, { status: 500 })
  }
}
