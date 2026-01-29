/**
 * SumSub Access Token API
 *
 * Generates an access token for the SumSub WebSDK and stores NEAR signature
 * metadata on the applicant for verification when the webhook is received.
 *
 * SECURITY: This route validates the NEAR signature BEFORE generating a SumSub
 * access token to prevent attackers from associating their KYC with another
 * user's NEAR account. The nonce is reserved here with 10min TTL to match
 * the signature freshness window during the step 1 → step 2 transition.
 */
import { type NextRequest } from "next/server"
import {
  createApplicant,
  generateAccessToken,
  updateApplicantMetadata,
  getApplicantByExternalUserId,
} from "@/lib/providers/sumsub-provider"
import { clearVerificationStatus } from "@/lib/verification-status"
import { reserveSignatureNonce } from "@/lib/nonce-store"
import { env } from "@/lib/schemas/env"
import { verificationTokenRequestSchema, verificationTokenResponseSchema } from "@/lib/schemas/api/verification"
import { type SumSubMetadataItem, type SumSubApplicant } from "@/lib/schemas/providers/sumsub"
import { trackServerEvent } from "@/lib/analytics-server"
import { validateSignatureData, verifyNearSignature, getSigningMessage, getSigningRecipient } from "@/lib/verification"
import { hasFullAccessKey } from "@/lib/verification.server"
import { apiError, apiSuccess } from "@/lib/api/response"
import { type VerificationErrorCode } from "@/lib/schemas/errors"
import { statusOkResponseSchema } from "@/lib/schemas/api/response"
import { nearAccountIdSchema } from "@/lib/schemas/near"

/**
 * Optimistically parse accountId from request body before full validation.
 * Used for analytics tracking on errors that occur before full schema validation.
 */
