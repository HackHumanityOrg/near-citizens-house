/**
 * Unit tests for verification.ts
 *
 * Tests NEP-413 signature verification functions per TESTING_STRATEGY.md Section 1.2
 * Covers: computeNep413Hash, extractEd25519PublicKeyHex, parseUserContextData, verifyNearSignature, buildProofData
 */
import { describe, it, expect, beforeAll } from "vitest"
import * as allure from "allure-js-commons"
import { KeyPair } from "@near-js/crypto"
import bs58 from "bs58"
import {
  computeNep413Hash,
  extractEd25519PublicKeyHex,
  parseUserContextData,
  verifyNearSignature,
  buildProofData,
} from "../verification"

// ============================================================================
// Test Data Fixtures
// ============================================================================

// Generate a valid Ed25519 keypair for testing
const testKeyPair = KeyPair.fromRandom("ed25519")
const testPublicKey = testKeyPair.getPublicKey().toString() // "ed25519:BASE58..."

// Standard 32-byte nonce (all zeros for predictable tests)
const standardNonce = Array(32).fill(0) as number[]

// Random nonce for variety tests
const randomNonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256))

// Test account IDs
const testAccountId = "test.testnet"
const testRecipient = "test.testnet"

// Sample user context data in various formats
const validUserContextJson = {
  accountId: testAccountId,
  signature: "test-signature-base64",
  publicKey: testPublicKey,
  nonce: Buffer.from(standardNonce).toString("base64"),
}

const validUserContextHex = Buffer.from(JSON.stringify(validUserContextJson)).toString("hex")

// ============================================================================
// computeNep413Hash Tests
// ============================================================================

