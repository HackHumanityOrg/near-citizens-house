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
import { reserveSignatureNonce } from "@/lib/nonce-store"
import { env } from "@/lib/schemas/env"
import { verificationTokenRequestSchema, verificationTokenResponseSchema } from "@/lib/schemas/api/verification"
import { type SumSubMetadataItem, type SumSubApplicant } from "@/lib/schemas/providers/sumsub"
import { logEvent } from "@/lib/logger"
import { validateSignatureData, verifyNearSignature, getSigningMessage, getSigningRecipient } from "@/lib/verification"
import { hasFullAccessKey } from "@/lib/verification.server"
import { apiError, apiSuccess } from "@/lib/api/response"
import { type VerificationErrorCode } from "@/lib/schemas/errors"
import { statusOkResponseSchema } from "@/lib/schemas/api/response"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate request schema
    const parseResult = verificationTokenRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const issues = parseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      return apiError("INVALID_REQUEST", issues)
    }

    const { nearSignature } = parseResult.data

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
      logEvent({
        event: "sumsub_token_invalid_format",
        level: "warn",
        accountId: nearSignature.accountId,
        error: formatCheck.error ?? "Unknown validation error",
        errorCode: code,
      })
      return apiError(code, formatCheck.error)
    }

    // 2. Verify NEAR signature cryptographically (NEP-413)
    const expectedChallenge = getSigningMessage()
    let recipient: string
    try {
      recipient = getSigningRecipient()
    } catch {
      logEvent({
        event: "sumsub_token_missing_config",
        level: "error",
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
      logEvent({
        event: "sumsub_token_invalid_signature",
        level: "warn",
        accountId: nearSignature.accountId,
        error: signatureCheck.error ?? "Unknown signature error",
      })
      return apiError("NEAR_SIGNATURE_INVALID", signatureCheck.error)
    }

    // 3. Verify public key is a full-access key via NEAR RPC
    const keyCheck = await hasFullAccessKey(nearSignature.accountId, nearSignature.publicKey)
    if (!keyCheck.isFullAccess) {
      logEvent({
        event: "sumsub_token_not_full_access",
        level: "warn",
        accountId: nearSignature.accountId,
        error: keyCheck.error ?? "Unknown key validation error",
      })
      return apiError("NEAR_SIGNATURE_INVALID", keyCheck.error ?? "Public key is not an active full-access key")
    }

    // 4. Reserve nonce to prevent replay attacks
    const NONCE_TTL_SECONDS = 10 * 60 // 10 minutes - matches signature freshness window
    const nonceReserved = await reserveSignatureNonce(nearSignature.accountId, nearSignature.nonce, NONCE_TTL_SECONDS)
    if (!nonceReserved) {
      logEvent({
        event: "sumsub_token_nonce_used",
        level: "warn",
        accountId: nearSignature.accountId,
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
      logEvent({
        event: "sumsub_token_already_verified",
        level: "info",
        accountId: nearSignature.accountId,
      })
      return apiError("ACCOUNT_ALREADY_VERIFIED")
    }

    // ==================== Generate SumSub token ====================

    // Use NEAR account ID as external user ID in SumSub
    const externalUserId = nearSignature.accountId
    const levelName = env.NEXT_PUBLIC_SUMSUB_LEVEL_NAME

    // Step 1: Create or get existing applicant
    // This guarantees the applicant exists before we try to update metadata
    let applicant: SumSubApplicant
    try {
      applicant = await createApplicant(externalUserId, levelName)
    } catch (error) {
      // If applicant already exists (409 Conflict), fetch it
      if (error instanceof Error && error.message.includes("409")) {
        applicant = await getApplicantByExternalUserId(externalUserId)
        logEvent({
          event: "sumsub_applicant_exists",
          level: "info",
          externalUserId,
          applicantId: applicant.id,
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

    logEvent({
      event: "sumsub_metadata_stored",
      level: "info",
      externalUserId,
      applicantId: applicant.id,
    })

    // Step 3: Generate access token for the existing applicant
    const tokenResponse = await generateAccessToken(externalUserId, levelName)

    logEvent({
      event: "sumsub_token_generated",
      level: "info",
      externalUserId,
      applicantId: applicant.id,
    })

    const response = verificationTokenResponseSchema.parse({
      token: tokenResponse.token,
      externalUserId,
    })

    return apiSuccess(response)
  } catch (error) {
    logEvent({
      event: "sumsub_token_error",
      level: "error",
      error: error instanceof Error ? error.message : "Unknown error",
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
