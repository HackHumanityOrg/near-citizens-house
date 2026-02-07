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
import * as Sentry from "@sentry/nextjs"
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
import { withLogging } from "@/lib/api/with-logging"

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

export const POST = withLogging(
  { route: "POST /api/verification/sumsub/webhook" },
  async (request: NextRequest, log) => {
    let accountId: NearAccountId | undefined
    let applicantId: string | undefined

    try {
      // Get raw body for signature verification
      const rawBody = await request.text()
      const signature = request.headers.get("x-payload-digest") || request.headers.get("x-signature")
      const algorithm = request.headers.get("x-payload-digest-alg") || "HMAC_SHA256_HEX"
      log.setAll({
        webhook_signature_present: Boolean(signature),
        webhook_signature_algorithm: algorithm,
      })

      // Optimistically parse externalUserId for analytics on early errors
      const optimisticAccountId = tryParseExternalUserId(rawBody)

      if (!signature) {
        await trackServerEvent(optimisticAccountId ?? "anonymous", {
          domain: "verification",
          action: "webhook_auth_fail",
          reason: "missing_signature",
          accountId: optimisticAccountId,
        })
        log.setAll({ webhook_outcome: "missing_signature", error_code: "WEBHOOK_SIGNATURE_INVALID" })
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
        log.setAll({ webhook_outcome: "invalid_signature", error_code: "WEBHOOK_SIGNATURE_INVALID" })
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
        log.setAll({ webhook_outcome: "payload_invalid", error_code: "WEBHOOK_PAYLOAD_INVALID" })
        return apiError("WEBHOOK_PAYLOAD_INVALID")
      }

      const payload = parseResult.data
      applicantId = payload.applicantId

      // Extract all webhook fields for consistent usage
      const {
        inspectionId,
        correlationId,
        levelName,
        reviewStatus,
        reviewMode,
        sandboxMode,
        applicantType,
        externalUserIdType,
        clientId,
        createdAtMs,
        createdAt,
        externalUserId,
        reviewResult,
      } = payload

      const reviewAnswer = reviewResult?.reviewAnswer
      const reviewRejectType = reviewResult?.reviewRejectType
      const rejectLabels = reviewResult?.rejectLabels
      const buttonIds = reviewResult?.buttonIds
      const moderationComment = reviewResult?.moderationComment
      const clientComment = reviewResult?.clientComment

      const webhookMeta = {
        applicantId,
        inspectionId,
        correlationId,
        levelName,
        reviewStatus,
        reviewAnswer,
        reviewRejectType,
        rejectLabels,
        buttonIds,
        moderationComment,
        clientComment,
        reviewMode,
        sandboxMode,
        applicantType,
        externalUserIdType,
        clientId,
        createdAtMs,
        createdAt,
      }

      log.setAll({
        webhook_type: payload.type,
        applicant_id: applicantId,
        review_answer: reviewAnswer ?? "none",
        external_user_id: externalUserId ?? "unknown",
      })

      await trackServerEvent(externalUserId ?? applicantId, {
        domain: "verification",
        action: "webhook_receive",
        type: payload.type,
        externalUserId,
        ...webhookMeta,
      })

      // Handle applicantOnHold - requires manual review
      if (payload.type === "applicantOnHold") {
        if (externalUserId) {
          await Sentry.startSpan(
            {
              name: "setVerificationStatus",
              op: "db.redis",
              attributes: { account_id: externalUserId, status: "VERIFICATION_ON_HOLD" },
            },
            () => setVerificationStatus(externalUserId, "VERIFICATION_ON_HOLD"),
          )
        } else {
          await trackServerEvent(applicantId, {
            domain: "verification",
            action: "webhook_user_missing",
            ...webhookMeta,
          })
        }
        log.set("webhook_outcome", "hold")
        return webhookAck("Status updated to VERIFICATION_ON_HOLD")
      }

      // Only process applicantReviewed events beyond this point
      if (payload.type !== "applicantReviewed") {
        // Acknowledge other webhook types but don't process
        log.set("webhook_outcome", "ack_other")
        return webhookAck(`Webhook type ${payload.type} acknowledged`)
      }

      // Check if verification was approved
      if (reviewAnswer !== "GREEN") {
        await trackServerEvent(externalUserId ?? applicantId, {
          domain: "verification",
          action: "webhook_review_reject",
          ...webhookMeta,
          accountId: externalUserId as NearAccountId | undefined,
        })

        // Handle YELLOW status - needs manual review (VERIFICATION_ON_HOLD)
        if (reviewAnswer === "YELLOW") {
          if (externalUserId) {
            await Sentry.startSpan(
              {
                name: "setVerificationStatus",
                op: "db.redis",
                attributes: { account_id: externalUserId, status: "VERIFICATION_ON_HOLD" },
              },
              () => setVerificationStatus(externalUserId, "VERIFICATION_ON_HOLD"),
            )
          } else {
            await trackServerEvent(applicantId, {
              domain: "verification",
              action: "webhook_user_missing",
              ...webhookMeta,
            })
          }
          await trackServerEvent(externalUserId ?? applicantId, {
            domain: "verification",
            action: "webhook_review_hold",
            ...webhookMeta,
            accountId: externalUserId as NearAccountId | undefined,
          })
          log.set("webhook_outcome", "reject_yellow")
          return webhookAck("Verification pending review")
        }

        // Handle RED status - store rejection info for frontend
        if (reviewAnswer === "RED") {
          // Check if already approved on-chain before storing rejection
          // (Late RED can occur after approval, e.g., fraud detection)
          if (externalUserId) {
            const { checkIsVerified } = await import("@/app/citizens/actions")
            const isVerified = await checkIsVerified(externalUserId as NearAccountId)
            if (isVerified) {
              await trackServerEvent(externalUserId, {
                domain: "verification",
                action: "webhook_review_late_reject",
                ...webhookMeta,
                accountId: externalUserId as NearAccountId,
              })
              // Don't update Redis - on-chain approval stands
              log.set("webhook_outcome", "reject_red_late")
              return webhookAck("Late rejection logged (already approved on-chain)")
            }
          }

          const isRetryable = reviewRejectType === "RETRY"
          await Sentry.startSpan(
            {
              name: "setVerificationStatus",
              op: "db.redis",
              attributes: {
                account_id: externalUserId,
                status: isRetryable ? "VERIFICATION_RETRY" : "VERIFICATION_REJECTED",
              },
            },
            () => setVerificationStatus(externalUserId, isRetryable ? "VERIFICATION_RETRY" : "VERIFICATION_REJECTED"),
          )
          log.set("webhook_outcome", isRetryable ? "reject_red_retry" : "reject_red_final")
          return webhookAck("Verification rejected")
        }

        log.set("webhook_outcome", "not_approved")
        return webhookAck("Verification not approved")
      }

      // Fetch applicant data with metadata
      // applicantId is guaranteed to be defined here (assigned from validated payload above)
      const validApplicantId = applicantId as string
      const applicant = await Sentry.startSpan(
        {
          name: "getApplicant",
          op: "http.client",
          attributes: { "peer.service": "sumsub", applicant_id: validApplicantId },
        },
        () => getApplicant(validApplicantId),
      )

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
        await trackServerEvent(externalUserId ?? applicantId, {
          domain: "verification",
          action: "webhook_validation_fail",
          reason: "missing_metadata",
          ...webhookMeta,
          accountId: externalUserId as NearAccountId | undefined,
        })
        log.setAll({ webhook_outcome: "metadata_missing", error_code: "MISSING_NEAR_METADATA" })
        return apiError("MISSING_NEAR_METADATA")
      }

      const nearMetadata = metadataResult.data
      // accountId is guaranteed to be defined here (assigned from validated metadata)
      const validAccountId = nearMetadata.near_account_id
      accountId = validAccountId
      const signatureTimestamp = parseInt(nearMetadata.near_timestamp, 10)
      const verificationAttemptId = nearMetadata.near_nonce

      log.set("account_id", accountId)

      // Security: Verify externalUserId matches metadata to prevent request tampering
      if (externalUserId && externalUserId !== accountId) {
        await trackServerEvent(applicantId, {
          domain: "verification",
          action: "webhook_validation_fail",
          reason: "user_mismatch",
          ...webhookMeta,
          accountId,
          verificationAttemptId,
        })
        log.setAll({ webhook_outcome: "user_mismatch", error_code: "WEBHOOK_PAYLOAD_INVALID" })
        return apiError("WEBHOOK_PAYLOAD_INVALID", "User ID mismatch", 400)
      }

      // Track proof submission (metadata received and validated)
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "proof_submit",
        accountId,
        verificationAttemptId,
        ...webhookMeta,
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
          ...webhookMeta,
          accountId,
          errorMessage: formatCheck.error,
          verificationAttemptId,
        })

        log.setAll({ webhook_outcome: "signature_format_invalid", error_code: code })
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
        log.setAll({ webhook_outcome: "backend_not_configured", error_code: "BACKEND_NOT_CONFIGURED" })
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
          ...webhookMeta,
          accountId,
          errorMessage: signatureCheck.error,
          verificationAttemptId,
        })

        log.setAll({ webhook_outcome: "signature_crypto_invalid", error_code: "NEAR_SIGNATURE_INVALID" })
        return apiError("NEAR_SIGNATURE_INVALID", signatureCheck.error, 400)
      }

      // Track proof validation (signature verified cryptographically)
      await trackServerEvent(accountId, {
        domain: "verification",
        action: "proof_validate",
        accountId,
        verificationAttemptId,
        ...webhookMeta,
      })

      // Verify the public key is a full-access key
      const keyCheck = await Sentry.startSpan(
        {
          name: "hasFullAccessKey",
          op: "http.client",
          attributes: { "peer.service": "near-rpc", account_id: validAccountId },
        },
        () => hasFullAccessKey(validAccountId, nearMetadata.near_public_key),
      )
      if (!keyCheck.isFullAccess) {
        const errorMsg = keyCheck.error ?? "Invalid public key"
        await trackServerEvent(accountId, {
          domain: "verification",
          action: "webhook_validation_fail",
          reason: "key_not_full_access",
          ...webhookMeta,
          accountId,
          errorMessage: errorMsg,
          verificationAttemptId,
        })

        log.setAll({ webhook_outcome: "key_not_full_access", error_code: "NEAR_SIGNATURE_INVALID" })
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
        log.setAll({ webhook_outcome: "backend_not_configured", error_code: "BACKEND_NOT_CONFIGURED" })
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
      await Sentry.startSpan(
        {
          name: "ensureRedisInitialized",
          op: "db.redis",
          attributes: { account_id: validAccountId },
        },
        () => ensureRedisInitialized(),
      )

      // Store verification on-chain
      try {
        await Sentry.startSpan(
          {
            name: "storeVerification",
            op: "http.client",
            attributes: { "peer.service": "near-contract", account_id: validAccountId },
          },
          () =>
            verificationDb.storeVerification({
              nearAccountId: validAccountId,
              signatureData: {
                accountId: validAccountId,
                signature: nearMetadata.near_signature,
                publicKey: nearMetadata.near_public_key,
                challenge: expectedChallenge,
                timestamp: signatureTimestamp,
                nonce: nearMetadata.near_nonce,
                recipient,
              },
              userContextData,
            }),
        )

        // Clear any intermediate status from Redis now that we're on-chain
        await Sentry.startSpan(
          {
            name: "clearVerificationStatus",
            op: "db.redis",
            attributes: { account_id: validAccountId },
          },
          () => clearVerificationStatus(validAccountId),
        )

        // Track successful verification
        await trackServerEvent(validAccountId, {
          domain: "verification",
          action: "onchain_store_success",
          accountId: validAccountId,
          verificationAttemptId,
          ...webhookMeta,
        })

        // Revalidate verifications cache
        revalidateTag("verifications", "max")

        log.set("webhook_outcome", "onchain_stored")
        return webhookAck("Verification stored successfully", validAccountId)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : ""
        const errCode = mapContractErrorToCode(errorMsg)
        const errorCodeForLog = errCode ?? "UNKNOWN"

        await trackServerEvent(validAccountId, {
          domain: "verification",
          action: "webhook_storage_fail",
          ...webhookMeta,
          accountId: validAccountId,
          errorCode: errorCodeForLog,
          errorMessage: errorMsg,
          verificationAttemptId,
        })

        if (errCode === "ACCOUNT_ALREADY_VERIFIED") {
          // Idempotent success: avoid surfacing false failures on webhook retries.
          await Sentry.startSpan(
            {
              name: "clearVerificationStatus",
              op: "db.redis",
              attributes: { account_id: validAccountId },
            },
            () => clearVerificationStatus(validAccountId),
          )
          log.set("webhook_outcome", "already_verified")
          return webhookAck("Already verified", validAccountId)
        }

        // Store contract error status in Redis for frontend to poll
        if (errCode) {
          const statusCode = verificationStatusErrorCodeSchema.safeParse(errCode)
          if (statusCode.success) {
            await Sentry.startSpan(
              {
                name: "setVerificationStatus",
                op: "db.redis",
                attributes: { account_id: validAccountId, status: statusCode.data },
              },
              () => setVerificationStatus(validAccountId, statusCode.data),
            )
          }
        }

        // Track rejection
        await trackServerEvent(validAccountId, {
          domain: "verification",
          action: "onchain_store_reject",
          ...webhookMeta,
          accountId: validAccountId,
          reason: errorMsg,
          errorCode: errorCodeForLog,
          verificationAttemptId,
        })

        log.setAll({ webhook_outcome: "onchain_store_failed", error_code: errorCodeForLog, error_message: errorMsg })

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

      log.setAll({
        error_code: "STORAGE_FAILED",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      return apiError("STORAGE_FAILED", error instanceof Error ? error.message : "Internal server error")
    }
  },
)

export const GET = withLogging({ route: "GET /api/verification/sumsub/webhook" }, async (_request: NextRequest) => {
  const response = statusOkResponseSchema.parse({
    status: "ok",
    message: "SumSub webhook endpoint",
    timestamp: new Date().toISOString(),
  })

  return apiSuccess(response)
})