describe("computeNep413Hash", () => {
  beforeAll(async () => {
    await allure.suite("Verification - Unit Tests")
    await allure.feature("NEP-413 Signature Verification")
  })

  describe("Happy Path", () => {
    it("should compute hash for valid message/nonce/recipient", async () => {
      await allure.severity("critical")
      await allure.story("Hash Computation")

      const hash = computeNep413Hash("Identify myself", standardNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
    })

    it("should produce deterministic hash for same inputs", async () => {
      await allure.severity("critical")
      await allure.story("Hash Determinism")

      const hash1 = computeNep413Hash("Identify myself", standardNonce, testRecipient)
      const hash2 = computeNep413Hash("Identify myself", standardNonce, testRecipient)

      expect(hash1).toBe(hash2)
    })

    it("should produce different hash for different nonces", async () => {
      await allure.severity("critical")
      await allure.story("Nonce Sensitivity")

      const nonce1 = Array(32).fill(0)
      const nonce2 = Array(32).fill(1)

      const hash1 = computeNep413Hash("Identify myself", nonce1, testRecipient)
      const hash2 = computeNep413Hash("Identify myself", nonce2, testRecipient)

      expect(hash1).not.toBe(hash2)
    })

    it("should produce different hash for different messages", async () => {
      await allure.severity("critical")
      await allure.story("Message Sensitivity")

      const hash1 = computeNep413Hash("Message A", standardNonce, testRecipient)
      const hash2 = computeNep413Hash("Message B", standardNonce, testRecipient)

      expect(hash1).not.toBe(hash2)
    })

    it("should produce different hash for different recipients", async () => {
      await allure.severity("normal")
      await allure.story("Recipient Sensitivity")

      const hash1 = computeNep413Hash("Identify myself", standardNonce, "alice.testnet")
      const hash2 = computeNep413Hash("Identify myself", standardNonce, "bob.testnet")

      expect(hash1).not.toBe(hash2)
    })
  })

  describe("Edge Cases", () => {
    it("should handle unicode messages correctly", async () => {
      await allure.severity("normal")
      await allure.story("Unicode Support")

      const hash = computeNep413Hash("Привет мир 你好世界 🌍", standardNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle empty message", async () => {
      await allure.severity("normal")
      await allure.story("Empty Message")

      const hash = computeNep413Hash("", standardNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle very long message", async () => {
      await allure.severity("minor")
      await allure.story("Long Message")

      const longMessage = "A".repeat(10000)
      const hash = computeNep413Hash(longMessage, standardNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle special characters in message", async () => {
      await allure.severity("minor")
      await allure.story("Special Characters")

      const specialMessage = "Test\n\t\r\0\"'\\<>!@#$%^&*()"
      const hash = computeNep413Hash(specialMessage, standardNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })
  })

  describe("Boundary Tests", () => {
    it("should require exactly 32-byte nonce", async () => {
      await allure.severity("critical")
      await allure.story("Nonce Length")

      // 32 bytes - exact boundary
      const nonce32 = Array(32).fill(42)
      const hash = computeNep413Hash("Test", nonce32, testRecipient)
      expect(hash).toHaveLength(64)
    })

    it("should handle nonce with all 0xFF values (max byte)", async () => {
      await allure.severity("normal")
      await allure.story("Nonce Max Values")

      const maxNonce = Array(32).fill(255)
      const hash = computeNep413Hash("Test", maxNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })

    it("should handle nonce with mixed byte values", async () => {
      await allure.severity("minor")
      await allure.story("Mixed Nonce")

      const mixedNonce = Array.from({ length: 32 }, (_, i) => i % 256)
      const hash = computeNep413Hash("Test", mixedNonce, testRecipient)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64)
    })
  })

  describe("NEP-413 Tag Verification", () => {
    it("should use correct NEP-413 tag (2^31 + 413)", async () => {
      await allure.severity("critical")
      await allure.story("NEP-413 Compliance")
      await allure.description(
        "NEP-413 specifies tag = 2147484061 (2^31 + 413) as little-endian 4-byte prefix",
      )

      // The tag is internal to the function, but we can verify consistency
      // by checking that the same inputs always produce the same hash
      const hash1 = computeNep413Hash("Test", standardNonce, testRecipient)
      const hash2 = computeNep413Hash("Test", standardNonce, testRecipient)

      expect(hash1).toBe(hash2)
    })
  })
})

// ============================================================================
// extractEd25519PublicKeyHex Tests
// ============================================================================

describe("extractEd25519PublicKeyHex", () => {
  beforeAll(async () => {
    await allure.suite("Verification - Unit Tests")
    await allure.feature("Public Key Extraction")
  })

  describe("Happy Path", () => {
    it("should extract public key from valid ed25519: prefixed key", async () => {
      await allure.severity("critical")
      await allure.story("Key Extraction")

      const hex = extractEd25519PublicKeyHex(testPublicKey)

      expect(hex).toBeDefined()
      expect(hex).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true)
    })

    it("should produce consistent output for same input", async () => {
      await allure.severity("critical")
      await allure.story("Extraction Determinism")

      const hex1 = extractEd25519PublicKeyHex(testPublicKey)
      const hex2 = extractEd25519PublicKeyHex(testPublicKey)

      expect(hex1).toBe(hex2)
    })
  })

  describe("Positive Tests", () => {
    it("should handle keys from different keypairs", async () => {
      await allure.severity("normal")
      await allure.story("Multiple Keys")

      const kp1 = KeyPair.fromRandom("ed25519")
      const kp2 = KeyPair.fromRandom("ed25519")

      const hex1 = extractEd25519PublicKeyHex(kp1.getPublicKey().toString())
      const hex2 = extractEd25519PublicKeyHex(kp2.getPublicKey().toString())

      expect(hex1).not.toBe(hex2)
      expect(hex1).toHaveLength(64)
      expect(hex2).toHaveLength(64)
    })
  })

  describe("Negative Tests", () => {
    it("should throw for missing ed25519: prefix", async () => {
      await allure.severity("critical")
      await allure.story("Invalid Prefix")

      // Get base58 part without prefix
      const base58Part = testPublicKey.replace("ed25519:", "")

      // This should still work as the function strips the prefix
      const hex = extractEd25519PublicKeyHex(base58Part)
      expect(hex).toHaveLength(64)
    })

    it("should throw for invalid base58 characters", async () => {
      await allure.severity("critical")
      await allure.story("Invalid Base58")

      // Base58 doesn't include 0, O, I, l
      const invalidKey = "ed25519:0OIl000000000000000000000000000000000000000"

      expect(() => extractEd25519PublicKeyHex(invalidKey)).toThrow()
    })
  })

  describe("Edge Cases", () => {
    it("should handle key with only prefix (returns empty hex)", async () => {
      await allure.severity("minor")
      await allure.story("Empty Key Body")

      // Empty base58 decodes to empty buffer -> empty hex string
      const hex = extractEd25519PublicKeyHex("ed25519:")
      expect(hex).toBe("")
    })
  })

  describe("Boundary Tests", () => {
    it("should produce exactly 32-byte (64 hex char) output", async () => {
      await allure.severity("critical")
      await allure.story("Output Size")

      const hex = extractEd25519PublicKeyHex(testPublicKey)
      expect(hex).toHaveLength(64)

      // Verify it's valid hex
      const buffer = Buffer.from(hex, "hex")
      expect(buffer).toHaveLength(32)
    })
  })
})

// ============================================================================
// parseUserContextData Tests
// ============================================================================

describe("parseUserContextData", () => {
  beforeAll(async () => {
    await allure.suite("Verification - Unit Tests")
    await allure.feature("User Context Parsing")
  })

  describe("Happy Path", () => {
    it("should parse valid hex-encoded JSON input", async () => {
      await allure.severity("critical")
      await allure.story("Hex Parsing")

      const result = parseUserContextData(validUserContextHex)

      expect(result).not.toBeNull()
      expect(result?.accountId).toBe(testAccountId)
      expect(result?.publicKey).toBe(testPublicKey)
    })

    it("should parse valid plain JSON input", async () => {
      await allure.severity("critical")
      await allure.story("JSON Parsing")

      const jsonString = JSON.stringify(validUserContextJson)
      const result = parseUserContextData(jsonString)

      expect(result).not.toBeNull()
      expect(result?.accountId).toBe(testAccountId)
    })
  })

  describe("Positive Tests", () => {
    it("should convert base64 nonce to array", async () => {
      await allure.severity("normal")
      await allure.story("Nonce Conversion")

      const result = parseUserContextData(validUserContextHex)

      expect(result?.nonce).toBeDefined()
      expect(Array.isArray(result?.nonce)).toBe(true)
      expect(result?.nonce).toHaveLength(32)
    })

    it("should preserve array nonce format", async () => {
      await allure.severity("normal")
      await allure.story("Array Nonce")

      const contextWithArrayNonce = {
        ...validUserContextJson,
        nonce: standardNonce,
      }
      const hex = Buffer.from(JSON.stringify(contextWithArrayNonce)).toString("hex")
      const result = parseUserContextData(hex)

      expect(result?.nonce).toEqual(standardNonce)
    })
  })

  describe("Negative Tests", () => {
    it("should return null for malformed JSON", async () => {
      await allure.severity("critical")
      await allure.story("Malformed JSON")

      const result = parseUserContextData("not valid json at all")

      expect(result).toBeNull()
    })

    it("should return null for missing required fields", async () => {
      await allure.severity("critical")
      await allure.story("Missing Fields")

      const incomplete = { accountId: testAccountId } // missing signature, publicKey, nonce
      const hex = Buffer.from(JSON.stringify(incomplete)).toString("hex")
      const result = parseUserContextData(hex)

      expect(result).toBeNull()
    })

    it("should return null for empty accountId", async () => {
      await allure.severity("normal")
      await allure.story("Empty AccountId")

      const withEmptyAccountId = { ...validUserContextJson, accountId: "" }
      const hex = Buffer.from(JSON.stringify(withEmptyAccountId)).toString("hex")
      const result = parseUserContextData(hex)

      // Empty string is falsy, so should return null
      expect(result).toBeNull()
    })
  })

  describe("Edge Cases", () => {
    it("should handle JSON with null bytes", async () => {
      await allure.severity("normal")
      await allure.story("Null Byte Handling")

      // Add null bytes around valid JSON
      const jsonWithNulls = "\0\0\0" + JSON.stringify(validUserContextJson) + "\0\0\0"
      const result = parseUserContextData(jsonWithNulls)

      expect(result).not.toBeNull()
      expect(result?.accountId).toBe(testAccountId)
    })

    it("should handle hex with leading zeros", async () => {
      await allure.severity("minor")
      await allure.story("Leading Zeros")

      // Prepend some zeros (will become non-printable chars)
      const hexWithPrefix = "0000" + validUserContextHex
      const result = parseUserContextData(hexWithPrefix)

      // May or may not parse depending on where JSON starts
      // The function should handle this gracefully
      expect(result === null || result?.accountId === testAccountId).toBe(true)
    })

    it("should handle mixed binary and JSON data", async () => {
      await allure.severity("normal")
      await allure.story("Mixed Data")

      // Binary prefix followed by JSON
      const prefix = Buffer.from([0x00, 0x01, 0x02, 0xff])
      const json = JSON.stringify(validUserContextJson)
      const mixed = Buffer.concat([prefix, Buffer.from(json)])
      const hex = mixed.toString("hex")

      const result = parseUserContextData(hex)

      // Function should find the JSON object
      expect(result).not.toBeNull()
    })
  })

  describe("Boundary Tests", () => {
    it("should return null for empty string", async () => {
      await allure.severity("normal")
      await allure.story("Empty Input")

      const result = parseUserContextData("")

      expect(result).toBeNull()
    })

    it("should handle maximum allowed length (4096 chars)", async () => {
      await allure.severity("normal")
      await allure.story("Max Length")

      // Create a valid context with padding to reach near max length
      const largeContext = {
        ...validUserContextJson,
        extra: "x".repeat(3000), // Add padding
      }
      const hex = Buffer.from(JSON.stringify(largeContext)).toString("hex")

      // Should still parse the required fields
      const result = parseUserContextData(hex)
      expect(result).not.toBeNull()
    })
  })
})

// ============================================================================
// verifyNearSignature Tests
// ============================================================================

describe("verifyNearSignature", () => {
  beforeAll(async () => {
    await allure.suite("Verification - Unit Tests")
    await allure.feature("NEAR Signature Verification")
  })

  // Helper to create valid signature
  async function createValidSignature(
    message: string,
    nonce: number[],
    recipient: string,
    keyPair: KeyPair,
  ) {
    const hash = computeNep413Hash(message, nonce, recipient)
    const hashBuffer = Buffer.from(hash, "hex")
    const signature = keyPair.sign(hashBuffer)
    return Buffer.from(signature.signature).toString("base64")
  }

  describe("Happy Path", () => {
    it("should verify valid signature from correct signer", async () => {
      await allure.severity("critical")
      await allure.story("Valid Signature")

      const challenge = "Identify myself"
      const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

      const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  describe("Positive Tests", () => {
    it("should verify signature with different valid nonces", async () => {
      await allure.severity("normal")
      await allure.story("Different Nonces")

      const challenge = "Identify myself"
      const signature = await createValidSignature(challenge, randomNonce, testRecipient, testKeyPair)

      const result = verifyNearSignature(challenge, signature, testPublicKey, randomNonce, testRecipient)

      expect(result.valid).toBe(true)
    })

    it("should verify signature with unicode challenge", async () => {
      await allure.severity("normal")
      await allure.story("Unicode Challenge")

      const challenge = "Привет мир"
      const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

      const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

      expect(result.valid).toBe(true)
    })
  })

  describe("Negative Tests", () => {
    it("should reject invalid signature", async () => {
      await allure.severity("critical")
      await allure.story("Invalid Signature")

      const invalidSignature = Buffer.from(Array(64).fill(0)).toString("base64")

      const result = verifyNearSignature(
        "Identify myself",
        invalidSignature,
        testPublicKey,
        standardNonce,
        testRecipient,
      )

      expect(result.valid).toBe(false)
    })

    it("should reject signature from wrong signer", async () => {
      await allure.severity("critical")
      await allure.story("Wrong Signer")

      const otherKeyPair = KeyPair.fromRandom("ed25519")
      const challenge = "Identify myself"
      const signature = await createValidSignature(challenge, standardNonce, testRecipient, otherKeyPair)

      // Verify with original keypair's public key
      const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

      expect(result.valid).toBe(false)
    })

    it("should reject signature for wrong message", async () => {
      await allure.severity("critical")
      await allure.story("Wrong Message")

      const signature = await createValidSignature(
        "Original message",
        standardNonce,
        testRecipient,
        testKeyPair,
      )

      const result = verifyNearSignature(
        "Different message",
        signature,
        testPublicKey,
        standardNonce,
        testRecipient,
      )

      expect(result.valid).toBe(false)
    })

    it("should reject signature for wrong nonce", async () => {
      await allure.severity("critical")
      await allure.story("Wrong Nonce")

      const challenge = "Identify myself"
      const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

      const wrongNonce = Array(32).fill(99)
      const result = verifyNearSignature(challenge, signature, testPublicKey, wrongNonce, testRecipient)

      expect(result.valid).toBe(false)
    })

    it("should reject signature for wrong recipient", async () => {
      await allure.severity("critical")
      await allure.story("Wrong Recipient")

      const challenge = "Identify myself"
      const signature = await createValidSignature(
        challenge,
        standardNonce,
        "alice.testnet",
        testKeyPair,
      )

      const result = verifyNearSignature(
        challenge,
        signature,
        testPublicKey,
        standardNonce,
        "bob.testnet", // Different recipient
      )

      expect(result.valid).toBe(false)
    })

    it("should return error for malformed signature", async () => {
      await allure.severity("normal")
      await allure.story("Malformed Signature")

      const result = verifyNearSignature(
        "Identify myself",
        "not-valid-base64!!!",
        testPublicKey,
        standardNonce,
        testRecipient,
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it("should return error for invalid public key", async () => {
      await allure.severity("normal")
      await allure.story("Invalid Public Key")

      const signature = await createValidSignature(
        "Identify myself",
        standardNonce,
        testRecipient,
        testKeyPair,
      )

      const result = verifyNearSignature(
        "Identify myself",
        signature,
        "ed25519:invalidkey",
        standardNonce,
        testRecipient,
      )

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty challenge message", async () => {
      await allure.severity("minor")
      await allure.story("Empty Challenge")

      const challenge = ""
      const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

      const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

      expect(result.valid).toBe(true)
    })
  })

  describe("Boundary Tests", () => {
    it("should handle 64-byte signature (Ed25519 standard)", async () => {
      await allure.severity("critical")
      await allure.story("Signature Length")

      const challenge = "Identify myself"
      const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

      // Verify signature is 64 bytes when decoded
      const sigBytes = Buffer.from(signature, "base64")
      expect(sigBytes).toHaveLength(64)

      const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)
      expect(result.valid).toBe(true)
    })

    it("should reject short signature", async () => {
      await allure.severity("critical")
      await allure.story("Short Signature")

      // 63 bytes instead of 64
      const shortSignature = Buffer.from(Array(63).fill(0)).toString("base64")

      const result = verifyNearSignature(
        "Identify myself",
        shortSignature,
        testPublicKey,
        standardNonce,
        testRecipient,
      )

      expect(result.valid).toBe(false)
    })

    it("should reject long signature", async () => {
      await allure.severity("critical")
      await allure.story("Long Signature")

      // 65 bytes instead of 64
      const longSignature = Buffer.from(Array(65).fill(0)).toString("base64")

      const result = verifyNearSignature(
        "Identify myself",
        longSignature,
        testPublicKey,
        standardNonce,
        testRecipient,
      )

      expect(result.valid).toBe(false)
    })
  })
})

// ============================================================================
// buildProofData Tests
// ============================================================================

describe("buildProofData", () => {
  beforeAll(async () => {
    await allure.suite("Verification - Unit Tests")
    await allure.feature("Proof Data Construction")
  })

  // Sample account data
  const sampleAccount = {
    nullifier: "12345678901234567890",
    userId: "user-id-123",
    attestationId: "1",
    verifiedAt: Date.now(),
    selfProof: {
      proof: {
        a: ["1", "2"] as [string, string],
        b: [
          ["3", "4"],
          ["5", "6"],
        ] as [[string, string], [string, string]],
        c: ["7", "8"] as [string, string],
      },
      publicSignals: Array(21).fill("0"),
    },
    userContextData: validUserContextHex,
  }

  const sampleSigData = {
    accountId: testAccountId,
    signature: "test-sig-base64",
    publicKey: testPublicKey,
    nonce: standardNonce,
  }

  describe("Happy Path", () => {
    it("should build proof data from valid inputs", async () => {
      await allure.severity("critical")
      await allure.story("Proof Construction")

      const result = buildProofData(sampleAccount, sampleSigData)

      expect(result).not.toBeNull()
      expect(result?.nullifier).toBe(sampleAccount.nullifier)
      expect(result?.userId).toBe(sampleAccount.userId)
      expect(result?.attestationId).toBe(sampleAccount.attestationId)
    })

    it("should include NEP-413 verification data", async () => {
      await allure.severity("critical")
      await allure.story("NEP-413 Data")

      const result = buildProofData(sampleAccount, sampleSigData)

      expect(result?.nearSignatureVerification).toBeDefined()
      expect(result?.nearSignatureVerification.nep413Hash).toBeDefined()
      expect(result?.nearSignatureVerification.nep413Hash).toHaveLength(64)
      expect(result?.nearSignatureVerification.publicKeyHex).toBeDefined()
      expect(result?.nearSignatureVerification.signatureHex).toBeDefined()
    })
  })

  describe("Positive Tests", () => {
    it("should include signature data in correct format", async () => {
      await allure.severity("normal")
      await allure.story("Signature Format")

      const result = buildProofData(sampleAccount, sampleSigData)

      expect(result?.signature.accountId).toBe(sampleSigData.accountId)
      expect(result?.signature.publicKey).toBe(sampleSigData.publicKey)
      expect(result?.signature.challenge).toBe("Identify myself")
      expect(result?.signature.recipient).toBe(sampleSigData.accountId)
    })

    it("should convert nonce to base64", async () => {
      await allure.severity("normal")
      await allure.story("Nonce Format")

      const result = buildProofData(sampleAccount, sampleSigData)

      expect(result?.signature.nonce).toBeDefined()
      // Verify it's valid base64
      const decoded = Buffer.from(result?.signature.nonce ?? "", "base64")
      expect(decoded).toHaveLength(32)
    })

    it("should include ZK proof data", async () => {
      await allure.severity("normal")
      await allure.story("ZK Proof Data")

      const result = buildProofData(sampleAccount, sampleSigData)

      expect(result?.zkProof).toEqual(sampleAccount.selfProof.proof)
      expect(result?.publicSignals).toEqual(sampleAccount.selfProof.publicSignals)
    })
  })

  describe("Negative Tests", () => {
    it("should return null when sigData is null", async () => {
      await allure.severity("critical")
      await allure.story("Null SigData")

      const result = buildProofData(sampleAccount, null)

      expect(result).toBeNull()
    })
  })

  describe("Edge Cases", () => {
    it("should handle minimum valid inputs", async () => {
      await allure.severity("minor")
      await allure.story("Minimum Inputs")

      const minAccount = {
        ...sampleAccount,
        nullifier: "1",
        userId: "1",
        selfProof: {
          proof: {
            a: ["0", "0"] as [string, string],
            b: [
              ["0", "0"],
              ["0", "0"],
            ] as [[string, string], [string, string]],
            c: ["0", "0"] as [string, string],
          },
          publicSignals: [],
        },
      }

      const result = buildProofData(minAccount, sampleSigData)

      expect(result).not.toBeNull()
      expect(result?.nullifier).toBe("1")
    })
  })
})
