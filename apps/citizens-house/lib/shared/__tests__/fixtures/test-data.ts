/**
 * Test Data Fixtures for @near-citizens/shared tests
 *
 * Contains synthetic test data for unit tests.
 * For real integration tests, use actual Self.xyz mock passport data.
 */

import type { SelfProofData } from "../../contracts/verification"

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
 * Standard 32-byte nonce filled with zeros
 */
export const zeroNonce = Array(32).fill(0) as number[]

/**
 * Random nonce for variety tests
 */
export const randomNonce = Array.from({ length: 32 }, (_, i) => (i * 7 + 13) % 256) as number[]

/**
 * Max value nonce (all 0xFF)
 */
export const maxNonce = Array(32).fill(255) as number[]

/**
 * Sequential nonce (0, 1, 2, ..., 31)
 */
export const sequentialNonce = Array.from({ length: 32 }, (_, i) => i) as number[]

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
 */
export function createUserContext(accountId: string, signature: string, publicKey: string, nonce: number[]) {
  return {
    accountId,
    signature,
    publicKey,
    nonce: Buffer.from(nonce).toString("base64"),
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
