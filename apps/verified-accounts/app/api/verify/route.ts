import { type NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  SELF_CONFIG,
  CONSTANTS,
  ERROR_MESSAGES,
  verificationDb,
  getVerifier,
  verifyRequestSchema,
  type SelfVerificationResult,
  type NearSignatureData,
  type VerificationDataWithSignature,
} from "@near-citizens/shared"

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
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: `${ERROR_MESSAGES.MISSING_FIELDS}: ${parseResult.error.issues.map((i) => i.path.join(".")).join(", ")}`,
        } as SelfVerificationResult,
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
        {
          status: "error",
          result: false,
          reason: `Self verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        } as SelfVerificationResult,
        { status: 400 },
      )
    }

    const { isValid, isMinimumAgeValid, isOfacValid } = selfVerificationResult.isValidDetails || {}

    const ofacEnabled = SELF_CONFIG.backendConfig.ofac === true
    const ofacCheckFailed = ofacEnabled && isOfacValid === false

    if (!isValid || !isMinimumAgeValid || ofacCheckFailed) {
      let reason = ERROR_MESSAGES.VERIFICATION_FAILED
      if (!isMinimumAgeValid) reason = "Minimum age requirement not met (must be 18+)"
      if (ofacCheckFailed) reason = "OFAC verification failed - user may be on sanctions list"

      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason,
        } as SelfVerificationResult,
        { status: 400 },
      )
    }

    const nullifier = selfVerificationResult.discloseOutput?.nullifier

    if (!nullifier) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: ERROR_MESSAGES.NULLIFIER_MISSING,
        } as SelfVerificationResult,
        { status: 400 },
      )
    }

    let nearSignature: NearSignatureData

    try {
      const userDefinedDataRaw = selfVerificationResult.userData?.userDefinedData
      const jsonString = parseUserDefinedData(userDefinedDataRaw)

      if (!jsonString) {
        throw new Error("Could not extract JSON from userDefinedData")
      }

      const data = JSON.parse(jsonString)

      if (!data.accountId || !data.signature || !data.publicKey || !data.nonce) {
        throw new Error(
          `Missing required NEP-413 fields: ${["accountId", "signature", "publicKey", "nonce"].filter((f) => !data[f]).join(", ")}`,
        )
      }

      let nonce = data.nonce
      if (typeof nonce === "string") {
        nonce = Array.from(Buffer.from(nonce, "base64"))
      }
      if (!Array.isArray(nonce) || nonce.length !== 32) {
        throw new Error(`Invalid nonce: expected 32-byte array, got ${typeof nonce}`)
      }

      // Validate signature timestamp freshness
      const signatureTimestamp = typeof data.timestamp === "number" ? data.timestamp : 0
      const now = Date.now()
      const signatureAge = now - signatureTimestamp

      if (signatureTimestamp === 0) {
        throw new Error("Signature timestamp is required for security")
      } else if (signatureAge > MAX_SIGNATURE_AGE_MS) {
        throw new Error(
          `Signature expired: signed ${Math.round(signatureAge / 1000)}s ago (max ${MAX_SIGNATURE_AGE_MS / 1000}s)`,
        )
      } else if (signatureAge < 0) {
        // Future timestamp - possible clock skew or manipulation
        throw new Error("Invalid signature timestamp: future date detected")
      }

      nearSignature = {
        accountId: data.accountId,
        signature: data.signature,
        publicKey: data.publicKey,
        challenge: CONSTANTS.SIGNING_MESSAGE,
        timestamp: signatureTimestamp || now,
        nonce: nonce,
        recipient: data.accountId,
      }
    } catch (e) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: `${ERROR_MESSAGES.NEAR_SIGNATURE_MISSING}: ${e instanceof Error ? e.message : "Parse error"}`,
        } as SelfVerificationResult,
        { status: 400 },
      )
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
    } catch (error) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: error instanceof Error ? error.message : "Failed to store verification",
        } as SelfVerificationResult,
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
      } as SelfVerificationResult,
      { status: 200 },
    )
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: error instanceof Error ? error.message : "Internal server error",
      } as SelfVerificationResult,
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
