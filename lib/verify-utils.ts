/**
 * Shared verification utilities for NEAR signature and user context data parsing.
 * Extracted from app/api/verify-stored/route.ts for use in Server Components.
 */

import { PublicKey } from "@near-js/crypto"
import { serialize } from "borsh"
import { createHash } from "crypto"
import { computeNep413Hash, extractEd25519PublicKeyHex } from "./nep413"

// NEP-413 payload schema for Borsh serialization
const Nep413PayloadSchema = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
}

export interface ParsedSignatureData {
  accountId: string
  signature: string
  publicKey: string
  nonce: number[]
}

/**
 * Parse userContextData to extract signature data.
 * Handles both hex-encoded and plain JSON formats.
 */
export function parseUserContextData(userContextDataRaw: string): ParsedSignatureData | null {
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

/**
 * Verify NEAR signature using NEP-413 standard.
 * Matches the contract implementation.
 */
export function verifyNearSignature(
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

export interface ProofData {
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
  nearSignatureVerification: {
    nep413Hash: string // SHA-256 hash of NEP-413 formatted message (hex)
    publicKeyHex: string // Raw Ed25519 public key (hex)
    signatureHex: string // Signature in hex
  }
}

/**
 * Build proof data object for display in the verification dialog.
 */
export function buildProofData(
  account: {
    nullifier: string
    userId: string
    attestationId: string
    verifiedAt: number
    selfProof: {
      proof: {
        a: [string, string]
        b: [[string, string], [string, string]]
        c: [string, string]
      }
      publicSignals: string[]
    }
    userContextData: string
  },
  sigData: ParsedSignatureData | null,
): ProofData | null {
  if (!sigData) return null

  const challenge = "Identify myself"
  const nep413Hash = computeNep413Hash(challenge, sigData.nonce, sigData.accountId)
  const publicKeyHex = extractEd25519PublicKeyHex(sigData.publicKey)

  return {
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
}
