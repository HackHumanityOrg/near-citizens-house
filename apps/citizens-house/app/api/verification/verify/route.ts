import { type NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  SELF_CONFIG,
  SELF_VERIFICATION_CONFIG,
  getSigningMessage,
  verificationDb,
  getVerifier,
  getRpcProvider,
  verifyNearSignature,
  verifyRequestSchema,
  createVerificationError,
  type SelfVerificationResult,
  type NearSignatureData,
  type VerificationDataWithSignature,
} from "@near-citizens/shared"
import { reserveSignatureNonce, updateSession } from "@/lib/session-store"
import { trackVerificationCompletedServer, trackVerificationFailedServer } from "@/lib/analytics-server"
import { createApiEvent, logger } from "@/lib/logger"

// Maximum age for signature timestamps (10 minutes)
// Extended to allow time for Self app ID verification process
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000

// Clock skew tolerance (10 seconds)
// Allows for minor time differences between client and server
const CLOCK_SKEW_MS = 10 * 1000

/**
 * Parse userDefinedData to extract signature JSON.
 * The QR code contains signature data without challenge/recipient (to reduce size).
 * Backend reconstructs these from known values.
 */
function parseUserDefinedData(userDefinedDataRaw: unknown): string | null {
  if (!userDefinedDataRaw) return null

  let jsonString = ""

  if (typeof userDefinedDataRaw === "string") {
    if (userDefinedDataRaw.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(userDefinedDataRaw)) {
      jsonString = Buffer.from(userDefinedDataRaw, "hex").toString("utf8")
    } else {
      jsonString = userDefinedDataRaw
    }
  } else if (Array.isArray(userDefinedDataRaw)) {
    jsonString = new TextDecoder().decode(new Uint8Array(userDefinedDataRaw))
  } else if (typeof userDefinedDataRaw === "object" && userDefinedDataRaw !== null) {
    const values = Object.values(userDefinedDataRaw)
    if (values.every((v) => typeof v === "number")) {
      jsonString = new TextDecoder().decode(new Uint8Array(values as number[]))
    }
  }

  if (!jsonString) return null

  jsonString = jsonString.replace(/\0/g, "")

  const firstBrace = jsonString.indexOf("{")
  const lastBrace = jsonString.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return jsonString.substring(firstBrace, lastBrace + 1)
  }

  return jsonString
}

function isFullAccessPermission(permission: unknown): boolean {
  if (permission === "FullAccess") {
    return true
  }

  if (permission && typeof permission === "object" && "FullAccess" in permission) {
    return true
  }

  return false
}

async function hasFullAccessKey(accountId: string, publicKey: string): Promise<boolean> {
  const provider = getRpcProvider()

  try {
    const accessKey = (await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    })) as { permission?: unknown }

    return isFullAccessPermission(accessKey.permission)
  } catch (error) {
    logger.warn("Failed to query access key", {
      operation: "verification.access_key_check",
      account_id: accountId,
      error_message: error instanceof Error ? error.message : "Unknown error",
    })
    return false
  }
}

