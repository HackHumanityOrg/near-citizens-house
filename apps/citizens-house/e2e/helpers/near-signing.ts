/**
 * NEP-413 Signing Helper for E2E Tests
 *
 * Provides utilities to create valid NEAR signatures for testing
 * the verification API without going through the wallet UI.
 */

import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { computeNep413Hash, getSigningRecipient, type NearAccountId } from "@near-citizens/shared"
import { randomBytes } from "crypto"

interface TestAccount {
  accountId: NearAccountId
  publicKey: string
  privateKey: string // ed25519:... format
}

type AttestationId = 1 | 2 | 3

const ATTESTATION_IDS: AttestationId[] = [1, 2, 3]

interface SignatureData {
  accountId: NearAccountId
  publicKey: string
  signature: string // base64 encoded
  nonce: string // base64 encoded
  timestamp: number
}

function getRandomAttestationId(): AttestationId {
  const index = Math.floor(Math.random() * ATTESTATION_IDS.length)
  return ATTESTATION_IDS[index]
}

/**
 * Signs a message using NEP-413 standard.
 *
 * NEP-413 signature format:
 * 1. Compute the NEP-413 hash for the payload
 * 2. Sign the hash with ed25519
 *
 * @param account - Test account with privateKey
 * @param message - The challenge message to sign
 * @param recipient - The recipient account ID (verification contract)
 * @returns SignatureData object ready for verification API
 */
export function signNep413Message(account: TestAccount, message: string, recipient?: string): SignatureData {
  const keyPair = KeyPair.fromString(account.privateKey as KeyPairString)

  // Generate random 32-byte nonce
  const nonce = randomBytes(32)
  const nonceBase64 = nonce.toString("base64")

  const recipientId = recipient ?? getSigningRecipient()
  // computeNep413Hash now expects base64 encoded nonce
  const messageHashHex = computeNep413Hash(message, nonceBase64, recipientId)
  const messageHash = Buffer.from(messageHashHex, "hex")

  // Sign the hash
  const signature = keyPair.sign(messageHash)

  return {
    accountId: account.accountId,
    publicKey: account.publicKey,
    signature: Buffer.from(signature.signature).toString("base64"),
    nonce: nonceBase64,
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
 * @param attestationId - Optional attestation ID (defaults to random allowed type)
 * @returns Request body for /api/verification/verify
 */
export function createVerificationRequest(
  account: TestAccount,
  message: string,
  sessionId: string,
  attestationId: AttestationId = getRandomAttestationId(),
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
    attestationId,
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
