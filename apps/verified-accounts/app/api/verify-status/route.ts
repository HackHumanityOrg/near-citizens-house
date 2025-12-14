import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session-store"

/**
 * Session ID format validation
 *
 * Accepts two formats:
 * 1. UUID v4: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (standard crypto.randomUUID output)
 * 2. Legacy fallback: alphanumeric string from Math.random().toString(36).substring(2) + Date.now().toString(36)
 *    - Produced by older browsers without crypto.randomUUID support
 *    - Format: lowercase alphanumeric (a-z, 0-9), typically 18-22 characters, no dashes
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LEGACY_SESSION_ID_REGEX = /^[0-9a-z]{16,24}$/

function isValidSessionId(sessionId: string): boolean {
  return UUID_V4_REGEX.test(sessionId) || LEGACY_SESSION_ID_REGEX.test(sessionId)
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ status: "error", error: "Missing sessionId parameter" }, { status: 400 })
  }

  // Validate sessionId format to prevent enumeration attacks
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ status: "error", error: "Invalid sessionId format" }, { status: 400 })
  }

  try {
    const session = await getSession(sessionId)

    if (!session) {
      // Use generic error message to prevent session enumeration
      return NextResponse.json({ status: "expired", error: "Session not found or expired" }, { status: 404 })
    }

    return NextResponse.json({
      status: session.status,
      accountId: session.accountId,
      error: session.error,
    })
  } catch (error) {
    // Log only error name and message, not the full object (which may contain sensitive data)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const errorName = error instanceof Error ? error.name : "Error"
    console.error(`[VerifyStatus] ${errorName}: ${errorMessage}`)
    return NextResponse.json({ status: "error", error: "Failed to fetch session status" }, { status: 500 })
  }
}
