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
import { type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { verifyWebhookSignature, getApplicant, getMetadataValue } from "@/lib/providers/sumsub-provider"
import { NEAR_SERVER_CONFIG } from "@/lib/config.server"
import { setBackendKeyPoolRedis, verificationDb } from "@/lib/contracts/verification/client"
import { getRedisClient } from "@/lib/redis"
import { trackServerEvent } from "@/lib/analytics-server"
import { getSigningMessage, getSigningRecipient, verifyNearSignature, validateSignatureData } from "@/lib/verification"
import { hasFullAccessKey } from "@/lib/verification.server"
import { sumsubWebhookPayloadSchema, applicantMetadataSchema } from "@/lib/schemas/providers/sumsub"
import { type NearAccountId, nearAccountIdSchema } from "@/lib/schemas/near"
import { mapContractErrorToCode, type VerificationErrorCode } from "@/lib/schemas"
import { verificationStatusErrorCodeSchema } from "@/lib/schemas/errors"
import { setVerificationStatus, clearVerificationStatus } from "@/lib/verification-status"
import { apiError, apiSuccess, webhookAck } from "@/lib/api/response"
import { statusOkResponseSchema } from "@/lib/schemas/api/response"

/**
 * Optimistically parse externalUserId (NEAR account ID) from raw webhook body.
 * Used for analytics tracking on errors that occur before full schema validation.
 */
function tryParseExternalUserId(rawBody: string): string | undefined {
  try {
    const body = JSON.parse(rawBody)
    const externalUserId = body?.externalUserId
    if (typeof externalUserId === "string" && nearAccountIdSchema.safeParse(externalUserId).success) {
      return externalUserId
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined
}

// Initialize Redis for backend key pool
let redisInitialized = false
async function ensureRedisInitialized(): Promise<void> {
  if (redisInitialized) return
  const redis = await getRedisClient()
  setBackendKeyPoolRedis({ incr: (key: string) => redis.incr(key) })
  redisInitialized = true
}

export async function POST(request: NextRequest) {
  let accountId: NearAccountId | undefined
  let applicantId: string | undefined

  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get("x-payload-digest") || request.headers.get("x-signature")
    const algorithm = request.headers.get("x-payload-digest-alg") || "HMAC_SHA256_HEX"

    // Optimistically parse externalUserId for analytics on early errors
    const optimisticAccountId = tryParseExternalUserId(rawBody)

    if (!signature) {
      await trackServerEvent(optimisticAccountId ?? "anonymous", {
        domain: "verification",
        action: "webhook_auth_fail",
        reason: "missing_signature",
        accountId: optimisticAccountId,
      })
      return apiError("WEBHOOK_SIGNATURE_INVALID", "Missing signature header", 401)
    }

    // Verify webhook signature (supports SHA256, SHA512, SHA1 based on algorithm header)
    if (!verifyWebhookSignature(rawBody, signature, algorithm)) {
      await trackServerEvent(optimisticAccountId ?? "anonymous", {
        domain: "verification",
        action: "webhook_auth_fail",
        reason: "invalid_signature",
        accountId: optimisticAccountId,
      })
      return apiError("WEBHOOK_SIGNATURE_INVALID", undefined, 401)
    }

    // Parse webhook payload
    const body = JSON.parse(rawBody)
    const parseResult = sumsubWebhookPayloadSchema.safeParse(body)

    if (!parseResult.success) {
      await trackServerEvent(optimisticAccountId ?? "anonymous", {
        domain: "verification",
        action: "webhook_parse_fail",
        errors: JSON.stringify(parseResult.error.issues),
        accountId: optimisticAccountId,
      })
      return apiError("WEBHOOK_PAYLOAD_INVALID")
    }

    const payload = parseResult.data
    applicantId = payload.applicantId

    const reviewResult = payload.reviewResult
    const reviewAnswer = reviewResult?.reviewAnswer
    const reviewRejectType = reviewResult?.reviewRejectType
    const rejectLabels = reviewResult?.rejectLabels
    const buttonIds = reviewResult?.buttonIds
    const moderationComment = reviewResult?.moderationComment
    const clientComment = reviewResult?.clientComment

    const webhookMeta = {
      applicantId,
      inspectionId: payload.inspectionId,
      correlationId: payload.correlationId,
      levelName: payload.levelName,
      reviewStatus: payload.reviewStatus,
      reviewAnswer,
      reviewRejectType,
      rejectLabels,
      buttonIds,
      moderationComment,
      clientComment,
      reviewMode: payload.reviewMode,
      sandboxMode: payload.sandboxMode,
      applicantType: payload.applicantType,
      externalUserIdType: payload.externalUserIdType,
      clientId: payload.clientId,
      createdAtMs: payload.createdAtMs,
      createdAt: payload.createdAt,
    }

    const webhookStatusMeta = {
      applicantId,
      inspectionId: payload.inspectionId,
      correlationId: payload.correlationId,
      levelName: payload.levelName,
      reviewStatus: payload.reviewStatus,
      reviewAnswer,
    }

    await trackServerEvent(payload.externalUserId ?? applicantId, {
      domain: "verification",
      action: "webhook_receive",
      type: payload.type,
      externalUserId: payload.externalUserId,
      ...webhookMeta,
    })

    // Handle applicantOnHold - requires manual review
    if (payload.type === "applicantOnHold") {
      const externalUserId = payload.externalUserId
      if (externalUserId) {
        await setVerificationStatus(externalUserId, "VERIFICATION_ON_HOLD")
      } else {
        await trackServerEvent(applicantId, {
          domain: "verification",
          action: "webhook_user_missing",
          applicantId,
        })
      }
      return webhookAck("Status updated to VERIFICATION_ON_HOLD")
    }

    // Only process applicantReviewed events beyond this point
    if (payload.type !== "applicantReviewed") {
      // Acknowledge other webhook types but don't process
      return webhookAck(`Webhook type ${payload.type} acknowledged`)
    }

    // Check if verification was approved
    if (reviewAnswer !== "GREEN") {
      await trackServerEvent(payload.externalUserId ?? applicantId, {
        domain: "verification",
        action: "webhook_review_reject",
        applicantId,
        accountId: payload.externalUserId as NearAccountId | undefined,
        reviewAnswer,
        reviewRejectType,
        rejectLabels,
        buttonIds,
        moderationComment,
        clientComment,
        reviewStatus: payload.reviewStatus,
        levelName: payload.levelName,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
      })

      // Handle YELLOW status - needs manual review (VERIFICATION_ON_HOLD)
      if (reviewAnswer === "YELLOW") {
        const externalUserId = payload.externalUserId
        if (externalUserId) {
          await setVerificationStatus(externalUserId, "VERIFICATION_ON_HOLD")
        } else {
          await trackServerEvent(applicantId, {
            domain: "verification",
            action: "webhook_user_missing",
            applicantId,
          })
        }
        await trackServerEvent(externalUserId ?? applicantId, {
          domain: "verification",
          action: "webhook_review_hold",
          applicantId,
          accountId: externalUserId as NearAccountId | undefined,
          reviewAnswer,
          reviewRejectType,
          reviewStatus: payload.reviewStatus,
          levelName: payload.levelName,
          inspectionId: payload.inspectionId,
          correlationId: payload.correlationId,
        })
        return webhookAck("Verification pending review")
      }

      // Handle RED status - store rejection info for frontend
      if (reviewAnswer === "RED") {
        const externalUserId = payload.externalUserId

        // Check if already approved on-chain before storing rejection
        // (Late RED can occur after approval, e.g., fraud detection)
        if (externalUserId) {
          const { checkIsVerified } = await import("@/app/citizens/actions")
          const isVerified = await checkIsVerified(externalUserId as NearAccountId)
          if (isVerified) {
            await trackServerEvent(externalUserId, {
              domain: "verification",
              action: "webhook_review_late_reject",
              applicantId,
              accountId: externalUserId as NearAccountId,
              reviewAnswer,
              reviewRejectType,
              rejectLabels,
            })
            // Don't update Redis - on-chain approval stands
            return webhookAck("Late rejection logged (already approved on-chain)")
          }
        }

        const isRetryable = payload.reviewResult?.reviewRejectType === "RETRY"
        await setVerificationStatus(externalUserId, isRetryable ? "VERIFICATION_RETRY" : "VERIFICATION_REJECTED")
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
      await trackServerEvent(payload.externalUserId ?? applicantId, {
        domain: "verification",
        action: "webhook_validation_fail",
        reason: "missing_metadata",
        applicantId,
        accountId: payload.externalUserId as NearAccountId | undefined,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
        levelName: payload.levelName,
        reviewStatus: payload.reviewStatus,
      })
      return apiError("MISSING_NEAR_METADATA")
    }

    const nearMetadata = metadataResult.data
    accountId = nearMetadata.near_account_id
    const signatureTimestamp = parseInt(nearMetadata.near_timestamp, 10)
    const verificationAttemptId = nearMetadata.near_nonce

    // Security: Verify externalUserId matches metadata to prevent request tampering
    if (payload.externalUserId && payload.externalUserId !== accountId) {
      await trackServerEvent(applicantId, {
        domain: "verification",
        action: "webhook_validation_fail",
        reason: "user_mismatch",
        applicantId,
        accountId,
        verificationAttemptId,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
        levelName: payload.levelName,
        reviewStatus: payload.reviewStatus,
      })
      return apiError("WEBHOOK_PAYLOAD_INVALID", "User ID mismatch", 400)
    }

    // Track proof submission (metadata received and validated)
    await trackServerEvent(accountId, {
      domain: "verification",
      action: "proof_submit",
      accountId,
      verificationAttemptId,
      ...webhookStatusMeta,
    })

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
      const code = (formatCheck.errorCode as VerificationErrorCode) ?? "NEAR_SIGNATURE_INVALID"
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "webhook_validation_fail",
        reason: "signature_format",
        applicantId,
        accountId,
        errorMessage: formatCheck.error,
        verificationAttemptId,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
        levelName: payload.levelName,
        reviewStatus: payload.reviewStatus,
      })

      return apiError(code, formatCheck.error, 400)
    }

    // Verify the NEAR signature cryptographically
    const expectedChallenge = getSigningMessage()
    let recipient: string
    try {
      recipient = getSigningRecipient()
    } catch {
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "webhook_config_error",
        applicantId,
        configKey: "signing_recipient",
        accountId,
        verificationAttemptId,
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
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "webhook_validation_fail",
        reason: "signature_crypto",
        applicantId,
        accountId,
        errorMessage: signatureCheck.error,
        verificationAttemptId,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
        levelName: payload.levelName,
        reviewStatus: payload.reviewStatus,
      })

      return apiError("NEAR_SIGNATURE_INVALID", signatureCheck.error, 400)
    }

    // Track proof validation (signature verified cryptographically)
    await trackServerEvent(accountId, {
      domain: "verification",
      action: "proof_validate",
      accountId,
      verificationAttemptId,
      ...webhookStatusMeta,
    })

    // Verify the public key is a full-access key
    const keyCheck = await hasFullAccessKey(accountId, nearMetadata.near_public_key)
    if (!keyCheck.isFullAccess) {
      const errorMsg = keyCheck.error ?? "Invalid public key"
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "webhook_validation_fail",
        reason: "key_not_full_access",
        applicantId,
        accountId,
        errorMessage: errorMsg,
        verificationAttemptId,
        inspectionId: payload.inspectionId,
        correlationId: payload.correlationId,
        levelName: payload.levelName,
        reviewStatus: payload.reviewStatus,
      })

      return apiError("NEAR_SIGNATURE_INVALID", errorMsg, 400)
    }

    // NOTE: Nonce is reserved in token API with 24h TTL to cover SumSub's full retry window.
    // Webhook retries are now naturally idempotent via contract-level checks
    // (ACCOUNT_ALREADY_VERIFIED, DUPLICATE_IDENTITY).

    // Verify backend wallet is configured
    if (!NEAR_SERVER_CONFIG.backendAccountId || !NEAR_SERVER_CONFIG.backendPrivateKey) {
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "webhook_config_error",
        applicantId,
        configKey: "backend_signer",
        accountId,
        verificationAttemptId,
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

      // Clear any intermediate status from Redis now that we're on-chain
      await clearVerificationStatus(accountId)

      // Track successful verification
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "onchain_store_success",
        accountId,
        verificationAttemptId,
        ...webhookStatusMeta,
      })

      // Revalidate verifications cache
      revalidateTag("verifications", "max")

      return webhookAck("Verification stored successfully", accountId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : ""
      const errCode = mapContractErrorToCode(errorMsg)
      const errorCodeForLog = errCode ?? "UNKNOWN"

      await trackServerEvent(accountId, {
        domain: "verification",
        action: "webhook_storage_fail",
        applicantId,
        accountId,
        errorCode: errorCodeForLog,
        errorMessage: errorMsg,
        verificationAttemptId,
        reviewStatus: payload.reviewStatus,
        reviewAnswer,
      })

      if (errCode === "ACCOUNT_ALREADY_VERIFIED") {
        // Idempotent success: avoid surfacing false failures on webhook retries.
        await clearVerificationStatus(accountId)
        return webhookAck("Already verified", accountId)
      }

      // Store contract error status in Redis for frontend to poll
      if (errCode) {
        const statusCode = verificationStatusErrorCodeSchema.safeParse(errCode)
        if (statusCode.success) {
          await setVerificationStatus(accountId, statusCode.data)
        }
      }

      // Track rejection
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "onchain_store_reject",
        accountId,
        reason: errorMsg,
        errorCode: errorCodeForLog,
        applicantId,
        verificationAttemptId,
      })

      // Use typed error code if available, otherwise generic storage failure
      if (errCode) {
        return apiError(errCode, errorMsg)
      }
      return apiError("STORAGE_FAILED", errorMsg)
    }
  } catch (error) {
    await trackServerEvent(accountId ?? applicantId ?? "anonymous", {
      domain: "verification",
      action: "webhook_error",
      applicantId,
      accountId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })

    return apiError("STORAGE_FAILED", error instanceof Error ? error.message : "Internal server error")
  }
}

export async function GET() {
  const response = statusOkResponseSchema.parse({
    status: "ok",
    message: "SumSub webhook endpoint",
    timestamp: new Date().toISOString(),
  })

  return apiSuccess(response)
}
