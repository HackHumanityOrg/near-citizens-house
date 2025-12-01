/**
 * NEAR signature verification utilities (NEP-413 standard)
 * Consolidates NEP-413 hashing, signature verification, and proof building
 */

import { PublicKey } from "@near-js/crypto"
import { serialize } from "borsh"
import { createHash } from "crypto"
import bs58 from "bs58"
import type { ParsedSignatureData, ProofData } from "./types"

export type { ParsedSignatureData, ProofData }

// NEP-413 payload schema for Borsh serialization
const Nep413PayloadSchema = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } },
    recipient: "string",
    callbackUrl: { option: "string" },
  },
}

/**
 * Computes the NEP-413 message hash that is actually signed by NEAR wallets.
 *
 * The hash is computed as: SHA-256(tag || borsh_serialize(payload))
 * where:
 *   - tag = 2147484061 (2^31 + 413) as 4-byte little-endian
 *   - payload = { message, nonce, recipient, callbackUrl: null }
 *
 * @param message - The challenge message that was signed
 * @param nonce - The 32-byte nonce as an array of numbers
 * @param recipient - The recipient account ID
 * @returns The SHA-256 hash as a hex string
 */
export function computeNep413Hash(message: string, nonce: number[], recipient: string): string {
  // NEP-413 tag (2^31 + 413)
  const tag = 2147484061
  const tagBuffer = Buffer.alloc(4)
  tagBuffer.writeUInt32LE(tag)

  const payload = {
    message,
    nonce: new Uint8Array(nonce),
    recipient,
    callbackUrl: null,
  }

  const payloadBytes = serialize(Nep413PayloadSchema, payload)
  const fullMessage = Buffer.concat([tagBuffer, Buffer.from(payloadBytes)])
  const hash = createHash("sha256").update(fullMessage).digest()

  return hash.toString("hex")
}

/**
 * Extracts the raw Ed25519 public key bytes from a NEAR public key string.
 *
 * NEAR public keys are formatted as "ed25519:BASE58_ENCODED_KEY".
 * This function extracts the raw 32-byte key and returns it as hex.
 *
 * @param nearPublicKey - NEAR formatted public key (e.g., "ed25519:ABC...")
 * @returns The raw 32-byte public key as a hex string
 */
export function extractEd25519PublicKeyHex(nearPublicKey: string): string {
  const base58Part = nearPublicKey.replace("ed25519:", "")
  const decoded = bs58.decode(base58Part)
  return Buffer.from(decoded).toString("hex")
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

    // Look for the start of the JSON object by finding {"accountId"
    // (not just {, as binary data may contain { bytes)
    const jsonStart = jsonString.indexOf('{"accountId"')
    if (jsonStart === -1) {
      // Fallback: try to find any valid JSON object start
      const firstBrace = jsonString.indexOf("{")
      const lastBrace = jsonString.lastIndexOf("}")
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1)
      }
    } else {
      const lastBrace = jsonString.lastIndexOf("}")
      if (lastBrace > jsonStart) {
        jsonString = jsonString.substring(jsonStart, lastBrace + 1)
      }
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
