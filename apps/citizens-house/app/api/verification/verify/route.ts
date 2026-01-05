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

// Maximum age for signature timestamps (10 minutes)
// Extended to allow time for Self app ID verification process
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000

// Clock skew tolerance (10 seconds)
// Allows for minor time differences between client and server
const CLOCK_SKEW_MS = 10 * 1000

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
    console.warn("[Verify] Failed to query access key", error)
    return false
  }
}

export async function POST(request: NextRequest) {
  const ofacEnabled = SELF_VERIFICATION_CONFIG.ofac === true
  const selfNetwork = SELF_CONFIG.networkId
  let sessionId: string | undefined
  let accountId: string | undefined
  let nationality: string | undefined
  let isValid: boolean | undefined
  let isMinimumAgeValid: boolean | undefined
  let isOfacValid: boolean | undefined

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
      console.warn("[Verify] Failed to track verification_failed event", error)
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

    console.log(`[Verify] Starting verification for attestation ${attestationId}`)

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

    console.log(`[Verify] Self verification result:`, { isValid, isMinimumAgeValid, isOfacValid })

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

    const expectedChallenge = getSigningMessage()
    const challenge = typeof data.challenge === "string" ? data.challenge : ""
    const recipient = typeof data.recipient === "string" ? data.recipient : ""

    if (!challenge || !recipient) {
      const missingFields = ["challenge", "recipient"].filter((field) => !data[field]).join(", ")
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: `Missing NEP-413 fields: ${missingFields}`,
        stage: "signature_parse",
        attestationId,
      })
    }

    if (challenge !== expectedChallenge) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Challenge does not match this service",
        stage: "signature_validate",
        attestationId,
      })
    }

    if (recipient !== data.accountId) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Recipient must match accountId",
        stage: "signature_validate",
        attestationId,
      })
    }

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
      console.warn(`[Verify] Nonce replay attempt detected for account ${data.accountId}`, {
        nonceBase64,
        attestationId,
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

      await verificationDb.storeVerification({
        nullifier: nullifier.toString(),
        nearAccountId: nearSignature.accountId,
        attestationId: attestationId.toString(),
        signatureData: nearSignature,
        selfProofData,
        userContextData,
      } satisfies VerificationDataWithSignature)

      // Revalidate the verifications cache so new verification appears immediately
      // Next.js 16 requires a cacheLife profile as second argument
      revalidateTag("verifications", "max")

      console.log(`[Verify] Stored verification for account ${nearSignature.accountId}`)

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
        console.log(
          `[Verify] Tracked verification completed${nationality ? ` with nationality: ${nationality}` : ""}${sessionId ? ` (session: ${sessionId})` : ""}`,
        )
      } catch (error) {
        console.warn("[Verify] Failed to track verification_completed event", error)
      }

      // Update session status for deep link callback
      // The userId from Self.xyz is used as the sessionId in our deep link flow
      if (sessionId) {
        await updateSession(sessionId, {
          status: "success",
          accountId: nearSignature.accountId,
        })
        console.log(`[Verify] Updated session ${sessionId} with status: success`)
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
        console.log(`[Verify] Updated session ${sessionId} with status: error (${errorCode})`)
      }

      return respondWithError({
        code: errorCode,
        status: 500,
        details: error instanceof Error ? error.message : undefined,
        stage: "storage",
        attestationId,
      })
    }

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
