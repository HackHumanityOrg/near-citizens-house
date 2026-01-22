/**
 * NEAR signature verification utilities (NEP-413 standard)
 * Consolidates NEP-413 hashing, signature verification, and context parsing
 */

import { PublicKey } from "@near-js/crypto"
import { serialize } from "borsh"
import { createHash } from "crypto"
import bs58 from "bs58"
import { getSigningMessage, getSigningRecipient } from "./config"
import { parsedSignatureDataSchema, type ParsedSignatureData } from "./schemas/near"

// Re-export signing helpers for use in API routes
export { getSigningMessage, getSigningRecipient }

/**
 * NEP-413 payload schema for Borsh binary serialization.
 *
 * Note: This is a Borsh schema (not Zod) required by the `borsh` library's serialize() function.
 * For type validation and TypeScript types, see `nep413PayloadSchema` in schemas/near.ts.
 * The two schemas define the same structure but serve different purposes:
 * - Borsh schema: Binary serialization for cryptographic operations
 * - Zod schema: Runtime validation and TypeScript type inference
 */
const Nep413BorshSchema = {
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
 * @param nonce - The 32-byte nonce as base64 string
 * @param recipient - The recipient account ID
 * @returns The SHA-256 hash as a hex string
 */
export function computeNep413Hash(message: string, nonce: string, recipient: string): string {
  // NEP-413 tag (2^31 + 413)
  const tag = 2147484061
  const tagBuffer = Buffer.alloc(4)
  tagBuffer.writeUInt32LE(tag)

  // Decode base64 nonce to bytes
  const nonceBytes = Buffer.from(nonce, "base64")

  const payload = {
    message,
    nonce: new Uint8Array(nonceBytes),
    recipient,
    callbackUrl: null,
  }

  const payloadBytes = serialize(Nep413BorshSchema, payload)
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
 * Returns base64 encoded nonce for consistent handling.
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

    // Validate using Zod schema instead of manual checks
    const result = parsedSignatureDataSchema.safeParse(data)
    if (!result.success) {
      return null
    }

    return result.data
  } catch {
    return null
  }
}

/**
 * Verify NEAR signature using NEP-413 standard.
 * Matches the contract implementation.
 *
 * @param challenge - The message that was signed
 * @param signature - base64 encoded signature
 * @param publicKeyStr - ed25519:BASE58 format public key
 * @param nonce - base64 encoded 32-byte nonce
 * @param recipient - The recipient account ID
 */
export function verifyNearSignature(
  challenge: string,
  signature: string,
  publicKeyStr: string,
  nonce: string,
  recipient: string,
): { valid: boolean; error?: string } {
  try {
    // Step 1: NEP-413 tag (2^31 + 413)
    const tag = 2147484061
    const tagBuffer = Buffer.alloc(4)
    tagBuffer.writeUInt32LE(tag)

    // Step 2: Decode base64 nonce to bytes
    const nonceBytes = Buffer.from(nonce, "base64")

    // Step 3: Create NEP-413 payload
    const payload = {
      message: challenge,
      nonce: new Uint8Array(nonceBytes),
      recipient,
      callbackUrl: null,
    }

    // Borsh serialize the payload
    const payloadBytes = serialize(Nep413BorshSchema, payload)

    // Step 4: Concatenate tag + payload
    const fullMessage = Buffer.concat([tagBuffer, Buffer.from(payloadBytes)])

    // Step 5: SHA-256 hash the message
    const messageHash = createHash("sha256").update(fullMessage).digest()

    // Step 6: Parse public key using @near-js/crypto
    const publicKey = PublicKey.fromString(publicKeyStr)

    // Step 7: Decode signature from base64
    const signatureBytes = Buffer.from(signature, "base64")

    // Step 8: Verify with @near-js/crypto PublicKey.verify()
    const isValid = publicKey.verify(messageHash, signatureBytes)

    if (!isValid) {
      return { valid: false, error: "Invalid NEAR signature" }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Signature verification failed" }
  }
}

/**
 * Build signature verification data for display purposes.
 */
export function buildSignatureVerificationData(sigData: ParsedSignatureData): {
  nep413Hash: string
  publicKeyHex: string
  signatureHex: string
} {
  const challenge = sigData.challenge ?? getSigningMessage()
  const recipient = sigData.recipient ?? getSigningRecipient()
  const nep413Hash = computeNep413Hash(challenge, sigData.nonce, recipient)
  const publicKeyHex = extractEd25519PublicKeyHex(sigData.publicKey)

  return {
    nep413Hash,
    publicKeyHex,
    signatureHex: Buffer.from(sigData.signature, "base64").toString("hex"),
  }
}
