/**
 * NEP-413 Signing Helper for E2E Tests
 *
 * Provides utilities to create valid NEAR signatures for testing
 * the verification API without going through the wallet UI.
 */

import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { serialize } from "borsh"
import { createHash, randomBytes } from "crypto"

// NEP-413 tag: 2^31 + 413 = 2147484061
// This tag identifies messages as NEP-413 compliant for wallet signature verification
const NEP413_TAG = 2147484061

interface TestAccount {
  accountId: string
  publicKey: string
  privateKey: string // ed25519:... format
}

interface SignatureData {
  accountId: string
  publicKey: string
  signature: string // base64 encoded
  nonce: string // base64 encoded
  timestamp: number
}

/**
 * NEP-413 Borsh schema for message serialization.
 * Must match the schema used in verification.ts
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
 * Signs a message using NEP-413 standard.
 *
 * NEP-413 signature format:
 * 1. Create payload: { message, nonce, recipient, callbackUrl: null }
 * 2. Borsh serialize the payload
 * 3. Prepend NEP-413 tag (2^31 + 413) as 4-byte little-endian
 * 4. SHA-256 hash the result
 * 5. Sign the hash with ed25519
 *
 * @param account - Test account with privateKey
 * @param message - The challenge message to sign
 * @param recipient - The recipient account ID (usually the signer's account)
 * @returns SignatureData object ready for verification API
 */
export function signNep413Message(account: TestAccount, message: string, recipient?: string): SignatureData {
  const keyPair = KeyPair.fromString(account.privateKey as KeyPairString)

  // Generate random 32-byte nonce
  const nonce = randomBytes(32)
  const nonceArray = Array.from(nonce)

  // Write NEP-413 tag as 4-byte little-endian
  const tagBuffer = Buffer.alloc(4)
  tagBuffer.writeUInt32LE(NEP413_TAG)

  // Create NEP-413 payload
  const payload = {
    message,
    nonce: new Uint8Array(nonceArray),
    recipient: recipient || account.accountId,
    callbackUrl: null,
  }

  // Borsh serialize the payload
  const payloadBytes = serialize(Nep413BorshSchema, payload)

  // Concatenate tag + payload
  const fullMessage = Buffer.concat([tagBuffer, Buffer.from(payloadBytes)])

  // SHA-256 hash the message
  const messageHash = createHash("sha256").update(fullMessage).digest()

  // Sign the hash
  const signature = keyPair.sign(messageHash)

  return {
    accountId: account.accountId,
    publicKey: account.publicKey,
    signature: Buffer.from(signature.signature).toString("base64"),
    nonce: nonce.toString("base64"),
    timestamp: Date.now(),
  }
}

/**
 * Creates userContextData payload for the verification API.
 * This is hex-encoded JSON containing the NEAR signature data.
 *
 * @param signatureData - Signature data from signNep413Message
 * @param sessionId - UUID session ID for tracking
 * @returns Hex-encoded JSON string
 */
export function createUserContextData(signatureData: SignatureData, sessionId: string): string {
  const payload = {
    accountId: signatureData.accountId,
    publicKey: signatureData.publicKey,
    signature: signatureData.signature,
    nonce: signatureData.nonce,
    timestamp: signatureData.timestamp,
    sessionId,
  }

  return Buffer.from(JSON.stringify(payload)).toString("hex")
}

/**
 * Creates a complete verification request body.
 *
 * @param account - Test account
 * @param message - Challenge message (from getSigningMessage())
 * @param sessionId - UUID session ID
 * @returns Request body for /api/verification/verify
 */
export function createVerificationRequest(
  account: TestAccount,
  message: string,
  sessionId: string,
): {
  attestationId: number
  proof: { a: string[]; b: string[][]; c: string[] }
  publicSignals: string[]
  userContextData: string
} {
  // Sign the message
  const signatureData = signNep413Message(account, message)

  // Create userContextData
  const userContextData = createUserContextData(signatureData, sessionId)

  // Return complete request body with mock ZK proof
  // (ZK proof is mocked when SKIP_ZK_VERIFICATION=true)
  return {
    attestationId: 1, // Passport
    proof: {
      a: ["1", "2"],
      b: [
        ["3", "4"],
        ["5", "6"],
      ],
      c: ["7", "8"],
    },
    publicSignals: Array(21).fill("0"),
    userContextData,
  }
}

export type { TestAccount, SignatureData }
