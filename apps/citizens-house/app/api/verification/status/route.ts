import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session-store"
import { createApiEvent } from "@/lib/logger"

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidSessionId(sessionId: string): boolean {
  return UUID_V4_REGEX.test(sessionId)
}

export async function GET(request: NextRequest) {
  const event = createApiEvent("verification.status", request)
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    event.setStatus(400)
    event.setError({ code: "MISSING_SESSION_ID", message: "Missing sessionId parameter" })
    event.error("Missing sessionId parameter")
    return NextResponse.json({ status: "error", error: "Missing sessionId parameter" }, { status: 400 })
  }

  event.setUser({ session_id: sessionId })

  // Validate sessionId format to prevent enumeration attacks
  if (!isValidSessionId(sessionId)) {
    event.setStatus(400)
    event.setError({ code: "INVALID_SESSION_ID", message: "Invalid sessionId format" })
    event.error("Invalid sessionId format")
    return NextResponse.json({ status: "error", error: "Invalid sessionId format" }, { status: 400 })
  }

  try {
    const session = await getSession(sessionId)

    if (!session) {
      // Use generic error message to prevent session enumeration
      event.setStatus(404)
      event.set("session_found", false)
      event.info("Session not found or expired")
      return NextResponse.json({ status: "expired", error: "Session not found or expired" }, { status: 404 })
    }

    event.setStatus(200)
    event.set("session_status", session.status)
    event.setUser({ account_id: session.accountId })
    event.info("Session status retrieved")

    return NextResponse.json({
      status: session.status,
      accountId: session.accountId,
      attestationId: session.attestationId,
      error: session.error,
      errorCode: session.errorCode,
    })
  } catch (error) {
    event.setStatus(500)
    event.setError(error instanceof Error ? error : { message: "Unknown error" })
    event.error("Failed to fetch session status")
    return NextResponse.json({ status: "error", error: "Failed to fetch session status" }, { status: 500 })
  }
}
