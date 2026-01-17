/**
 * Test Data Fixtures for @near-citizens/shared tests
 *
 * Contains synthetic test data for unit tests.
 * For real integration tests, use actual Self.xyz mock passport data.
 */

import type { SelfProofData } from "../../schemas/zk-proof"
import type { NearAccountId } from "../../schemas/near"

// ============================================================================
// ZK Proof Test Data
// ============================================================================

/**
 * Syntactically valid but cryptographically invalid proof
 * Use for testing network calls and error handling
 */
export const mockInvalidProof: SelfProofData = {
  proof: {
    a: ["1", "2"],
    b: [
      ["3", "4"],
      ["5", "6"],
    ],
    c: ["7", "8"],
  },
  publicSignals: Array(21).fill("0"),
}

/**
 * Well-formed proof with valid BigInt strings (max BN254 field element - 1)
 * Still cryptographically invalid, but passes structural validation
 */
export const wellFormedProof: SelfProofData = {
  proof: {
    a: [
      "21888242871839275222246405745257275088696311157297823662689037894645226208582",
      "21888242871839275222246405745257275088696311157297823662689037894645226208582",
    ],
    b: [
      [
        "21888242871839275222246405745257275088696311157297823662689037894645226208582",
        "21888242871839275222246405745257275088696311157297823662689037894645226208582",
      ],
      [
        "21888242871839275222246405745257275088696311157297823662689037894645226208582",
        "21888242871839275222246405745257275088696311157297823662689037894645226208582",
      ],
    ],
    c: [
      "21888242871839275222246405745257275088696311157297823662689037894645226208582",
      "21888242871839275222246405745257275088696311157297823662689037894645226208582",
    ],
  },
  publicSignals: Array(21).fill("21888242871839275222246405745257275088696311157297823662689037894645226208582"),
}

/**
 * Proof with all zero values
 */
export const zeroProof: SelfProofData = {
  proof: {
    a: ["0", "0"],
    b: [
      ["0", "0"],
      ["0", "0"],
    ],
    c: ["0", "0"],
  },
  publicSignals: Array(21).fill("0"),
}

/**
 * Proof with empty public signals (edge case)
 */
export const emptySignalsProof: SelfProofData = {
  proof: {
    a: ["0", "0"],
    b: [
      ["0", "0"],
      ["0", "0"],
    ],
    c: ["0", "0"],
  },
  publicSignals: [],
}

// ============================================================================
// NEP-413 Test Data
// ============================================================================

/**
 * Standard 32-byte nonce filled with zeros (base64 encoded)
 */
export const zeroNonce = Buffer.alloc(32, 0).toString("base64")

/**
 * Random nonce for variety tests (base64 encoded)
 */
export const randomNonce = Buffer.from(Array.from({ length: 32 }, (_, i) => (i * 7 + 13) % 256)).toString("base64")

/**
 * Max value nonce (all 0xFF) (base64 encoded)
 */
export const maxNonce = Buffer.alloc(32, 255).toString("base64")

/**
 * Sequential nonce (0, 1, 2, ..., 31) (base64 encoded)
 */
export const sequentialNonce = Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString("base64")

// ============================================================================
// Account Test Data
// ============================================================================

export const testAccountIds = {
  alice: "alice.testnet",
  bob: "bob.testnet",
  charlie: "charlie.testnet",
  longName: "a".repeat(64) + ".testnet",
  unicode: "тест.testnet", // May not be valid, but tests edge case
}

// ============================================================================
// User Context Test Data
// ============================================================================

/**
 * Create a valid user context JSON object
 * @param nonce - base64 encoded 32-byte nonce
 */
export function createUserContext(accountId: NearAccountId, signature: string, publicKey: string, nonce: string) {
  return {
    accountId,
    signature,
    publicKey,
    nonce, // already base64 encoded
  }
}

/**
 * Convert user context to hex-encoded string
 */
export function userContextToHex(context: object): string {
  return Buffer.from(JSON.stringify(context)).toString("hex")
}

// ============================================================================
// Attestation IDs
// ============================================================================

export const AttestationIds = {
  PASSPORT: 1,
  BIOMETRIC_ID: 2,
  AADHAAR: 3,
} as const

// ============================================================================
// Size Limits (from contracts/verified-accounts-interface)
// ============================================================================

export const SizeLimits = {
  NULLIFIER: 80,
  USER_ID: 80,
  ATTESTATION_ID: 1, // Self.xyz uses 1, 2, 3
  USER_CONTEXT_DATA: 4096,
  PUBLIC_SIGNALS_COUNT: 21,
  PROOF_COMPONENT: 80,
  MAX_BATCH_SIZE: 100,
  NONCE_LENGTH: 32,
  SIGNATURE_LENGTH: 64,
} as const
