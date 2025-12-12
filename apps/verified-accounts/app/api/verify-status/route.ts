import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session-store"

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ status: "error", error: "Missing sessionId parameter" }, { status: 400 })
  }

  try {
    const session = await getSession(sessionId)

    if (!session) {
      return NextResponse.json({ status: "expired", error: "Session not found or expired" }, { status: 404 })
    }

    return NextResponse.json({
      status: session.status,
      accountId: session.accountId,
      error: session.error,
    })
  } catch (error) {
    console.error("[VerifyStatus] Error fetching session:", error)
    return NextResponse.json({ status: "error", error: "Failed to fetch session status" }, { status: 500 })
  }
}
