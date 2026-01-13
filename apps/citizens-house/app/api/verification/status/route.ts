import { type NextRequest, NextResponse } from "next/server"
import { nearAccountIdSchema } from "@near-citizens/shared"
import { verificationDb } from "@near-citizens/shared/contracts/verification/client"
import { getSession, updateSession } from "@/lib/session-store"
import { createApiEvent, Op } from "@/lib/logger"

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidSessionId(sessionId: string): boolean {
  return UUID_V4_REGEX.test(sessionId)
}

export async function GET(request: NextRequest) {
  const event = createApiEvent(Op.API.VERIFICATION_STATUS, request)
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    event.setStatus(400)
    event.setError({ code: "MISSING_SESSION_ID", message: "Missing sessionId parameter" })
    event.error("Missing sessionId parameter")
    return NextResponse.json({ status: "error", error: "Missing sessionId parameter" }, { status: 400 })
  }

  const accountIdParam = request.nextUrl.searchParams.get("accountId")
  event.setUser(accountIdParam ? { session_id: sessionId, account_id: accountIdParam } : { session_id: sessionId })

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

    // If session exists but is still pending, optionally fall back to contract state.
    // This covers cases where on-chain storage succeeded but the final session update failed.
    if (session.status === "pending" && accountIdParam && session.accountId && accountIdParam === session.accountId) {
      const parsedAccountId = nearAccountIdSchema.safeParse(accountIdParam)
      if (parsedAccountId.success) {
        try {
          const isVerified = await verificationDb.isVerified(parsedAccountId.data)
          if (isVerified) {
            event.set("session_fallback", "contract")

            // Try to retrieve attestation ID from contract (best effort)
            const verification = await verificationDb.getVerification(parsedAccountId.data)

            const attestationId = verification?.attestationId ?? session.attestationId

            // Best-effort: fix up the session so subsequent polls don't hit the chain
            try {
              await updateSession(sessionId, {
                status: "success",
                accountId: parsedAccountId.data,
                attestationId,
              })
            } catch {
              // Ignore session update failures; the response is still accurate
            }

            event.setStatus(200)
            event.set("session_status", "success")
            event.setUser({ session_id: sessionId, account_id: parsedAccountId.data })
            event.info("Session pending; contract indicates verified")

            return NextResponse.json({
              status: "success",
              accountId: parsedAccountId.data,
              attestationId,
            })
          }

          event.set("session_fallback", "contract_not_verified")
        } catch (error) {
          event.set("session_fallback", "contract_error")
          event.setError(error instanceof Error ? error : { message: "Unknown error" })
        }
      }
    }

    event.setStatus(200)
    event.set("session_status", session.status)
    event.setUser(
      session.accountId ? { session_id: sessionId, account_id: session.accountId } : { session_id: sessionId },
    )
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
