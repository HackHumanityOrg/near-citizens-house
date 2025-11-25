import { serialize } from "borsh"
import { createHash } from "crypto"
import bs58 from "bs58"

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
