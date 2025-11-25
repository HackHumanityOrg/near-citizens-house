import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import type { NearContractDatabase } from "@/lib/near-contract-db"

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 25

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "0", 10)
    const requestedPageSize = parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10)

    const pageSize = Math.min(Math.max(requestedPageSize, 1), MAX_PAGE_SIZE)

    if (page < 0 || !Number.isFinite(page)) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 })
    }

    const fromIndex = page * pageSize

    const result = await (db as NearContractDatabase).getVerifiedAccounts(fromIndex, pageSize)

    return NextResponse.json({
      accounts: result.accounts,
      total: result.total,
      page,
      pageSize,
    })
  } catch (error) {
    console.error("[API] Error fetching verifications:", error)
    return NextResponse.json({ error: "Failed to fetch verifications" }, { status: 500 })
  }
}
