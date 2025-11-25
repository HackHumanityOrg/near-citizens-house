import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getVerifier } from "@/lib/self-verifier"
import { PublicKey } from "@near-js/crypto"
import { serialize } from "borsh"
import { createHash } from "crypto"
import { computeNep413Hash, extractEd25519PublicKeyHex } from "@/lib/nep413"

// NEP-413 payload schema for Borsh serialization
const Nep413PayloadSchema = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
}

interface VerificationStep {
  name: string
  status: "pending" | "running" | "success" | "error"
  message?: string
}

interface ProofData {
  nullifier: string
  userId: string
  attestationId: string
  verifiedAt: number
  zkProof: {
    a: [string, string]
    b: [[string, string], [string, string]]
    c: [string, string]
  }
  publicSignals: string[]
  signature: {
    accountId: string
    publicKey: string
    signature: string
    nonce: string // base64 encoded 32-byte nonce
    challenge: string
    recipient: string
  }
  userContextData: string // raw hex-encoded data
  // Pre-computed data for third-party verification
  nearSignatureVerification: {
    nep413Hash: string // SHA-256 hash of NEP-413 formatted message (hex)
    publicKeyHex: string // Raw Ed25519 public key (hex)
    signatureHex: string // Signature in hex
  }
}

interface VerificationResponse {
  verified: boolean
  steps: VerificationStep[]
  nearAccountId?: string
  attestationId?: string
  error?: string
  proofData?: ProofData
}

// Parse userContextData to extract signature data
function parseUserContextData(userContextDataRaw: string): {
  accountId: string
  signature: string
  publicKey: string
  nonce: number[]
} | null {
  try {
    let jsonString = ""

    if (userContextDataRaw.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(userContextDataRaw)) {
      jsonString = Buffer.from(userContextDataRaw, "hex").toString("utf8")
    } else {
      jsonString = userContextDataRaw
    }

    jsonString = jsonString.replace(/\0/g, "")

    const firstBrace = jsonString.indexOf("{")
    const lastBrace = jsonString.lastIndexOf("}")
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1)
    }

    const data = JSON.parse(jsonString)

    if (!data.accountId || !data.signature || !data.publicKey || !data.nonce) {
      return null
    }

    let nonce = data.nonce
    if (typeof nonce === "string") {
      nonce = Array.from(Buffer.from(nonce, "base64"))
    }

    return {
      accountId: data.accountId,
      signature: data.signature,
      publicKey: data.publicKey,
      nonce,
    }
  } catch {
    return null
  }
}

// Verify NEAR signature using NEP-413 standard (matches contract implementation)
function verifyNearSignature(
  challenge: string,
  signature: string,
  publicKeyStr: string,
  nonce: number[],
  recipient: string,
): { valid: boolean; error?: string } {
  try {
    // Step 1: NEP-413 tag (2^31 + 413)
    const tag = 2147484061
    const tagBuffer = Buffer.alloc(4)
    tagBuffer.writeUInt32LE(tag)

    // Step 2: Create NEP-413 payload
    const payload = {
      message: challenge,
      nonce: new Uint8Array(nonce),
      recipient,
      callbackUrl: null,
    }

    // Borsh serialize the payload
    const payloadBytes = serialize(Nep413PayloadSchema, payload)

    // Step 3: Concatenate tag + payload
    const fullMessage = Buffer.concat([tagBuffer, Buffer.from(payloadBytes)])

    // Step 4: SHA-256 hash the message
    const messageHash = createHash("sha256").update(fullMessage).digest()

    // Step 5: Parse public key using @near-js/crypto
    const publicKey = PublicKey.fromString(publicKeyStr)

    // Step 6: Decode signature from base64
    const signatureBytes = Buffer.from(signature, "base64")

    // Step 7: Verify with @near-js/crypto PublicKey.verify()
    const isValid = publicKey.verify(messageHash, signatureBytes)

    return { valid: isValid }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Signature verification failed" }
  }
}

