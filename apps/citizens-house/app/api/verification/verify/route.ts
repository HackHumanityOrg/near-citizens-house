import { type NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  getSigningMessage,
  getSigningRecipient,
  verifyNearSignature,
  getAttestationTypeName,
  type NearAccountId,
  type NearSignatureData,
  type VerificationDataWithSignature,
} from "@/lib"
import { getRpcProvider } from "@/lib/providers/rpc-provider"
import { NEAR_SERVER_CONFIG } from "@/lib/config.server"
import { getVerifier } from "@/lib/providers/self-provider"
import { setBackendKeyPoolRedis, verificationDb } from "@/lib/contracts/verification/client"
import { reserveSignatureNonce, updateSession } from "@/lib/session-store"
import { getRedisClient } from "@/lib/redis"
import { trackServerEvent } from "@/lib/analytics-server"
import {
  createVerifyContext,
  extractDistinctId,
  extractPlatform,
  type VerifyContext,
  type ErrorStage,
} from "@/lib/logger"
import { isNonRetryableError } from "@/lib/schemas/errors"
import {
  verifyRequestSchema,
  createVerificationError,
  mapContractErrorToCode,
  userDefinedDataSchema,
  parseUserDefinedDataRaw,
  selfVerificationResultSchema,
  nearAccessKeyResponseSchema,
  type VerifyResponse,
  type AttestationId,
  type NearAccessKeyPermission,
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

function isFullAccessPermission(permission: NearAccessKeyPermission): boolean {
  if (permission === "FullAccess") {
    return true
  }

  if (typeof permission === "object" && "FullAccess" in permission) {
    return true
  }

  return false
}

/**
 * Categorize error code to outcome type for logging
 */
function categorizeOutcome(
  code: string,
  stage: ErrorStage,
): "validation_error" | "signature_error" | "proof_error" | "storage_error" | "internal_error" {
  if (stage === "request_validation") return "validation_error"
  if (stage === "signature_parse" || stage === "signature_validate") return "signature_error"
  if (stage === "self_verify" || stage === "self_verify_response") return "proof_error"
  if (stage === "storage") return "storage_error"
  return "internal_error"
}

async function hasFullAccessKey(accountId: NearAccountId, publicKey: string, ctx?: VerifyContext): Promise<boolean> {
  const provider = getRpcProvider()
  ctx?.set("externalCalls.nearRpcCalled", true)

  try {
    const rawResponse = await provider.query({
      request_type: "view_access_key",
      finality: "final",
      account_id: accountId,
      public_key: publicKey,
    })

    const parseResult = nearAccessKeyResponseSchema.safeParse(rawResponse)
    if (!parseResult.success) {
      ctx?.set("externalCalls.nearRpcSuccess", false)
      return false
    }

    ctx?.set("externalCalls.nearRpcSuccess", true)
    return isFullAccessPermission(parseResult.data.permission)
  } catch {
    ctx?.set("externalCalls.nearRpcSuccess", false)
    return false
  }
}

export async function POST(request: NextRequest) {
  // Initialize RequestContext for wide event logging
  const ctx = createVerifyContext()
  ctx.setMany({
    route: "/api/verification/verify",
    method: "POST",
    distinctId: extractDistinctId(request),
    platform: extractPlatform(request.headers.get("user-agent")),
  })

  let sessionId: string | undefined
  let accountId: NearAccountId | undefined
  let optimisticAccountId: NearAccountId | undefined

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
    stage: ErrorStage
    attestationId?: AttestationId
  }) => {
    const errorResponse = createVerificationError(code, details)

    // Set error context for logging
    ctx.set("outcome", categorizeOutcome(code, stage))
    ctx.set("statusCode", status)
    ctx.set("error.code", code)
    ctx.set("error.message", errorResponse.reason)
    ctx.set("error.isRetryable", !isNonRetryableError(code))
    ctx.set("error.stage", stage)
    ctx.emit("error")

    // Track rejection event - distinctId priority: accountId > optimisticAccountId > sessionId > anonymous
    const distinctId = accountId || optimisticAccountId || sessionId || "anonymous"
    await trackServerEvent(distinctId, {
      domain: "verification",
      action: "rejected",
      accountId: accountId || optimisticAccountId,
      reason: errorResponse.reason,
      errorCode: code,
    })

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
    ctx.startTimer("parseBody")
    const body = await request.json()
    ctx.endTimer("parseBody")

    const parseResult = verifyRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const missingFields = parseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      ctx.set("stageReached.parsed", false)
      return respondWithError({
        code: "MISSING_FIELDS",
        status: 400,
        details: missingFields,
        stage: "request_validation",
      })
    }

    ctx.set("stageReached.parsed", true)
    const { attestationId, proof, publicSignals, userContextData } = parseResult.data

    // Set request context fields
    ctx.set("attestationId", attestationId)
    ctx.set("attestationType", getAttestationTypeName(attestationId))
    ctx.set("hasProof", !!proof)
    ctx.set("hasPublicSignals", !!publicSignals)
    ctx.set("hasUserContextData", !!userContextData)

    // Optimistically try to extract accountId from userContextData for early tracking
    // This data will be validated properly later, but we want it for analytics
    try {
      const parsed = JSON.parse(userContextData)
      if (parsed && typeof parsed.accountId === "string") {
        optimisticAccountId = parsed.accountId as NearAccountId
        ctx.set("nearAccountId", optimisticAccountId)
      }
    } catch {
      // Failed to parse, will use "anonymous" for tracking
    }

    // Track proof submission attempt with optimistic accountId if available
    await trackServerEvent(optimisticAccountId || "anonymous", {
      domain: "verification",
      action: "proof_submitted",
      accountId: optimisticAccountId,
      sessionId: "pending",
    })

    let rawSdkResponse: unknown

    ctx.startTimer("selfxyzVerify")
    ctx.set("externalCalls.selfxyzCalled", true)
    try {
      const verifier = getVerifier()
      rawSdkResponse = await verifier.verify(attestationId, proof, publicSignals, userContextData)
      ctx.set("externalCalls.selfxyzSuccess", true)
    } catch (error) {
      ctx.endTimer("selfxyzVerify")
      ctx.set("externalCalls.selfxyzSuccess", false)
      return respondWithError({
        code: "VERIFICATION_FAILED",
        status: 400,
        details: error instanceof Error ? error.message : "Unknown error",
        stage: "self_verify",
        attestationId,
      })
    }
    ctx.endTimer("selfxyzVerify")

    // Validate SDK response structure at external boundary
    const sdkParseResult = selfVerificationResultSchema.safeParse(rawSdkResponse)
    if (!sdkParseResult.success) {
      const issues = sdkParseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      ctx.set("stageReached.proofValidated", false)
      return respondWithError({
        code: "VERIFICATION_FAILED",
        status: 502,
        details: `Invalid verifier response structure: ${issues}`,
        stage: "self_verify_response",
        attestationId,
      })
    }

    const selfVerificationResult = sdkParseResult.data
    sessionId = selfVerificationResult.userData.userIdentifier
    ctx.set("sessionId", sessionId)

    // Extract nationality if available
    if (selfVerificationResult.discloseOutput.nationality) {
      ctx.set("nationality", selfVerificationResult.discloseOutput.nationality)
    }

    const isValid = selfVerificationResult.isValidDetails.isValid

    if (!isValid) {
      ctx.set("stageReached.proofValidated", false)
      return respondWithError({
        code: "VERIFICATION_FAILED",
        status: 400,
        stage: "self_verify",
        attestationId,
      })
    }

    ctx.set("stageReached.proofValidated", true)

    // We don't have accountId yet at this point, but we need it for proof_validated
    // We'll track proof_validated after parsing userDefinedData (see below)

    const nullifier = selfVerificationResult.discloseOutput.nullifier

    // Parse NEAR signature from userDefinedData
    // QR code contains signature data without challenge/recipient (to reduce size)
    // Backend reconstructs these from known values
    const userDefinedDataRaw = selfVerificationResult.userData.userDefinedData
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
    ctx.set("nearAccountId", accountId)
    ctx.set("signaturePresent", !!data.signature)

    // Track proof validation success (ZK proof passed, accountId now known)
    await trackServerEvent(accountId, {
      domain: "verification",
      action: "proof_validated",
      accountId,
    })

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

    ctx.startTimer("signatureValidation")

    // Validate signature timestamp freshness
    const signatureTimestamp = data.timestamp ?? 0
    const now = Date.now()
    const signatureAge = now - signatureTimestamp
    ctx.set("signatureTimestampAge", Math.round(signatureAge / 1000))

    if (signatureTimestamp === 0) {
      ctx.endTimer("signatureValidation")
      ctx.set("stageReached.signatureValidated", false)
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
      ctx.endTimer("signatureValidation")
      ctx.set("stageReached.signatureValidated", false)
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
      ctx.endTimer("signatureValidation")
      ctx.set("stageReached.signatureValidated", false)
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
      ctx.endTimer("signatureValidation")
      ctx.set("stageReached.signatureValidated", false)
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
      ctx.endTimer("signatureValidation")
      ctx.set("stageReached.signatureValidated", false)
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: signatureCheck.error || "Signature verification failed",
        stage: "signature_validate",
        attestationId,
      })
    }

    const isFullAccess = await hasFullAccessKey(data.accountId, data.publicKey, ctx)
    if (!isFullAccess) {
      ctx.endTimer("signatureValidation")
      ctx.set("stageReached.signatureValidated", false)
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Public key is not an active full-access key",
        stage: "signature_validate",
        attestationId,
      })
    }

    ctx.endTimer("signatureValidation")
    ctx.set("stageReached.signatureValidated", true)

    // Nonce is already base64 encoded; use directly for deduplication
    // Nonce TTL should cover remaining validity time to avoid unnecessarily long reservations
    const remainingValidityMs = MAX_SIGNATURE_AGE_MS + CLOCK_SKEW_MS - signatureAge
    const nonceTtlSeconds = Math.max(60, Math.ceil(remainingValidityMs / 1000)) // Min 60s to handle processing time

    ctx.startTimer("nonceReservation")
    ctx.set("externalCalls.redisCalled", true)
    const nonceReserved = await reserveSignatureNonce(data.accountId, nonce, nonceTtlSeconds)
    ctx.endTimer("nonceReservation")

    if (!nonceReserved) {
      ctx.set("externalCalls.redisSuccess", true) // Redis worked, just a duplicate
      ctx.set("stageReached.nonceReserved", false)
      return respondWithError({
        code: "NEAR_SIGNATURE_INVALID",
        status: 400,
        details: "Nonce already used",
        stage: "signature_validate",
        attestationId,
      })
    }

    ctx.set("externalCalls.redisSuccess", true)
    ctx.set("stageReached.nonceReserved", true)

    const nearSignature: NearSignatureData = {
      accountId: data.accountId,
      signature: data.signature,
      publicKey: data.publicKey,
      challenge: expectedChallenge,
      timestamp: signatureTimestamp,
      nonce, // base64 encoded
      recipient,
    }

    // Defense-in-depth: verify backend wallet is configured before attempting storage.
    // The verificationDb singleton also validates this, but we check early for a clearer error.
    if (!NEAR_SERVER_CONFIG.backendAccountId || !NEAR_SERVER_CONFIG.backendPrivateKey) {
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

    ctx.startTimer("contractStorage")
    ctx.set("externalCalls.contractCalled", true)
    ctx.set("contract.contractId", NEAR_SERVER_CONFIG.verificationContractId)
    ctx.set("contract.methodCalled", "store_verification")

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

      ctx.endTimer("contractStorage")
      ctx.set("externalCalls.contractSuccess", true)
      ctx.set("stageReached.storedOnChain", true)

      // Track successful on-chain storage
      await trackServerEvent(nearSignature.accountId, {
        domain: "verification",
        action: "stored_onchain",
        accountId: nearSignature.accountId,
        attestationType: getAttestationTypeName(attestationId),
      })

      // Revalidate the verifications cache so new verification appears immediately
      // Next.js 16 requires a cacheLife profile as second argument
      revalidateTag("verifications", "max")

      // Update session status for deep link callback
      // The userId from Self.xyz is used as the sessionId in our deep link flow
      if (sessionId) {
        ctx.startTimer("sessionUpdate")
        try {
          await updateSession(sessionId, {
            status: "success",
            accountId: nearSignature.accountId,
            attestationId,
          })
        } catch {
          // Failed to update session, but verification succeeded
        }
        ctx.endTimer("sessionUpdate")
      }
    } catch (error) {
      ctx.endTimer("contractStorage")
      ctx.set("externalCalls.contractSuccess", false)
      ctx.set("stageReached.storedOnChain", false)
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

    // Log successful verification
    ctx.set("outcome", "success")
    ctx.set("statusCode", 200)
    ctx.emit("info")

    return NextResponse.json(
      {
        status: "success",
        result: true,
        attestationId,
        userData: {
          userId: selfVerificationResult.userData.userIdentifier,
          nearAccountId: nearSignature.accountId,
          nearSignature: nearSignature.signature,
        },
        discloseOutput: selfVerificationResult.discloseOutput,
      } satisfies VerifyResponse,
      { status: 200 },
    )
  } catch (error) {
    // Catch any unexpected errors that weren't handled above
    ctx.set("stageReached.parsed", ctx.get("stageReached.parsed") ?? false)
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