function tryParseAccountId(body: unknown): string | undefined {
  try {
    if (typeof body === "object" && body !== null) {
      const obj = body as Record<string, unknown>
      const nearSig = obj.nearSignature as Record<string, unknown> | undefined
      const accountId = nearSig?.accountId
      if (typeof accountId === "string" && nearAccountIdSchema.safeParse(accountId).success) {
        return accountId
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return undefined
}

export async function POST(request: NextRequest) {
  // Parse body early for optimistic accountId extraction in error handling
  let body: unknown
  let optimisticAccountId: string | undefined
  let verificationAttemptId: string | undefined

  try {
    body = await request.json()
    optimisticAccountId = tryParseAccountId(body)

    // Validate request schema
    const parseResult = verificationTokenRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      return apiError("INVALID_REQUEST", issues)
    }

    const { nearSignature } = parseResult.data
    verificationAttemptId = nearSignature.nonce
    const levelName = env.NEXT_PUBLIC_SUMSUB_LEVEL_NAME

    // ==================== SECURITY: Validate NEAR signature ====================
    // This prevents attackers from associating their KYC with another user's account

    // 1. Validate signature data format (timestamp, nonce, publicKey)
    const formatCheck = validateSignatureData({
      timestamp: nearSignature.timestamp,
      nonce: nearSignature.nonce,
      publicKey: nearSignature.publicKey,
    })

    if (!formatCheck.valid) {
      const code = (formatCheck.errorCode as VerificationErrorCode) ?? "NEAR_SIGNATURE_INVALID"
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "token_validate_fail",
        accountId: nearSignature.accountId,
        reason: "signature_format",
        errorCode: code,
        errorMessage: formatCheck.error,
        verificationAttemptId,
        levelName,
      })
      return apiError(code, formatCheck.error)
    }

    // 2. Verify NEAR signature cryptographically (NEP-413)
    const expectedChallenge = getSigningMessage()
    let recipient: string
    try {
      recipient = getSigningRecipient()
    } catch {
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "token_config_error",
        accountId: nearSignature.accountId,
        verificationAttemptId,
        levelName,
      })
      return apiError("BACKEND_NOT_CONFIGURED", "Missing signing recipient")
    }

    const signatureCheck = verifyNearSignature(
      expectedChallenge,
      nearSignature.signature,
      nearSignature.publicKey,
      nearSignature.nonce,
      recipient,
    )

    if (!signatureCheck.valid) {
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "token_validate_fail",
        accountId: nearSignature.accountId,
        reason: "signature_crypto",
        errorMessage: signatureCheck.error,
        verificationAttemptId,
        levelName,
      })
      return apiError("NEAR_SIGNATURE_INVALID", signatureCheck.error)
    }

    // 3. Verify public key is a full-access key via NEAR RPC
    const keyCheck = await hasFullAccessKey(nearSignature.accountId, nearSignature.publicKey)
    if (!keyCheck.isFullAccess) {
      const errorMsg = keyCheck.error ?? "Public key is not an active full-access key"
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "token_validate_fail",
        accountId: nearSignature.accountId,
        reason: "key_not_full_access",
        errorMessage: errorMsg,
        verificationAttemptId,
        levelName,
      })
      return apiError("NEAR_SIGNATURE_INVALID", errorMsg)
    }

    // 4. Reserve nonce to prevent replay attacks
    const NONCE_TTL_SECONDS = 10 * 60 // 10 minutes - matches signature freshness window
    const nonceReserved = await reserveSignatureNonce(nearSignature.accountId, nearSignature.nonce, NONCE_TTL_SECONDS)
    if (!nonceReserved) {
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "token_validate_fail",
        accountId: nearSignature.accountId,
        reason: "nonce_replay",
        verificationAttemptId,
        levelName,
      })
      return apiError("NONCE_ALREADY_USED")
    }

    // NOTE: If user fails SumSub verification, they'll need to sign a new message.
    // This is acceptable since the signature is bound to this verification attempt.

    // ==================== Check if already verified ====================
    // Prevent already-verified users from re-entering the verification flow
    const { checkIsVerified } = await import("@/app/citizens/actions")
    const isAlreadyVerified = await checkIsVerified(nearSignature.accountId)
    if (isAlreadyVerified) {
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "token_already_verified",
        accountId: nearSignature.accountId,
        verificationAttemptId,
        levelName,
      })
      return apiError("ACCOUNT_ALREADY_VERIFIED")
    }

    // ==================== Generate SumSub token ====================

    // Use NEAR account ID as external user ID in SumSub
    const externalUserId = nearSignature.accountId
    // Step 1: Create or get existing applicant
    // This guarantees the applicant exists before we try to update metadata
    let applicant: SumSubApplicant
    try {
      applicant = await createApplicant(externalUserId, levelName)
    } catch (error) {
      // If applicant already exists (409 Conflict), fetch it
      if (error instanceof Error && error.message.includes("409")) {
        applicant = await getApplicantByExternalUserId(externalUserId)

        // Clear stale rejection status from previous attempt
        // This prevents resubmitting users from seeing a flash of the old rejection screen
        await clearVerificationStatus(externalUserId)

        await trackServerEvent(nearSignature.accountId, {
          domain: "verification",
          action: "token_applicant_reuse",
          accountId: nearSignature.accountId,
          applicantId: applicant.id,
          verificationAttemptId,
          levelName,
          externalUserId,
        })
      } else {
        throw error
      }
    }

    // Step 2: Store NEAR metadata on applicant (guaranteed to exist now)
    const metadata: SumSubMetadataItem[] = [
      { key: "near_account_id", value: nearSignature.accountId },
      { key: "near_signature", value: nearSignature.signature },
      { key: "near_public_key", value: nearSignature.publicKey },
      { key: "near_nonce", value: nearSignature.nonce },
      { key: "near_timestamp", value: nearSignature.timestamp.toString() },
    ]

    await updateApplicantMetadata(applicant.id, metadata)

    await trackServerEvent(nearSignature.accountId, {
      domain: "verification",
      action: "token_metadata_store",
      accountId: nearSignature.accountId,
      applicantId: applicant.id,
      verificationAttemptId,
      levelName,
      externalUserId,
    })

    // Step 3: Generate access token for the existing applicant
    const tokenResponse = await generateAccessToken(externalUserId, levelName)

    await trackServerEvent(nearSignature.accountId, {
      domain: "verification",
      action: "token_generate",
      accountId: nearSignature.accountId,
      applicantId: applicant.id,
      verificationAttemptId,
      levelName,
      externalUserId,
    })

    const response = verificationTokenResponseSchema.parse({
      token: tokenResponse.token,
      externalUserId,
    })

    return apiSuccess(response)
  } catch (error) {
    await trackServerEvent(optimisticAccountId ?? "anonymous", {
      domain: "verification",
      action: "token_error",
      accountId: optimisticAccountId,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      verificationAttemptId,
    })

    return apiError("TOKEN_GENERATION_FAILED")
  }
}

export async function GET() {
  const response = statusOkResponseSchema.parse({
    status: "ok",
    message: "SumSub token API",
    timestamp: new Date().toISOString(),
  })

  return apiSuccess(response)
}
