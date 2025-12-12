import { type NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  SELF_CONFIG,
  CONSTANTS,
  verificationDb,
  getVerifier,
  verifyRequestSchema,
  createVerificationError,
  type SelfVerificationResult,
  type NearSignatureData,
  type VerificationDataWithSignature,
} from "@near-citizens/shared"
import { updateSession } from "@/lib/session-store"

// Maximum age for signature timestamps (10 minutes)
// Extended to allow time for Self app ID verification process
const MAX_SIGNATURE_AGE_MS = 10 * 60 * 1000

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = verifyRequestSchema.safeParse(body)
    if (!parseResult.success) {
      const missingFields = parseResult.error.issues.map((i) => i.path.join(".")).join(", ")
      return NextResponse.json(
        createVerificationError("MISSING_FIELDS", missingFields) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    const { attestationId, proof, publicSignals, userContextData } = parseResult.data

    let selfVerificationResult

    try {
      const verifier = getVerifier()
      selfVerificationResult = await verifier.verify(attestationId, proof, publicSignals, userContextData)
    } catch (error) {
      return NextResponse.json(
        createVerificationError(
          "VERIFICATION_FAILED",
          error instanceof Error ? error.message : "Unknown error",
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    const { isValid, isMinimumAgeValid, isOfacValid } = selfVerificationResult.isValidDetails || {}

    // Note: isOfacValid === true means user IS on OFAC list
    const ofacEnabled = SELF_CONFIG.disclosures.ofac === true
    const ofacCheckFailed = ofacEnabled && isOfacValid === true

    if (!isValid || !isMinimumAgeValid || ofacCheckFailed) {
      const errorCode = !isMinimumAgeValid
        ? "MINIMUM_AGE_NOT_MET"
        : ofacCheckFailed
          ? "OFAC_CHECK_FAILED"
          : "VERIFICATION_FAILED"

      return NextResponse.json(createVerificationError(errorCode) satisfies SelfVerificationResult, { status: 400 })
    }

    const nullifier = selfVerificationResult.discloseOutput?.nullifier

    if (!nullifier) {
      return NextResponse.json(createVerificationError("NULLIFIER_MISSING") satisfies SelfVerificationResult, {
        status: 400,
      })
    }

    // Parse NEAR signature from userDefinedData
    const userDefinedDataRaw = selfVerificationResult.userData?.userDefinedData
    const jsonString = parseUserDefinedData(userDefinedDataRaw)

    if (!jsonString) {
      return NextResponse.json(
        createVerificationError(
          "NEAR_SIGNATURE_MISSING",
          "Could not extract JSON from userDefinedData",
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(jsonString)
    } catch {
      return NextResponse.json(
        createVerificationError(
          "NEAR_SIGNATURE_MISSING",
          "Invalid JSON in userDefinedData",
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    if (!data.accountId || !data.signature || !data.publicKey || !data.nonce) {
      const missingFields = ["accountId", "signature", "publicKey", "nonce"].filter((f) => !data[f]).join(", ")
      return NextResponse.json(
        createVerificationError(
          "NEAR_SIGNATURE_MISSING",
          `Missing NEP-413 fields: ${missingFields}`,
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    let nonce = data.nonce
    if (typeof nonce === "string") {
      nonce = Array.from(Buffer.from(nonce, "base64"))
    }
    if (!Array.isArray(nonce) || nonce.length !== 32) {
      return NextResponse.json(
        createVerificationError(
          "NEAR_SIGNATURE_INVALID",
          `Invalid nonce: expected 32-byte array`,
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    // Validate signature timestamp freshness
    const signatureTimestamp = typeof data.timestamp === "number" ? data.timestamp : 0
    const now = Date.now()
    const signatureAge = now - signatureTimestamp

    if (signatureTimestamp === 0) {
      return NextResponse.json(
        createVerificationError(
          "SIGNATURE_TIMESTAMP_INVALID",
          "Timestamp is required",
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    if (signatureAge > MAX_SIGNATURE_AGE_MS) {
      return NextResponse.json(
        createVerificationError(
          "SIGNATURE_EXPIRED",
          `Signed ${Math.round(signatureAge / 1000)}s ago (max ${MAX_SIGNATURE_AGE_MS / 1000}s)`,
        ) satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    if (signatureAge < 0) {
      return NextResponse.json(
        createVerificationError("SIGNATURE_TIMESTAMP_INVALID", "Future date detected") satisfies SelfVerificationResult,
        { status: 400 },
      )
    }

    const nearSignature: NearSignatureData = {
      accountId: data.accountId as string,
      signature: data.signature as string,
      publicKey: data.publicKey as string,
      challenge: CONSTANTS.SIGNING_MESSAGE,
      timestamp: signatureTimestamp,
      nonce: nonce as number[],
      recipient: data.accountId as string,
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
        userId: selfVerificationResult.userData?.userIdentifier || "unknown",
        attestationId: attestationId.toString(),
        signatureData: nearSignature,
        selfProofData,
        userContextData,
      } satisfies VerificationDataWithSignature)

      // Revalidate the verifications cache so new verification appears immediately
      // Next.js 16 requires a cacheLife profile as second argument
      revalidateTag("verifications", "max")

      // Update session status for deep link callback
      // The userId from Self.xyz is used as the sessionId in our deep link flow
      const sessionId = selfVerificationResult.userData?.userIdentifier
      if (sessionId) {
        updateSession(sessionId, {
          status: "success",
          accountId: nearSignature.accountId,
        })
      }
    } catch (error) {
      // Check for duplicate passport error from contract
      const errorMessage = error instanceof Error ? error.message : ""
      const errorCode = errorMessage.includes("already been registered") ? "DUPLICATE_PASSPORT" : "STORAGE_FAILED"

      // Update session status for deep link callback
      const sessionId = selfVerificationResult.userData?.userIdentifier
      if (sessionId) {
        updateSession(sessionId, {
          status: "error",
          error: errorCode,
        })
      }

      return NextResponse.json(
        createVerificationError(
          errorCode,
          error instanceof Error ? error.message : undefined,
        ) satisfies SelfVerificationResult,
        { status: 500 },
      )
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
    return NextResponse.json(
      createVerificationError(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : undefined,
      ) satisfies SelfVerificationResult,
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Self x NEAR verification API",
    timestamp: new Date().toISOString(),
  })
}
