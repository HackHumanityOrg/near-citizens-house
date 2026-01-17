import { type NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  NEAR_CONFIG,
  getSigningMessage,
  getSigningRecipient,
  getVerifier,
  getRpcProvider,
  verifyNearSignature,
  type NearAccountId,
  type NearSignatureData,
  type VerificationDataWithSignature,
} from "@/lib"
import { setBackendKeyPoolRedis, verificationDb } from "@/lib/contracts/verification/client"
import { reserveSignatureNonce, updateSession } from "@/lib/session-store"
import { getRedisClient } from "@/lib/redis"
import {
  verifyRequestSchema,
  createVerificationError,
  mapContractErrorToCode,
  userDefinedDataSchema,
  parseUserDefinedDataRaw,
  type VerifyResponse,
  type AttestationId,
} from "@/lib/schemas"

// Initialize Redis for backend key pool (for concurrent transaction support)
// This is lazy - the actual connection happens on first use
let redisInitialized = false
async function ensureRedisInitialized(): Promise<void> {
  if (redisInitialized) return
  const redis = await getRedisClient()
  setBackendKeyPoolRedis({ incr: (key: string) => redis.incr(key) })
  redisInitialized = true
}

// Maximum age for signature timestamps (10 minutes)
// Extended to allow time for Self app ID verification process
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000

// Clock skew tolerance (10 seconds)
// Allows for minor time differences between client and server
const CLOCK_SKEW_MS = 10 * 1000

function isFullAccessPermission(permission: unknown): boolean {
  if (permission === "FullAccess") {
    return true
  }

  if (permission && typeof permission === "object" && "FullAccess" in permission) {
    return true
  }

  return false
}

