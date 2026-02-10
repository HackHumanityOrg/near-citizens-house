import { NextResponse, type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { verificationTokenRequestSchema } from "@/lib/schemas/api/verification"
import { validateSignatureData, verifyNearSignature } from "@/lib/verification-core"
import { hasFullAccessKey } from "@/lib/verification.server"
import { getSigningMessage, getSigningRecipient } from "@/lib/config"
import { getRedisClient } from "@/lib/redis"
import { setBackendKeyPoolRedis } from "@/lib/backend-key-pool"
import { verificationDb } from "@/lib/contracts/verification/client"

let redisInitialized = false
async function ensureRedisInitialized(): Promise<void> {
  if (redisInitialized) return
  const redis = await getRedisClient()
  setBackendKeyPoolRedis({ incr: (key: string) => redis.incr(key) })
  redisInitialized = true
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 })
  }

  try {
    const body = await request.json()
    const parseResult = verificationTokenRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const { nearSignature } = parseResult.data

    // 1. Validate signature format
    const formatCheck = validateSignatureData({
      timestamp: nearSignature.timestamp,
      nonce: nearSignature.nonce,
      publicKey: nearSignature.publicKey,
    })
    if (!formatCheck.valid) {
      return NextResponse.json({ success: false, error: formatCheck.error }, { status: 400 })
    }

    // 2. Verify signature cryptographically
    let expectedChallenge: string
    let recipient: string
    try {
      expectedChallenge = getSigningMessage()
      recipient = getSigningRecipient()
    } catch {
      return NextResponse.json({ success: false, error: "Backend signing config not available" }, { status: 500 })
    }

    const sigCheck = verifyNearSignature(
      expectedChallenge,
      nearSignature.signature,
      nearSignature.publicKey,
      nearSignature.nonce,
      recipient,
    )
    if (!sigCheck.valid) {
      return NextResponse.json({ success: false, error: sigCheck.error ?? "Invalid signature" }, { status: 400 })
    }

    // 3. Verify full-access key via RPC
    const keyCheck = await hasFullAccessKey(nearSignature.accountId, nearSignature.publicKey)
    if (!keyCheck.isFullAccess) {
      return NextResponse.json(
        { success: false, error: keyCheck.error ?? "Public key is not a full-access key" },
        { status: 400 },
      )
    }

    // 4. Store verification on-chain
    await ensureRedisInitialized()

    const userContextData = JSON.stringify({
      accountId: nearSignature.accountId,
      publicKey: nearSignature.publicKey,
      signature: nearSignature.signature,
      nonce: nearSignature.nonce,
      timestamp: nearSignature.timestamp,
    })

    await verificationDb.storeVerification({
      nearAccountId: nearSignature.accountId,
      signatureData: {
        accountId: nearSignature.accountId,
        signature: nearSignature.signature,
        publicKey: nearSignature.publicKey,
        challenge: expectedChallenge,
        timestamp: nearSignature.timestamp,
        nonce: nearSignature.nonce,
        recipient,
      },
      userContextData,
    })

    revalidateTag("verifications", "max")

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    // Treat "already verified" as success (idempotent)
    if (message.includes("already verified")) {
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
