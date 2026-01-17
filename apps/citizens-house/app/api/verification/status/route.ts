import { type NextRequest, NextResponse } from "next/server"
import { verificationDb } from "@/lib/contracts/verification/client"
import { getSession, updateSession } from "@/lib/session-store"
import { nearAccountIdSchema, isValidSessionId } from "@/lib/schemas"

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json({ status: "error", error: "Missing sessionId parameter" }, { status: 400 })
  }

  const accountIdParam = request.nextUrl.searchParams.get("accountId")

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

    // If session exists but is still pending, optionally fall back to contract state.
    // This covers cases where on-chain storage succeeded but the final session update failed.
    if (session.status === "pending" && accountIdParam && session.accountId && accountIdParam === session.accountId) {
      const parsedAccountId = nearAccountIdSchema.safeParse(accountIdParam)
      if (parsedAccountId.success) {
        try {
          const isVerified = await verificationDb.isVerified(parsedAccountId.data)
          if (isVerified) {
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

            return NextResponse.json({
              status: "success",
              accountId: parsedAccountId.data,
              attestationId,
            })
          }
        } catch {
          // Failed to check contract, continue with session status
        }
      }
    }

    return NextResponse.json({
      status: session.status,
      accountId: session.accountId,
      attestationId: session.attestationId,
      error: session.error,
      errorCode: session.errorCode,
    })
  } catch {
    return NextResponse.json({ status: "error", error: "Failed to fetch session status" }, { status: 500 })
  }
}
