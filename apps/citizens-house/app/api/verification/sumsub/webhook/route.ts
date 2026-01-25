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
import { logEvent } from "@/lib/logger"
import { sumsubWebhookPayloadSchema, applicantMetadataSchema } from "@/lib/schemas/sumsub"
import { SIGNATURE_VALIDATION, type NearAccountId } from "@/lib/schemas/near"
import { mapContractErrorToCode } from "@/lib/schemas"
import { setVerificationStatus, clearVerificationStatus } from "@/lib/verification-status"
import { apiError, webhookAck } from "@/lib/api/response"

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
      logEvent({
        event: "sumsub_webhook_missing_signature",
        level: "warn",
      })
      return apiError("WEBHOOK_SIGNATURE_INVALID", "Missing signature header", 401)
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      logEvent({
        event: "sumsub_webhook_invalid_signature",
        level: "warn",
      })
      return apiError("WEBHOOK_SIGNATURE_INVALID", undefined, 401)
    }

    // Parse webhook payload
    const body = JSON.parse(rawBody)
    const parseResult = sumsubWebhookPayloadSchema.safeParse(body)

    if (!parseResult.success) {
      logEvent({
        event: "sumsub_webhook_invalid_payload",
        level: "warn",
        errors: JSON.stringify(parseResult.error.issues),
      })
      return apiError("WEBHOOK_PAYLOAD_INVALID")
    }

    const payload = parseResult.data
    applicantId = payload.applicantId

    logEvent({
      event: "sumsub_webhook_received",
      level: "info",
      type: payload.type,
      applicantId,
      externalUserId: payload.externalUserId ?? "",
      reviewStatus: payload.reviewStatus ?? "",
    })

    // Handle applicantOnHold - requires manual review
    if (payload.type === "applicantOnHold") {
      const externalUserId = payload.externalUserId
      if (externalUserId) {
        await setVerificationStatus(externalUserId, "ON_HOLD")
      } else {
        logEvent({
          event: "sumsub_webhook_missing_external_user_id",
          level: "warn",
          applicantId,
        })
      }
      return webhookAck("Status updated to ON_HOLD")
    }

    // Only process applicantReviewed events beyond this point
    if (payload.type !== "applicantReviewed") {
      // Acknowledge other webhook types but don't process
      return webhookAck(`Webhook type ${payload.type} acknowledged`)
    }

    // Check if verification was approved
    const reviewAnswer = payload.reviewResult?.reviewAnswer
    if (reviewAnswer !== "GREEN") {
      logEvent({
        event: "sumsub_webhook_not_approved",
        level: "info",
        applicantId,
        reviewAnswer: reviewAnswer ?? "unknown",
        rejectLabels: JSON.stringify(payload.reviewResult?.rejectLabels ?? []),
      })

      // Handle YELLOW status - needs manual review (same as ON_HOLD)
      if (reviewAnswer === "YELLOW") {
        const externalUserId = payload.externalUserId
        if (externalUserId) {
          await setVerificationStatus(externalUserId, "ON_HOLD")
        } else {
          logEvent({
            event: "sumsub_webhook_missing_external_user_id",
            level: "warn",
            applicantId,
          })
        }
        logEvent({
          event: "sumsub_webhook_pending_review",
          level: "info",
          applicantId,
          reviewAnswer: "YELLOW",
        })
        return webhookAck("Verification pending review")
      }

      // Handle RED status - store rejection info for frontend
      if (reviewAnswer === "RED") {
        const externalUserId = payload.externalUserId
        const isRetryable = payload.reviewResult?.reviewRejectType === "RETRY"
        await setVerificationStatus(externalUserId, isRetryable ? "RETRY" : "REJECTED", {
          rejectLabels: payload.reviewResult?.rejectLabels,
          moderationComment: payload.reviewResult?.moderationComment,
        })
        return webhookAck("Verification rejected")
      }

      return webhookAck("Verification not approved")
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
      logEvent({
        event: "sumsub_webhook_missing_metadata",
        level: "error",
        applicantId,
        missingFields: metadataResult.error.issues.map((i) => i.path.join(".")).join(", "),
      })
      return apiError("MISSING_NEAR_METADATA")
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
      logEvent({
        event: "sumsub_webhook_invalid_format",
        level: "warn",
        applicantId,
        accountId,
        error: formatCheck.error ?? "Unknown validation error",
        errorCode: formatCheck.errorCode ?? "UNKNOWN",
      })

      return apiError("NEAR_SIGNATURE_INVALID", formatCheck.error)
    }

    // Calculate signature age for nonce TTL (validation already passed above)
    const signatureAge = Date.now() - signatureTimestamp

    // Verify the NEAR signature cryptographically
    const expectedChallenge = getSigningMessage()
    let recipient: string
    try {
      recipient = getSigningRecipient()
    } catch {
      logEvent({
        event: "sumsub_webhook_missing_config",
        level: "error",
        applicantId,
      })
      return apiError("BACKEND_NOT_CONFIGURED", "Missing signing recipient")
    }

    const signatureCheck = verifyNearSignature(
      expectedChallenge,
      nearMetadata.near_signature,
      nearMetadata.near_public_key,
      nearMetadata.near_nonce,
      recipient,
    )

    if (!signatureCheck.valid) {
      logEvent({
        event: "sumsub_webhook_signature_invalid",
        level: "warn",
        applicantId,
        accountId,
        error: signatureCheck.error ?? "Unknown error",
      })

      return apiError("NEAR_SIGNATURE_INVALID", signatureCheck.error)
    }

    // Verify the public key is a full-access key
    const keyCheck = await hasFullAccessKey(accountId, nearMetadata.near_public_key)
    if (!keyCheck.isFullAccess) {
      logEvent({
        event: "sumsub_webhook_not_full_access",
        level: "warn",
        applicantId,
        accountId,
        error: keyCheck.error ?? "Unknown key validation error",
      })

      return apiError("NEAR_SIGNATURE_INVALID", keyCheck.error ?? "Invalid public key")
    }

    // Reserve nonce to prevent replay attacks
    const remainingValidityMs = MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS - signatureAge
    const nonceTtlSeconds = Math.max(60, Math.ceil(remainingValidityMs / 1000))

    const nonceReserved = await reserveSignatureNonce(accountId, nearMetadata.near_nonce, nonceTtlSeconds)
    if (!nonceReserved) {
      logEvent({
        event: "sumsub_webhook_nonce_used",
        level: "warn",
        applicantId,
        accountId,
      })

      return apiError("NONCE_ALREADY_USED")
    }

    // Verify backend wallet is configured
    if (!NEAR_SERVER_CONFIG.backendAccountId || !NEAR_SERVER_CONFIG.backendPrivateKey) {
      logEvent({
        event: "sumsub_webhook_missing_backend_config",
        level: "error",
        applicantId,
      })
      return apiError("BACKEND_NOT_CONFIGURED")
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

      logEvent({
        event: "sumsub_webhook_stored_onchain",
        level: "info",
        applicantId,
        accountId,
      })

      // Clear any intermediate status from Redis now that we're on-chain
      await clearVerificationStatus(accountId)

      // Track successful verification
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "stored_onchain",
        accountId,
        attestationType: "sumsub_id_verification",
      })

      // Revalidate verifications cache
      revalidateTag("verifications", "max")

      return webhookAck("Verification stored successfully", accountId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : ""
      const errCode = mapContractErrorToCode(errorMsg)
      const errorCodeForLog = errCode ?? "UNKNOWN"

      logEvent({
        event: "sumsub_webhook_storage_failed",
        level: "error",
        applicantId,
        accountId,
        error: errorMsg,
        errorCode: errorCodeForLog,
      })

      // Store contract error status in Redis for frontend to poll
      const contractErrorCodes = ["DUPLICATE_IDENTITY", "ACCOUNT_ALREADY_VERIFIED", "CONTRACT_PAUSED"] as const
      if (errCode && contractErrorCodes.includes(errCode as (typeof contractErrorCodes)[number])) {
        await setVerificationStatus(accountId, errCode as (typeof contractErrorCodes)[number])
      }

      // Track rejection
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "rejected",
        accountId,
        reason: errorMsg,
        errorCode: errorCodeForLog,
      })

      // Use typed error code if available, otherwise generic storage failure
      if (errCode) {
        return apiError(errCode, errorMsg)
      }
      return apiError("STORAGE_FAILED", errorMsg)
    }
  } catch (error) {
    logEvent({
      event: "sumsub_webhook_error",
      level: "error",
      applicantId: applicantId ?? "unknown",
      accountId: accountId ?? "unknown",
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return apiError("STORAGE_FAILED", error instanceof Error ? error.message : "Internal server error")
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SumSub webhook endpoint",
    timestamp: new Date().toISOString(),
  })
}
