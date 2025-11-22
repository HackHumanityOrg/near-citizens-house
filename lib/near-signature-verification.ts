import type { NearSignatureData } from "./types"
import * as nearAPI from "near-api-js"
import { serialize } from "borsh"
import { createHash } from "crypto"

/**
 * NEP-413 Payload structure
 */
class Payload {
  message: string
  nonce: Uint8Array
  recipient: string
  callbackUrl?: string

  constructor(message: string, nonce: Uint8Array, recipient: string, callbackUrl?: string) {
    this.message = message
    this.nonce = nonce
    this.recipient = recipient
    this.callbackUrl = callbackUrl
  }
}

/**
 * Borsh schema for NEP-413 Payload
 */
const payloadSchema = {
  struct: {
    message: "string",
    nonce: { array: { type: "u8", len: 32 } }, // Fixed-size array of 32 u8 bytes
    recipient: "string",
    callbackUrl: { option: "string" },
  },
}

/**
 * Verify a NEAR signature according to NEP-413
 * This validates that the signature matches the account and message
 */
export async function verifyNearSignature(signatureData: NearSignatureData, originalMessage: string): Promise<boolean> {
  try {
    const { signature, publicKey, nonce, recipient } = signatureData

    if (!nonce || !recipient) {
      console.error("Missing required NEP-413 fields:", { hasNonce: !!nonce, hasRecipient: !!recipient })
      return false
    }

    const payload = new Payload(originalMessage, new Uint8Array(nonce), recipient)

    // Serialize the tag (2^31 + 413 = 2147484061)
    const tag = 2147484061
    const tagBuffer = Buffer.alloc(4)
    tagBuffer.writeUInt32LE(tag, 0)

    const serializedPayload = serialize(payloadSchema, payload)
    const combined = Buffer.concat([tagBuffer, Buffer.from(serializedPayload)])
    const hash = createHash("sha256").update(combined).digest()

    const pubKey = nearAPI.utils.PublicKey.from(publicKey)
    const signatureBytes = Buffer.from(signature, "base64")

    return pubKey.verify(hash, signatureBytes)
  } catch (error) {
    console.error("Error verifying NEAR signature:", error)
    return false
  }
}
