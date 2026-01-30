/**
 * NEAR signature verification utilities (NEP-413 standard)
 *
 * This module re-exports pure cryptographic functions from verification-core.ts
 * and adds config-aware functions that depend on application environment.
 *
 * For tests that don't need config, import directly from verification-core.ts.
 */

import { getSigningMessage, getSigningRecipient } from "./config"
import type { ParsedSignatureData } from "./schemas/near"
import { computeNep413Hash, extractEd25519PublicKeyHex } from "./verification-core"

// Re-export all pure functions from verification-core
export {
  computeNep413Hash,
  extractEd25519PublicKeyHex,
  parseUserContextData,
  verifyNearSignature,
  validateSignatureData,
  type SignatureValidationResult,
} from "./verification-core"

// Re-export signing helpers for use in API routes
export { getSigningMessage, getSigningRecipient }

/**
 * Build signature verification data for display purposes.
 * Uses application config for default challenge/recipient values.
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
