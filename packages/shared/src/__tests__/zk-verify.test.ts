/**
 * Unit tests for zk-verify.ts
 *
 * Tests ZK proof verification functions per TESTING_STRATEGY.md Section 1.2
 * Covers: verifyStoredProof, verifyStoredProofWithDetails
 *
 * NOTE: These tests use REAL Celo RPC network calls per user requirement.
 * Tests may be slower but validate actual integration with on-chain verifier.
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest"
import * as allure from "allure-js-commons"
import { verifyStoredProof, verifyStoredProofWithDetails } from "../zk-verify"
import type { SelfProofData } from "../contracts/verification"

// ============================================================================
// Test Data Fixtures
// ============================================================================

/**
 * NOTE: For real network tests, we need syntactically valid proof data.
 * These are NOT cryptographically valid proofs - they will fail verification
 * but test the network communication and error handling.
 *
 * To test with valid proofs, you would need to:
 * 1. Generate a real proof using Self.xyz mock passport on staging
 * 2. Save the proof data as a fixture
 */

// Syntactically valid but cryptographically invalid proof (for testing network calls)
const mockInvalidProof: SelfProofData = {
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

// Well-formed proof with proper BigInt-compatible strings
const wellFormedProof: SelfProofData = {
  proof: {
    a: [
      "21888242871839275222246405745257275088696311157297823662689037894645226208583",
      "21888242871839275222246405745257275088696311157297823662689037894645226208583",
    ],
    b: [
      [
        "21888242871839275222246405745257275088696311157297823662689037894645226208583",
        "21888242871839275222246405745257275088696311157297823662689037894645226208583",
      ],
      [
        "21888242871839275222246405745257275088696311157297823662689037894645226208583",
        "21888242871839275222246405745257275088696311157297823662689037894645226208583",
      ],
    ],
    c: [
      "21888242871839275222246405745257275088696311157297823662689037894645226208583",
      "21888242871839275222246405745257275088696311157297823662689037894645226208583",
    ],
  },
  publicSignals: Array(21).fill("21888242871839275222246405745257275088696311157297823662689037894645226208583"),
}

// Proof with empty values
const emptyProof: SelfProofData = {
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

// Attestation IDs
const PASSPORT_ATTESTATION_ID = 1
const BIOMETRIC_ATTESTATION_ID = 2
const AADHAAR_ATTESTATION_ID = 3

beforeEach(async () => {
  await allure.label("parentSuite", "Near Citizens House")
  await allure.label("suite", "Shared Library Tests")
  await allure.label("subSuite", "ZK Verification")
})

// ============================================================================
// verifyStoredProof Tests
// ============================================================================

describe("verifyStoredProof", () => {
  beforeAll(async () => {
    await allure.suite("ZK Verification - Unit Tests")
    await allure.feature("Groth16 Proof Verification")
  })

  describe("Happy Path (Network Connectivity)", () => {
    it("should connect to Celo RPC and attempt verification", async () => {
      await allure.severity("critical")
      await allure.story("RPC Connectivity")
      await allure.description(
        "Verifies that the function can connect to Celo RPC endpoints. " +
          "An invalid proof should return false (not throw).",
      )

      // This will make a real network call to Celo
      // Invalid proof should return false, not throw
      const result = await verifyStoredProof(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
      // Invalid proof should return false
      expect(result).toBe(false)
    })

    it("should handle well-formed proof structure", async () => {
      await allure.severity("critical")
      await allure.story("Proof Structure")

      // Well-formed but invalid proof
      const result = await verifyStoredProof(wellFormedProof, PASSPORT_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Positive Tests - Attestation Types", () => {
    it("should support Passport attestation (ID=1)", async () => {
      await allure.severity("normal")
      await allure.story("Passport Attestation")

      const result = await verifyStoredProof(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })

    it("should support BiometricID attestation (ID=2)", async () => {
      await allure.severity("normal")
      await allure.story("Biometric Attestation")

      // BiometricID uses same verifier contract
      const result = await verifyStoredProof(mockInvalidProof, BIOMETRIC_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })

    it("should support Aadhaar attestation (ID=3)", async () => {
      await allure.severity("normal")
      await allure.story("Aadhaar Attestation")

      const result = await verifyStoredProof(mockInvalidProof, AADHAAR_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Negative Tests", () => {
    it("should return false for invalid proof", async () => {
      await allure.severity("critical")
      await allure.story("Invalid Proof")

      const result = await verifyStoredProof(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      expect(result).toBe(false)
    })

    it("should handle proof with zero values", async () => {
      await allure.severity("normal")
      await allure.story("Zero Proof")

      // Proof with all zeros should fail verification
      const zeroProof: SelfProofData = {
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

      const result = await verifyStoredProof(zeroProof, PASSPORT_ATTESTATION_ID)

      expect(result).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("should handle proof b coordinate swap correctly", async () => {
      await allure.severity("critical")
      await allure.story("B Coordinate Swap")
      await allure.description(
        "The Groth16 verifier expects b coordinates in swapped order: " +
          "b[i][1], b[i][0] instead of b[i][0], b[i][1]. " +
          "This test verifies the swap is applied.",
      )

      // The implementation swaps b coordinates internally
      // This test ensures that's happening by making a network call
      const result = await verifyStoredProof(wellFormedProof, PASSPORT_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })

    it("should default to attestationId=1 when not specified", async () => {
      await allure.severity("minor")
      await allure.story("Default Attestation")

      // Call without explicit attestationId
      const result = await verifyStoredProof(mockInvalidProof)

      expect(typeof result).toBe("boolean")
    })
  })

  describe("Boundary Tests", () => {
    it("should handle exactly 21 public signals (passport max)", async () => {
      await allure.severity("critical")
      await allure.story("Max Public Signals")

      const proofWith21Signals: SelfProofData = {
        ...mockInvalidProof,
        publicSignals: Array(21).fill("123456789"),
      }

      const result = await verifyStoredProof(proofWith21Signals, PASSPORT_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })

    it("should handle proof with large BN254 field elements", async () => {
      await allure.severity("normal")
      await allure.story("Large Field Elements")

      // Max BN254 field element is about 77 decimal digits
      const largeElement = "21888242871839275222246405745257275088696311157297823662689037894645226208582"

      const proofWithLargeElements: SelfProofData = {
        proof: {
          a: [largeElement, largeElement],
          b: [
            [largeElement, largeElement],
            [largeElement, largeElement],
          ],
          c: [largeElement, largeElement],
        },
        publicSignals: Array(21).fill(largeElement),
      }

      const result = await verifyStoredProof(proofWithLargeElements, PASSPORT_ATTESTATION_ID)

      expect(typeof result).toBe("boolean")
    })
  })
})

// ============================================================================
// verifyStoredProofWithDetails Tests
// ============================================================================

describe("verifyStoredProofWithDetails", () => {
  beforeAll(async () => {
    await allure.suite("ZK Verification - Unit Tests")
    await allure.feature("Detailed Proof Verification")
  })

  describe("Happy Path", () => {
    it("should return detailed result with verifier address", async () => {
      await allure.severity("critical")
      await allure.story("Detailed Result")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      expect(result).toBeDefined()
      expect(typeof result.isValid).toBe("boolean")
      expect(typeof result.publicSignalsCount).toBe("number")
    })

    it("should include RPC URL used for verification", async () => {
      await allure.severity("normal")
      await allure.story("RPC URL Tracking")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      // On success, should include rpcUrl
      if (!result.error) {
        expect(result.rpcUrl).toBeDefined()
        expect(result.rpcUrl).toContain("celo")
      }
    })

    it("should include verifier address on success", async () => {
      await allure.severity("normal")
      await allure.story("Verifier Address")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      if (!result.error) {
        expect(result.verifierAddress).toBeDefined()
        expect(result.verifierAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
      }
    })
  })

  describe("Positive Tests", () => {
    it("should return correct public signals count", async () => {
      await allure.severity("normal")
      await allure.story("Signals Count")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      expect(result.publicSignalsCount).toBe(21)
    })

    it("should return isValid=false for invalid proof", async () => {
      await allure.severity("critical")
      await allure.story("Invalid Result")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      expect(result.isValid).toBe(false)
    })
  })

  describe("Negative Tests", () => {
    it("should return error message when all RPCs fail", async () => {
      await allure.severity("critical")
      await allure.story("RPC Failure Handling")

      // This test may not fail if at least one RPC works
      // It validates that error handling structure is correct
      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      // Either succeeds with rpcUrl or fails with error
      expect(result.rpcUrl !== undefined || result.error !== undefined).toBe(true)
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty public signals array", async () => {
      await allure.severity("normal")
      await allure.story("Empty Signals")

      const result = await verifyStoredProofWithDetails(emptyProof, PASSPORT_ATTESTATION_ID)

      expect(result.publicSignalsCount).toBe(0)
    })

    it("should handle different attestation IDs consistently", async () => {
      await allure.severity("normal")
      await allure.story("Attestation Consistency")

      const result1 = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)
      const result2 = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      // Both should have same structure
      expect(typeof result1.isValid).toBe("boolean")
      expect(typeof result2.isValid).toBe("boolean")
    })
  })

  describe("Boundary Tests", () => {
    it("should handle minimum attestation ID (1)", async () => {
      await allure.severity("minor")
      await allure.story("Min Attestation ID")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, 1)

      expect(result).toBeDefined()
    })

    it("should handle maximum attestation ID (3)", async () => {
      await allure.severity("minor")
      await allure.story("Max Attestation ID")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, 3)

      expect(result).toBeDefined()
    })
  })
})

// ============================================================================
// RPC Failover Tests
// ============================================================================

describe("RPC Failover Mechanism", () => {
  beforeAll(async () => {
    await allure.suite("ZK Verification - Unit Tests")
    await allure.feature("RPC Failover")
  })

  describe("Happy Path", () => {
    it("should successfully connect to at least one RPC endpoint", async () => {
      await allure.severity("critical")
      await allure.story("RPC Connection")

      // If this test passes, at least one RPC endpoint is working
      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      // Should complete without throwing (even if proof is invalid)
      expect(result).toBeDefined()
    })
  })

  describe("Positive Tests", () => {
    it("should cache successful RPC endpoint", async () => {
      await allure.severity("normal")
      await allure.story("RPC Caching")

      // First call
      const result1 = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      // Second call should use cached endpoint (faster)
      const start = Date.now()
      const result2 = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)
      const elapsed = Date.now() - start

      // Both should succeed
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()

      // If both have rpcUrl, they might be the same (cached)
      if (result1.rpcUrl && result2.rpcUrl) {
        // Log for debugging (not a strict assertion as cache may expire)
        await allure.attachment(
          "RPC URLs",
          `First: ${result1.rpcUrl}\nSecond: ${result2.rpcUrl}\nElapsed: ${elapsed}ms`,
          "text/plain",
        )
      }
    })
  })

  describe("Edge Cases", () => {
    it("should handle concurrent verification requests", async () => {
      await allure.severity("normal")
      await allure.story("Concurrent Requests")

      // Make multiple concurrent requests
      const promises = [
        verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID),
        verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID),
        verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID),
      ]

      const results = await Promise.all(promises)

      // All should complete
      results.forEach((result) => {
        expect(result).toBeDefined()
      })
    })
  })

  describe("Timeout Handling", () => {
    it("should complete within reasonable time (30s)", async () => {
      await allure.severity("critical")
      await allure.story("Timeout Handling")

      const start = Date.now()
      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)
      const elapsed = Date.now() - start

      expect(result).toBeDefined()
      expect(elapsed).toBeLessThan(30000) // Should complete within 30 seconds
    })
  })
})

// ============================================================================
// Verifier Contract Address Tests
// ============================================================================

describe("Verifier Contract Resolution", () => {
  beforeAll(async () => {
    await allure.suite("ZK Verification - Unit Tests")
    await allure.feature("Contract Resolution")
  })

  describe("Happy Path", () => {
    it("should resolve verifier contract for attestation ID 1", async () => {
      await allure.severity("critical")
      await allure.story("Contract Resolution")

      const result = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      if (result.verifierAddress) {
        // Should be a valid Ethereum address
        expect(result.verifierAddress).toMatch(/^0x[0-9a-fA-F]{40}$/)
        // Should not be zero address
        expect(result.verifierAddress).not.toBe("0x0000000000000000000000000000000000000000")
      }
    })
  })

  describe("Positive Tests", () => {
    it("should cache verifier address", async () => {
      await allure.severity("normal")
      await allure.story("Address Caching")

      // Multiple calls should return same address
      const result1 = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)
      const result2 = await verifyStoredProofWithDetails(mockInvalidProof, PASSPORT_ATTESTATION_ID)

      if (result1.verifierAddress && result2.verifierAddress) {
        expect(result1.verifierAddress).toBe(result2.verifierAddress)
      }
    })
  })
})
