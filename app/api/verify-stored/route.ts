import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getVerifier } from "@/lib/self-verifier"

export async function POST(request: NextRequest) {
  try {
    const { nearAccountId } = await request.json()

    if (!nearAccountId) {
      return NextResponse.json({ verified: false, reason: "Missing nearAccountId" }, { status: 400 })
    }

    // Fetch verification from contract
    const account = await db.getVerifiedAccount(nearAccountId)

    if (!account) {
      return NextResponse.json({ verified: false, reason: "Account not found" }, { status: 404 })
    }

    // Reconstruct userContextData from stored components
    // The original format is a JSON object hex-encoded
    const nearSigData = {
      accountId: account.nearAccountId,
      signature: account.nearSignature,
      publicKey: account.nearPublicKey,
      nonce: account.nearNonce,
    }
    const userContextData = Buffer.from(JSON.stringify(nearSigData)).toString("hex")

    // Convert proof strings to BigInt for Self.xyz verifier
    const proof = {
      a: account.selfProof.proof.a.map(BigInt) as [bigint, bigint],
      b: account.selfProof.proof.b.map((row) => row.map(BigInt)) as [[bigint, bigint], [bigint, bigint]],
      c: account.selfProof.proof.c.map(BigInt) as [bigint, bigint],
    }

    const publicSignals = account.selfProof.publicSignals.map(BigInt)

    // Re-verify with Self.xyz
    const verifier = getVerifier()
    const attestationId = Number(account.attestationId) as 1 | 2 | 3

    const result = await verifier.verify(attestationId, proof, publicSignals, userContextData)

    return NextResponse.json({
      verified: result.isValidDetails.isValid,
      details: {
        isMinimumAgeValid: result.isValidDetails.isMinimumAgeValid,
        isOfacValid: result.isValidDetails.isOfacValid,
      },
      nearAccountId: account.nearAccountId,
      attestationId: account.attestationId,
    })
  } catch (error) {
    console.error("[verify-stored] Error:", error)
    return NextResponse.json(
      {
        verified: false,
        reason: error instanceof Error ? error.message : "Verification failed",
      },
      { status: 500 },
    )
  }
}