export async function POST(request: NextRequest) {
  const steps: VerificationStep[] = [
    { name: "Loading account data from chain", status: "pending" },
    { name: "Verifying ZK passport proof", status: "pending" },
    { name: "Checking minimum age requirement", status: "pending" },
    { name: "Verifying NEAR wallet signature", status: "pending" },
  ]

  try {
    const { nearAccountId } = await request.json()

    if (!nearAccountId) {
      return NextResponse.json({ verified: false, steps, error: "Missing nearAccountId" } as VerificationResponse, {
        status: 400,
      })
    }

    // Step 1: Load account data
    steps[0].status = "running"
    const account = await db.getVerifiedAccount(nearAccountId)

    if (!account) {
      steps[0].status = "error"
      steps[0].message = "Account not found on chain"
      return NextResponse.json({ verified: false, steps, error: "Account not found" } as VerificationResponse, {
        status: 404,
      })
    }

    steps[0].status = "success"
    steps[0].message = `Found account: ${account.nearAccountId}`

    // Step 2: Verify ZK proof with Self.xyz
    steps[1].status = "running"
    const proof = {
      a: account.selfProof.proof.a.map(BigInt) as [bigint, bigint],
      b: account.selfProof.proof.b.map((row) => row.map(BigInt)) as [[bigint, bigint], [bigint, bigint]],
      c: account.selfProof.proof.c.map(BigInt) as [bigint, bigint],
    }
    const publicSignals = account.selfProof.publicSignals.map(BigInt)
    const verifier = getVerifier()
    const attestationIdNum = Number(account.attestationId) as 1 | 2 | 3

    const selfResult = await verifier.verify(attestationIdNum, proof, publicSignals, account.userContextData)

    if (!selfResult.isValidDetails.isValid) {
      steps[1].status = "error"
      steps[1].message = "ZK proof verification failed"
      return NextResponse.json({ verified: false, steps, error: "ZK proof invalid" } as VerificationResponse, {
        status: 400,
      })
    }

    steps[1].status = "success"
    steps[1].message = "Groth16 ZK proof verified successfully"

    // Step 3: Check minimum age
    steps[2].status = "running"
    if (!selfResult.isValidDetails.isMinimumAgeValid) {
      steps[2].status = "error"
      steps[2].message = "User does not meet minimum age requirement (18+)"
      return NextResponse.json({ verified: false, steps, error: "Minimum age not met" } as VerificationResponse, {
        status: 400,
      })
    }

    steps[2].status = "success"
    steps[2].message = "User meets minimum age requirement"

    // Step 4: Verify NEAR signature
    steps[3].status = "running"
    const sigData = parseUserContextData(account.userContextData)

    if (!sigData) {
      steps[3].status = "error"
      steps[3].message = "Could not parse signature data"
      return NextResponse.json({ verified: false, steps, error: "Invalid signature data" } as VerificationResponse, {
        status: 400,
      })
    }

    const sigResult = verifyNearSignature(
      "Identify myself",
      sigData.signature,
      sigData.publicKey,
      sigData.nonce,
      sigData.accountId,
    )

    if (!sigResult.valid) {
      steps[3].status = "error"
      steps[3].message = sigResult.error || "Signature verification failed"
      return NextResponse.json({ verified: false, steps, error: "Invalid NEAR signature" } as VerificationResponse, {
        status: 400,
      })
    }

    steps[3].status = "success"
    steps[3].message = `NEP-413 signature verified for ${sigData.accountId}`

    // Build proof data for display - include ALL raw data for 3rd party verification
    const challenge = "Identify myself"
    const nep413Hash = computeNep413Hash(challenge, sigData.nonce, sigData.accountId)
    const publicKeyHex = extractEd25519PublicKeyHex(sigData.publicKey)

    const proofData: ProofData = {
      nullifier: account.nullifier,
      userId: account.userId,
      attestationId: account.attestationId,
      verifiedAt: account.verifiedAt,
      zkProof: account.selfProof.proof,
      publicSignals: account.selfProof.publicSignals,
      signature: {
        accountId: sigData.accountId,
        publicKey: sigData.publicKey,
        signature: sigData.signature,
        nonce: Buffer.from(sigData.nonce).toString("base64"),
        challenge,
        recipient: sigData.accountId,
      },
      userContextData: account.userContextData,
      nearSignatureVerification: {
        nep413Hash,
        publicKeyHex,
        signatureHex: Buffer.from(sigData.signature, "base64").toString("hex"),
      },
    }

    return NextResponse.json({
      verified: true,
      steps,
      nearAccountId: account.nearAccountId,
      attestationId: account.attestationId,
      proofData,
    } as VerificationResponse)
  } catch (error) {
    console.error("[verify-stored] Error:", error)

    // Mark any running step as error
    const runningStep = steps.find((s) => s.status === "running")
    if (runningStep) {
      runningStep.status = "error"
      runningStep.message = error instanceof Error ? error.message : "Verification failed"
    }

    return NextResponse.json(
      {
        verified: false,
        steps,
        error: error instanceof Error ? error.message : "Verification failed",
      } as VerificationResponse,
      { status: 500 },
    )
  }
}