export async function POST(request: NextRequest) {
  // Create wide event for this request
  const event = createApiEvent("verification.verify", request)

  const ofacEnabled = SELF_VERIFICATION_CONFIG.ofac === true
  const selfNetwork = SELF_CONFIG.networkId
  let sessionId: string | undefined
  let accountId: string | undefined
  let nationality: string | undefined
  let isValid: boolean | undefined
  let isMinimumAgeValid: boolean | undefined
  let isOfacValid: boolean | undefined

  // Set initial verification context
  event.setVerification({
    self_network: selfNetwork,
    ofac_enabled: ofacEnabled,
  })

  const respondWithError = async ({
    code,
    status,
    details,
    stage,
    attestationId,
  }: {
    code: Parameters<typeof createVerificationError>[0]
    status: number
    details?: string
    stage: string
    attestationId?: number | string
  }) => {
    const errorResponse = createVerificationError(code, details)

    // Update wide event with error context
    event.setStatus(status)
    event.setError({ code, message: errorResponse.reason })
    event.setVerification({ stage, attestation_id: attestationId?.toString() })
    event.setUser({ account_id: accountId, session_id: sessionId })
    event.error(`Verification failed: ${code}`)

    try {
      await trackVerificationFailedServer({
        distinctId: accountId ?? sessionId ?? "unknown",
        accountId,
        sessionId,
        nationality,
        attestationId: attestationId ? attestationId.toString() : undefined,
        errorCode: code,
        errorReason: errorResponse.reason,
        stage,
        selfNetwork,
        ofacEnabled,
        isValid,
        isMinimumAgeValid,
        isOfacValid,
        timestamp: Date.now(),
      })
    } catch (error) {
      logger.warn("Failed to track verification_failed event", {
        operation: "verification.analytics",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
    }

    return NextResponse.json(errorResponse satisfies SelfVerificationResult, { status })
  }

  try {
    const body = await request.json()

    const parseResult = verifyRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const missingFields = parseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      return respondWithError({
        code: "MISSING_FIELDS",
        status: 400,
        details: missingFields,
        stage: "request_validation",
      })
    }

    const { attestationId, proof, publicSignals, userContextData } = parseResult.data

    // Update wide event with attestation ID
    event.setVerification({ attestation_id: attestationId.toString(), stage: "started" })

    let selfVerificationResult

    try {
      const verifier = getVerifier()
      selfVerificationResult = await verifier.verify(attestationId, proof, publicSignals, userContextData)
    } catch (error) {
      return respondWithError({
        code: "VERIFICATION_FAILED",
        status: 400,
        details: error instanceof Error ? error.message : "Unknown error",
        stage: "self_verify",
        attestationId,
      })
    }

    sessionId = selfVerificationResult.userData?.userIdentifier
    nationality =
      typeof selfVerificationResult.discloseOutput?.nationality === "string"
        ? selfVerificationResult.discloseOutput.nationality
        : undefined

    // Self.xyz's isOfacValid: true = user IS ON OFAC sanctions list (blocked), false = NOT on list (allowed)
    // See SDK source: "isOfacValid is true when a person is in OFAC list"
    const validity = selfVerificationResult.isValidDetails || {}
    isValid = validity.isValid
    isMinimumAgeValid = validity.isMinimumAgeValid
    isOfacValid = validity.isOfacValid

    // Update wide event with verification results
    event.setVerification({
      is_valid: isValid,
      is_minimum_age_valid: isMinimumAgeValid,
      is_ofac_valid: isOfacValid,
      nationality,
      stage: "self_verified",
    })
    event.setUser({ session_id: sessionId })

    // Type guards: ensure SDK returned expected boolean fields
    // When OFAC is enabled, isOfacValid must also be a boolean
    if (
      typeof isValid !== "boolean" ||
      typeof isMinimumAgeValid !== "boolean" ||
      (ofacEnabled && typeof isOfacValid !== "boolean")
    ) {
      return respondWithError({
        code: "VERIFICATION_FAILED",
        status: 502,
        details: "Invalid verifier response structure",
        stage: "self_verify_response",
        attestationId,
      })
    }
    const ofacCheckFailed = ofacEnabled && isOfacValid === true

    if (!isValid || !isMinimumAgeValid || ofacCheckFailed) {
      const errorCode = !isMinimumAgeValid
        ? "MINIMUM_AGE_NOT_MET"
        : ofacCheckFailed
          ? "OFAC_CHECK_FAILED"
          : "VERIFICATION_FAILED"

      return respondWithError({
        code: errorCode,
        status: 400,
        stage: "self_verification",
        attestationId,
      })
    }

    const nullifier = selfVerificationResult.discloseOutput?.nullifier

    if (!nullifier) {
      return respondWithError({
        code: "NULLIFIER_MISSING",
        status: 400,
        stage: "nullifier_check",
        attestationId,
      })
    }

    // Parse NEAR signature from userDefinedData
    // QR code contains signature data without challenge/recipient (to reduce size)
    // Backend reconstructs these from known values
    const userDefinedDataRaw = selfVerificationResult.userData?.userDefinedData
    const jsonString = parseUserDefinedData(userDefinedDataRaw)

    if (!jsonString) {
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: "Could not extract JSON from userDefinedData",
        stage: "signature_parse",
        attestationId,
      })
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonString)
    } catch {
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: "Invalid JSON in userDefinedData",
        stage: "signature_parse",
        attestationId,
      })
    }

    accountId = typeof data.accountId === "string" ? data.accountId : undefined

    if (!data.accountId || !data.signature || !data.publicKey || !data.nonce) {
      const missingFields = ["accountId", "signature", "publicKey", "nonce"].filter((f) => !data[f]).join(", ")
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: `Missing NEP-413 fields: ${missingFields}`,
        stage: "signature_parse",
        attestationId,
      })
    }

    let nonce = data.nonce
    if (typeof nonce === "string") {
      nonce = Array.from(Buffer.from(nonce, "base64"))
    }
    if (!Array.isArray(nonce) || nonce.length !== 32) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Invalid nonce: expected 32-byte array",
        stage: "signature_parse",
        attestationId,
      })
    }

    // Validate signature timestamp freshness
    const signatureTimestamp = typeof data.timestamp === "number" ? data.timestamp : 0
    const now = Date.now()
    const signatureAge = now - signatureTimestamp

    if (signatureTimestamp === 0) {
      return respondWithError({
        code: "SIGNATURE_TIMESTAMP_INVALID",
        status: 400,
        details: "Timestamp is required",
        stage: "signature_validate",
        attestationId,
      })
    }

    // Allow clock skew in both directions
    if (signatureAge > MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS) {
      return respondWithError({
        code: "SIGNATURE_EXPIRED",
        status: 400,
        details: `Signed ${Math.round(signatureAge / 1000)}s ago (max ${(MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS) / 1000}s with clock skew)`,
        stage: "signature_validate",
        attestationId,
      })
    }

    // Allow future timestamps within clock skew tolerance
    if (signatureAge < -CLOCK_SKEW_MS) {
      return respondWithError({
        code: "SIGNATURE_TIMESTAMP_INVALID",
        status: 400,
        details: `Future timestamp exceeds clock skew tolerance (${CLOCK_SKEW_MS / 1000}s)`,
        stage: "signature_validate",
        attestationId,
      })
    }

    // Reconstruct challenge and recipient from known values
    // (not included in QR code to reduce size)
    const expectedChallenge = getSigningMessage()
    const recipient = data.accountId as string // NEP-413 recipient must match accountId

    const signatureCheck = verifyNearSignature(
      expectedChallenge,
      data.signature as string,
      data.publicKey as string,
      nonce as number[],
      recipient,
    )

    if (!signatureCheck.valid) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: signatureCheck.error || "Signature verification failed",
        stage: "signature_validate",
        attestationId,
      })
    }

    const isFullAccess = await hasFullAccessKey(data.accountId as string, data.publicKey as string)
    if (!isFullAccess) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Public key is not an active full-access key",
        stage: "signature_validate",
        attestationId,
      })
    }

    const nonceBase64 = Buffer.from(nonce as number[]).toString("base64")
    // Nonce TTL should cover remaining validity time to avoid unnecessarily long reservations
    const remainingValidityMs = MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS - signatureAge
    const nonceTtlSeconds = Math.max(60, Math.ceil(remainingValidityMs / 1000)) // Min 60s to handle processing time
    const nonceReserved = await reserveSignatureNonce(data.accountId as string, nonceBase64, nonceTtlSeconds)

    if (!nonceReserved) {
      logger.warn("Nonce replay attempt detected", {
        operation: "verification.nonce_check",
        account_id: data.accountId as string,
        "verification.attestation_id": attestationId.toString(),
        nonce_base64: nonceBase64,
      })
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Nonce already used",
        stage: "signature_validate",
        attestationId,
      })
    }

    const nearSignature: NearSignatureData = {
      accountId: data.accountId as string,
      signature: data.signature as string,
      publicKey: data.publicKey as string,
      challenge: expectedChallenge,
      timestamp: signatureTimestamp,
      nonce: nonce as number[],
      recipient,
    }

    // Note: NEAR signature verification is performed by the smart contract (single source of truth)
    // The contract implements full NEP-413 verification with ed25519_verify

    try {
      // Convert proof to string format for on-chain storage
      const selfProofData = {
        proof: {
          a: [String(proof.a[0]), String(proof.a[1])] as [string, string],
          b: [
            [String(proof.b[0][0]), String(proof.b[0][1])],
            [String(proof.b[1][0]), String(proof.b[1][1])],
          ] as [[string, string], [string, string]],
          c: [String(proof.c[0]), String(proof.c[1])] as [string, string],
        },
        publicSignals: publicSignals.map(String),
      }

      // Store signature data for on-chain re-verification
      // challenge and recipient are omitted - backend reconstructs them from:
      //   challenge = getSigningMessage()
      //   recipient = accountId
      const fullUserContextData = JSON.stringify({
        accountId: data.accountId,
        publicKey: data.publicKey,
        signature: data.signature,
        nonce: nonceBase64,
        timestamp: signatureTimestamp,
      })

      await verificationDb.storeVerification({
        nullifier: nullifier.toString(),
        nearAccountId: nearSignature.accountId,
        attestationId: attestationId.toString(),
        signatureData: nearSignature,
        selfProofData,
        userContextData: fullUserContextData,
      } satisfies VerificationDataWithSignature)

      // Revalidate the verifications cache so new verification appears immediately
      // Next.js 16 requires a cacheLife profile as second argument
      revalidateTag("verifications", "max")

      // Update wide event with success context
      event.setUser({ account_id: nearSignature.accountId })
      event.setVerification({ nullifier: nullifier.toString(), stage: "stored" })

      // Track verification completed for analytics
      try {
        await trackVerificationCompletedServer({
          accountId: nearSignature.accountId,
          nationality,
          attestationId: attestationId.toString(),
          selfNetwork,
          ofacEnabled,
          isValid,
          isMinimumAgeValid,
          isOfacValid,
          sessionId,
          timestamp: Date.now(),
        })
      } catch (error) {
        logger.warn("Failed to track verification_completed event", {
          operation: "verification.analytics",
          account_id: nearSignature.accountId,
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
      }

      // Update session status for deep link callback
      // The userId from Self.xyz is used as the sessionId in our deep link flow
      if (sessionId) {
        await updateSession(sessionId, {
          status: "success",
          accountId: nearSignature.accountId,
        })
        event.set("session_updated", true)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ""
      const errorCode = errorMessage.includes("already registered") ? "DUPLICATE_PASSPORT" : "STORAGE_FAILED"

      // Update session status for deep link callback
      if (sessionId) {
        await updateSession(sessionId, {
          status: "error",
          error: errorCode,
        })
      }

      return respondWithError({
        code: errorCode,
        status: 500,
        details: error instanceof Error ? error.message : undefined,
        stage: "storage",
        attestationId,
      })
    }

    // Emit successful verification wide event
    event.setStatus(200)
    event.setVerification({ stage: "completed" })
    event.info("Verification completed successfully")

    return NextResponse.json(
      {
        status: "success",
        result: true,
        attestationId,
        userData: {
          userId: selfVerificationResult.userData?.userIdentifier || "unknown",
          nearAccountId: nearSignature.accountId,
          nearSignature: nearSignature.signature,
        },
        discloseOutput: selfVerificationResult.discloseOutput,
      } satisfies SelfVerificationResult,
      { status: 200 },
    )
  } catch (error) {
    return respondWithError({
      code: "INTERNAL_ERROR",
      status: 500,
      details: error instanceof Error ? error.message : undefined,
      stage: "internal",
    })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Self x NEAR verification API",
    timestamp: new Date().toISOString(),
  })
}
