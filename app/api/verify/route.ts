import { type NextRequest, NextResponse } from "next/server"
import { verifyNearSignature } from "@/lib/near-signature-verification"
import { SELF_CONFIG, CONSTANTS, ERROR_MESSAGES } from "@/lib/config"
import type { SelfVerificationResult } from "@/lib/types"
import type { VerificationDataWithSignature } from "@/lib/database"
import { db } from "@/lib/database"
import { getVerifier } from "@/lib/self-verifier"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { attestationId, proof, publicSignals, userContextData } = body

    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: ERROR_MESSAGES.MISSING_FIELDS,
        } as SelfVerificationResult,
        { status: 400 },
      )
    }

    let selfVerificationResult

    try {
      const verifier = getVerifier()
      const attestationIdNum = Number(attestationId) as 1 | 2 | 3
      selfVerificationResult = await verifier.verify(attestationIdNum, proof, publicSignals, userContextData)
    } catch (error) {
      console.error("Self verification error:", error)
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: `Self verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        } as SelfVerificationResult,
        { status: 200 },
      )
    }

    const { isValid, isMinimumAgeValid, isOfacValid } = selfVerificationResult.isValidDetails || {}

    const ofacEnabled = SELF_CONFIG.backendConfig.ofac === true

    console.log("[OFAC DEBUG] Verification details:", {
      isValid,
      isMinimumAgeValid,
      isOfacValid,
      ofacEnabled,
      ofacType: typeof isOfacValid,
    })

    // Only check OFAC if it's enabled in config
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
        { status: 200 },
      )
    }

    const nullifier = selfVerificationResult.discloseOutput?.nullifier

    if (!nullifier) {
      console.error("[SECURITY] Nullifier not found in proof")
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: ERROR_MESSAGES.NULLIFIER_MISSING,
        } as SelfVerificationResult,
        { status: 400 },
      )
    }

    const isNullifierUsed = await db.isNullifierUsed(nullifier.toString())

    if (isNullifierUsed) {
      console.warn("[SECURITY] Duplicate passport registration attempted")
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: ERROR_MESSAGES.DUPLICATE_PASSPORT,
        } as SelfVerificationResult,
        { status: 403 },
      )
    }

    let nearSignature = null
    try {
      const userDefinedDataRaw = selfVerificationResult.userData?.userDefinedData
      let jsonString = ""

      if (typeof userDefinedDataRaw === "string") {
        // Try to detect if it's hex encoded
        if (/^[0-9a-fA-F]+$/.test(userDefinedDataRaw)) {
          try {
            jsonString = Buffer.from(userDefinedDataRaw, "hex").toString("utf8")
          } catch {
            // If hex decoding fails, assume it's a raw string
            jsonString = userDefinedDataRaw
          }
        } else {
          jsonString = userDefinedDataRaw
        }
      } else if (Array.isArray(userDefinedDataRaw)) {
        jsonString = new TextDecoder().decode(new Uint8Array(userDefinedDataRaw))
      } else if (typeof userDefinedDataRaw === "object" && userDefinedDataRaw !== null) {
        const values = Object.values(userDefinedDataRaw)
        jsonString = new TextDecoder().decode(new Uint8Array(values as number[]))
      }

      // Clean up string
      jsonString = jsonString.replace(/\0/g, "")

      // Extract JSON object
      const firstBrace = jsonString.indexOf("{")
      const lastBrace = jsonString.lastIndexOf("}")
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1)
      }

      const data = JSON.parse(jsonString)

      if (data.accountId && data.signature && data.publicKey && data.nonce) {
        let nonce = data.nonce
        if (typeof nonce === "string") {
          nonce = Array.from(Buffer.from(nonce, "base64"))
        } else if (!Array.isArray(nonce)) {
          console.error("Invalid nonce format")
          nonce = undefined
        }

        nearSignature = {
          accountId: data.accountId,
          signature: data.signature,
          publicKey: data.publicKey,
          challenge: CONSTANTS.SIGNING_MESSAGE,
          timestamp: Date.now(),
          nonce: nonce,
          recipient: data.accountId,
        }
      } else {
        console.error("Missing required NEP-413 fields")
      }
    } catch (e) {
      console.error("Failed to parse NEAR signature:", e)
    }

    if (!nearSignature) {
      console.error("Failed to extract NEAR signature from valid proof")
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: ERROR_MESSAGES.NEAR_SIGNATURE_MISSING,
        } as SelfVerificationResult,
        { status: 200 },
      )
    }

    const isNearSignatureValid = await verifyNearSignature(nearSignature, nearSignature.challenge)

    if (!isNearSignatureValid) {
      console.error("NEAR signature verification failed")
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: ERROR_MESSAGES.NEAR_SIGNATURE_INVALID,
        } as SelfVerificationResult,
        { status: 200 },
      )
    }

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

      await db.storeVerification({
        nullifier: nullifier.toString(),
        nearAccountId: nearSignature.accountId,
        userId: selfVerificationResult.userData?.userIdentifier || "unknown",
        attestationId: attestationId.toString(),
        // Pass signature data for on-chain verification
        signatureData: nearSignature,
        // Pass Self.xyz proof data for async verification
        selfProofData,
      } satisfies VerificationDataWithSignature)
    } catch (error) {
      console.error("[SECURITY] Failed to store verification:", error)
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
    console.error("Verification API error:", error)
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
