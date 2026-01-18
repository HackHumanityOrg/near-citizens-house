import { type NextRequest, NextResponse } from "next/server"
import { verificationDb } from "@/lib/contracts/verification/client"
import { getSession, updateSession } from "@/lib/session-store"
import { nearAccountIdSchema, isValidSessionId } from "@/lib/schemas"
import { createStatusContext, extractDistinctId, extractPlatform } from "@/lib/logger"

export async function GET(request: NextRequest) {
  // Initialize RequestContext for wide event logging
  const ctx = createStatusContext()
  ctx.setMany({
    route: "/api/verification/status",
    method: "GET",
    distinctId: extractDistinctId(request),
    platform: extractPlatform(request.headers.get("user-agent")),
  })

  const sessionId = request.nextUrl.searchParams.get("sessionId")
  const accountIdParam = request.nextUrl.searchParams.get("accountId")

  ctx.set("sessionId", sessionId)
  ctx.set("nearAccountId", accountIdParam)

  if (!sessionId) {
    ctx.set("outcome", "validation_error")
    ctx.set("statusCode", 400)
    ctx.set("error.message", "Missing sessionId parameter")
    ctx.emit("warn")
    return NextResponse.json({ status: "error", error: "Missing sessionId parameter" }, { status: 400 })
  }

  // Validate sessionId format to prevent enumeration attacks
  if (!isValidSessionId(sessionId)) {
    ctx.set("outcome", "validation_error")
    ctx.set("statusCode", 400)
    ctx.set("error.message", "Invalid sessionId format")
    ctx.emit("warn")
    return NextResponse.json({ status: "error", error: "Invalid sessionId format" }, { status: 400 })
  }

  try {
    ctx.startTimer("redisLookup")
    const session = await getSession(sessionId)
    ctx.endTimer("redisLookup")

    ctx.set("sessionFound", !!session)

    if (!session) {
      ctx.set("outcome", "not_found")
      ctx.set("statusCode", 404)
      ctx.emit("info")
      // Use generic error message to prevent session enumeration
      return NextResponse.json({ status: "expired", error: "Session not found or expired" }, { status: 404 })
    }

    ctx.set("sessionStatus", session.status)
    if (session.timestamp) {
      ctx.set("sessionAge", Math.round((Date.now() - session.timestamp) / 1000))
    }

    // If session exists but is still pending, optionally fall back to contract state.
    // This covers cases where on-chain storage succeeded but the final session update failed.
    if (session.status === "pending" && accountIdParam && session.accountId && accountIdParam === session.accountId) {
      const parsedAccountId = nearAccountIdSchema.safeParse(accountIdParam)
      if (parsedAccountId.success) {
        ctx.set("usedContractFallback", true)
        ctx.startTimer("contractFallback")
        try {
          const isVerified = await verificationDb.isVerified(parsedAccountId.data)
          ctx.set("contractCheckSuccess", true)
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

            ctx.endTimer("contractFallback")
            ctx.set("outcome", "success")
            ctx.set("statusCode", 200)
            ctx.emit("info")

            return NextResponse.json({
              status: "success",
              accountId: parsedAccountId.data,
              attestationId,
            })
          }
          ctx.endTimer("contractFallback")
        } catch {
          ctx.endTimer("contractFallback")
          ctx.set("contractCheckSuccess", false)
          // Failed to check contract, continue with session status
        }
      }
    }

    // Determine outcome based on session status
    const outcome = session.status === "success" ? "success" : session.status === "pending" ? "pending" : session.status
    ctx.set("outcome", outcome)
    ctx.set("statusCode", 200)
    ctx.emit("info")

    return NextResponse.json({
      status: session.status,
      accountId: session.accountId,
      attestationId: session.attestationId,
      error: session.error,
      errorCode: session.errorCode,
    })
  } catch {
    ctx.set("outcome", "error")
    ctx.set("statusCode", 500)
    ctx.set("error.message", "Failed to fetch session status")
    ctx.emit("error")
    return NextResponse.json({ status: "error", error: "Failed to fetch session status" }, { status: 500 })
  }
}