async function hasFullAccessKey(accountId: NearAccountId, publicKey: string): Promise<boolean> {
  const provider = getRpcProvider()

  try {
    const accessKey = (await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    })) as { permission?: unknown }

    return isFullAccessPermission(accessKey.permission)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  let sessionId: string | undefined
  let accountId: NearAccountId | undefined

  const respondWithError = async ({
    code,
    status,
    details,
    attestationId,
  }: {
    code: Parameters<typeof createVerificationError>[0]
    status: number
    details?: string
    stage: string
    attestationId?: AttestationId
  }) => {
    const errorResponse = createVerificationError(code, details)

    if (sessionId) {
      try {
        await updateSession(sessionId, {
          status: "error",
          accountId,
          attestationId,
          error: errorResponse.reason,
          errorCode: code,
        })
      } catch {
        // Failed to update session, continue with error response
      }
    }

    return NextResponse.json(errorResponse satisfies VerifyResponse, { status })
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

    const validity = selfVerificationResult.isValidDetails || {}
    const isValid = validity.isValid

    // Type guards: ensure SDK returned expected boolean fields
    if (typeof isValid !== "boolean") {
      return respondWithError({
        code: "VERIFICATION_FAILED",
        status: 502,
        details: "Invalid verifier response structure",
        stage: "self_verify_response",
        attestationId,
      })
    }

    if (!isValid) {
      return respondWithError({
        code: "VERIFICATION_FAILED",
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
    const jsonString = parseUserDefinedDataRaw(userDefinedDataRaw)

    if (!jsonString) {
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: "Could not extract JSON from userDefinedData",
        stage: "signature_parse",
        attestationId,
      })
    }

    let rawData: unknown
    try {
      rawData = JSON.parse(jsonString)
    } catch {
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: "Invalid JSON in userDefinedData",
        stage: "signature_parse",
        attestationId,
      })
    }

    // Validate user defined data with schema
    const userDataResult = userDefinedDataSchema.safeParse(rawData)
    if (!userDataResult.success) {
      const issues = userDataResult.error.issues.map((i) => i.path.join(".")).join(", ")
      return respondWithError({
        code: "NEAR_SIGNATURE_MISSING",
        status: 400,
        details: `Invalid NEP-413 fields: ${issues}`,
        stage: "signature_parse",
        attestationId,
      })
    }

    const data = userDataResult.data
    accountId = data.accountId

    // Nonce is now base64 encoded throughout the system
    const nonce = data.nonce
    // Validate nonce is valid base64 and has correct length (32 bytes = ~44 base64 chars)
    const nonceBytes = Buffer.from(nonce, "base64")
    if (nonceBytes.length !== 32) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: `Invalid nonce: expected 32 bytes, got ${nonceBytes.length}`,
        stage: "signature_parse",
        attestationId,
      })
    }

    // Validate signature timestamp freshness
    const signatureTimestamp = data.timestamp ?? 0
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
    let recipient: string
    try {
      recipient = getSigningRecipient()
    } catch {
      return respondWithError({
        code: "INTERNAL_ERROR",
        status: 500,
        details: "Verification contract ID not configured",
        stage: "config",
        attestationId,
      })
    }

    const signatureCheck = verifyNearSignature(expectedChallenge, data.signature, data.publicKey, nonce, recipient)

    if (!signatureCheck.valid) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: signatureCheck.error || "Signature verification failed",
        stage: "signature_validate",
        attestationId,
      })
    }

    const isFullAccess = await hasFullAccessKey(data.accountId, data.publicKey)
    if (!isFullAccess) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Public key is not an active full-access key",
        stage: "signature_validate",
        attestationId,
      })
    }

    // Nonce is already base64 encoded; use directly for deduplication
    // Nonce TTL should cover remaining validity time to avoid unnecessarily long reservations
    const remainingValidityMs = MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS - signatureAge
    const nonceTtlSeconds = Math.max(60, Math.ceil(remainingValidityMs / 1000)) // Min 60s to handle processing time
    const nonceReserved = await reserveSignatureNonce(data.accountId, nonce, nonceTtlSeconds)

    if (!nonceReserved) {
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Nonce already used",
        stage: "signature_validate",
        attestationId,
      })
    }

    const nearSignature: NearSignatureData = {
      accountId: data.accountId,
      signature: data.signature,
      publicKey: data.publicKey,
      challenge: expectedChallenge,
      timestamp: signatureTimestamp,
      nonce, // base64 encoded
      recipient,
    }

    // Ensure backend wallet is configured for on-chain storage.
    // verificationDb can run in read-only mode for pages, but this endpoint must be able to write.
    if (!NEAR_CONFIG.backendAccountId || !NEAR_CONFIG.backendPrivateKey) {
      return respondWithError({
        code: "INTERNAL_ERROR",
        status: 500,
        details: "Backend wallet credentials not configured",
        stage: "config",
        attestationId,
      })
    }

    // Create/update a pending session early so the callback can poll reliably.
    // If the final session update fails after a successful on-chain write, status can fall back to the contract.
    if (sessionId) {
      try {
        await updateSession(sessionId, {
          status: "pending",
          accountId: nearSignature.accountId,
          attestationId,
        })
      } catch {
        // Failed to update session, continue with verification
      }
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
      //   recipient = getSigningRecipient()
      const fullUserContextData = JSON.stringify({
        accountId: data.accountId,
        publicKey: data.publicKey,
        signature: data.signature,
        nonce, // already base64 encoded
        timestamp: signatureTimestamp,
      })

      // Initialize Redis for backend key pool (enables concurrent transactions)
      await ensureRedisInitialized()

      await verificationDb.storeVerification({
        nullifier: nullifier.toString(),
        nearAccountId: nearSignature.accountId,
        attestationId,
        signatureData: nearSignature,
        selfProofData,
        userContextData: fullUserContextData,
      } satisfies VerificationDataWithSignature)

      // Revalidate the verifications cache so new verification appears immediately
      // Next.js 16 requires a cacheLife profile as second argument
      revalidateTag("verifications", "max")

      // Update session status for deep link callback
      // The userId from Self.xyz is used as the sessionId in our deep link flow
      if (sessionId) {
        try {
          await updateSession(sessionId, {
            status: "success",
            accountId: nearSignature.accountId,
            attestationId,
          })
        } catch {
          // Failed to update session, but verification succeeded
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : ""
      const errCode = mapContractErrorToCode(errorMsg)

      return respondWithError({
        code: errCode,
        status: 500,
        details: errorMsg || "Failed to store verification",
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
      } satisfies VerifyResponse,
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
