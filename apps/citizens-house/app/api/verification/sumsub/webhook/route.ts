/**
 * SumSub Webhook Handler
 *
 * Handles verification completion webhooks from SumSub.
 * When a user completes KYC verification (applicantReviewed event with GREEN status),
 * this handler:
 * 1. Verifies the webhook signature
 * 2. Validates the NEAR signature stored in applicant metadata
 * 3. Stores the verification on-chain
 */
import { type NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { verifyWebhookSignature, getApplicant, getMetadataValue } from "@/lib/providers/sumsub-provider"
import { NEAR_SERVER_CONFIG } from "@/lib/config.server"
import { setBackendKeyPoolRedis, verificationDb } from "@/lib/contracts/verification/client"
import { reserveSignatureNonce } from "@/lib/nonce-store"
import { getRedisClient } from "@/lib/redis"
import { trackServerEvent } from "@/lib/analytics-server"
import { getSigningMessage, getSigningRecipient, verifyNearSignature, validateSignatureData } from "@/lib/verification"
import { hasFullAccessKey } from "@/lib/verification.server"
import { logger } from "@/lib/logger"
import { isNonRetryableError } from "@/lib/schemas/errors"
import { sumsubWebhookPayloadSchema, applicantMetadataSchema } from "@/lib/schemas/sumsub"
import { SIGNATURE_VALIDATION, type NearAccountId } from "@/lib/schemas/near"
import { mapContractErrorToCode } from "@/lib/schemas"

// Initialize Redis for backend key pool
let redisInitialized = false
async function ensureRedisInitialized(): Promise<void> {
  if (redisInitialized) return
  const redis = await getRedisClient()
  setBackendKeyPoolRedis({ incr: (key: string) => redis.incr(key) })
  redisInitialized = true
}

// Use shared constants from schemas
const MAX_SIGNATURE_AGE_MS = SIGNATURE_VALIDATION.MAX_AGE_MS
const CLOCK_SKEW_MS = SIGNATURE_VALIDATION.CLOCK_SKEW_MS

export async function POST(request: NextRequest) {
  let accountId: NearAccountId | undefined
  let applicantId: string | undefined

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get("x-payload-digest") || request.headers.get("x-signature")

    if (!signature) {
      logger.warn("sumsub_webhook_missing_signature", {})
      return NextResponse.json({ error: "Missing signature header" }, { status: 401 })
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn("sumsub_webhook_invalid_signature", {})
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Parse webhook payload
    const body = JSON.parse(rawBody)
    const parseResult = sumsubWebhookPayloadSchema.safeParse(body)

    if (!parseResult.success) {
      logger.warn("sumsub_webhook_invalid_payload", {
        errors: JSON.stringify(parseResult.error.issues),
      })
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const payload = parseResult.data
    applicantId = payload.applicantId

    logger.info("sumsub_webhook_received", {
      type: payload.type,
      applicantId,
      externalUserId: payload.externalUserId ?? "",
      reviewStatus: payload.reviewStatus ?? "",
    })

    // Only process applicantReviewed events
    if (payload.type !== "applicantReviewed") {
      // Acknowledge other webhook types but don't process
      return NextResponse.json({ status: "ok", message: `Webhook type ${payload.type} acknowledged` })
    }

    // Check if verification was approved
    const reviewAnswer = payload.reviewResult?.reviewAnswer
    if (reviewAnswer !== "GREEN") {
      logger.info("sumsub_webhook_not_approved", {
        applicantId,
        reviewAnswer: reviewAnswer ?? "unknown",
        rejectLabels: JSON.stringify(payload.reviewResult?.rejectLabels ?? []),
      })

      return NextResponse.json({ status: "ok", message: "Verification not approved" })
    }

    // Fetch applicant data with metadata
    const applicant = await getApplicant(applicantId)

    // Extract NEAR signature data from metadata
    const metadata = {
      near_account_id: getMetadataValue(applicant.metadata, "near_account_id"),
      near_signature: getMetadataValue(applicant.metadata, "near_signature"),
      near_public_key: getMetadataValue(applicant.metadata, "near_public_key"),
      near_nonce: getMetadataValue(applicant.metadata, "near_nonce"),
      near_timestamp: getMetadataValue(applicant.metadata, "near_timestamp"),
    }

    const metadataResult = applicantMetadataSchema.safeParse(metadata)
    if (!metadataResult.success) {
      logger.error("sumsub_webhook_missing_metadata", {
        applicantId,
        missingFields: metadataResult.error.issues.map((i) => i.path.join(".")).join(", "),
      })
      return NextResponse.json({ error: "Missing NEAR metadata on applicant" }, { status: 400 })
    }

    const nearMetadata = metadataResult.data
    accountId = nearMetadata.near_account_id
    const signatureTimestamp = parseInt(nearMetadata.near_timestamp, 10)

    // Validate signature data format (timestamp format, nonce format, public key format)
    const formatCheck = validateSignatureData(
      {
        timestamp: signatureTimestamp,
        nonce: nearMetadata.near_nonce,
        publicKey: nearMetadata.near_public_key,
      },
      { skipFreshness: true },
    )

    if (!formatCheck.valid) {
      logger.warn("sumsub_webhook_invalid_format", {
        applicantId,
        accountId,
        error: formatCheck.error ?? "Unknown validation error",
        errorCode: formatCheck.errorCode ?? "UNKNOWN",
      })

      return NextResponse.json({ error: formatCheck.error ?? "Invalid signature data" }, { status: 400 })
    }

    // Calculate signature age for nonce TTL (validation already passed above)
    const signatureAge = Date.now() - signatureTimestamp

    // Verify the NEAR signature cryptographically
    const expectedChallenge = getSigningMessage()
    let recipient: string
    try {
      recipient = getSigningRecipient()
    } catch {
      logger.error("sumsub_webhook_missing_config", { applicantId })
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const signatureCheck = verifyNearSignature(
      expectedChallenge,
      nearMetadata.near_signature,
      nearMetadata.near_public_key,
      nearMetadata.near_nonce,
      recipient,
    )

    if (!signatureCheck.valid) {
      logger.warn("sumsub_webhook_signature_invalid", {
        applicantId,
        accountId,
        error: signatureCheck.error ?? "Unknown error",
      })

      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    // Verify the public key is a full-access key
    const keyCheck = await hasFullAccessKey(accountId, nearMetadata.near_public_key)
    if (!keyCheck.isFullAccess) {
      logger.warn("sumsub_webhook_not_full_access", {
        applicantId,
        accountId,
        error: keyCheck.error ?? "Unknown key validation error",
      })

      return NextResponse.json({ error: keyCheck.error ?? "Invalid public key" }, { status: 400 })
    }

    // Reserve nonce to prevent replay attacks
    const remainingValidityMs = MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS - signatureAge
    const nonceTtlSeconds = Math.max(60, Math.ceil(remainingValidityMs / 1000))

    const nonceReserved = await reserveSignatureNonce(accountId, nearMetadata.near_nonce, nonceTtlSeconds)
    if (!nonceReserved) {
      logger.warn("sumsub_webhook_nonce_used", {
        applicantId,
        accountId,
      })

      return NextResponse.json({ error: "Nonce already used" }, { status: 400 })
    }

    // Verify backend wallet is configured
    if (!NEAR_SERVER_CONFIG.backendAccountId || !NEAR_SERVER_CONFIG.backendPrivateKey) {
      logger.error("sumsub_webhook_missing_backend_config", { applicantId })
      return NextResponse.json({ error: "Backend not configured" }, { status: 500 })
    }

    // Create user context data with signature info
    const userContextData = JSON.stringify({
      accountId,
      publicKey: nearMetadata.near_public_key,
      signature: nearMetadata.near_signature,
      nonce: nearMetadata.near_nonce,
      timestamp: signatureTimestamp,
    })

    // Initialize Redis for backend key pool
    await ensureRedisInitialized()

    // Store verification on-chain
    try {
      await verificationDb.storeVerification({
        nearAccountId: accountId,
        signatureData: {
          accountId,
          signature: nearMetadata.near_signature,
          publicKey: nearMetadata.near_public_key,
          challenge: expectedChallenge,
          timestamp: signatureTimestamp,
          nonce: nearMetadata.near_nonce,
          recipient,
        },
        userContextData,
      })

      logger.info("sumsub_webhook_stored_onchain", {
        applicantId,
        accountId,
      })

      // Track successful verification
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "stored_onchain",
        accountId,
        attestationType: "sumsub_id_verification",
      })

      // Revalidate verifications cache
      revalidateTag("verifications", "max")

      return NextResponse.json({
        status: "ok",
        message: "Verification stored successfully",
        accountId,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : ""
      const errCode = mapContractErrorToCode(errorMsg)

      logger.error("sumsub_webhook_storage_failed", {
        applicantId,
        accountId,
        error: errorMsg,
        errorCode: errCode,
      })

      // Track rejection
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "rejected",
        accountId,
        reason: errorMsg,
        errorCode: errCode,
      })

      return NextResponse.json(
        { error: errorMsg || "Failed to store verification" },
        { status: isNonRetryableError(errCode) ? 400 : 500 },
      )
    }
  } catch (error) {
    logger.error("sumsub_webhook_error", {
      applicantId: applicantId ?? "unknown",
      accountId: accountId ?? "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SumSub webhook endpoint",
    timestamp: new Date().toISOString(),
  })
}
