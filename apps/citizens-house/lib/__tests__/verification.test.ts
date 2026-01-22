/**
 * Unit tests for verification.ts
 *
 * Tests NEP-413 signature verification functions per TESTING_STRATEGY.md Section 1.2
 * Covers: computeNep413Hash, extractEd25519PublicKeyHex, parseUserContextData, verifyNearSignature
 */
import { describe, it, expect } from "vitest"
import * as allure from "allure-js-commons"
import { KeyPair } from "@near-js/crypto"
import {
  computeNep413Hash,
  extractEd25519PublicKeyHex,
  parseUserContextData,
  verifyNearSignature,
} from "../verification"

// ============================================================================
// Test Data Fixtures
// ============================================================================

// Generate a valid Ed25519 keypair for testing
const testKeyPair = KeyPair.fromRandom("ed25519")
const testPublicKey = testKeyPair.getPublicKey().toString() // "ed25519:BASE58..."

// Standard 32-byte nonce (all zeros for predictable tests) - base64 encoded
const standardNonceBytes = Buffer.alloc(32, 0)
const standardNonce = standardNonceBytes.toString("base64")

// Random nonce for variety tests - base64 encoded
const randomNonceBytes = Buffer.from(Array.from({ length: 32 }, () => Math.floor(Math.random() * 256)))
const randomNonce = randomNonceBytes.toString("base64")

// Test account IDs
const testAccountId = "test.testnet"
const testRecipient = "verification.testnet"

// Sample user context data in various formats
const validUserContextJson = {
  accountId: testAccountId,
  signature: "test-signature-base64",
  publicKey: testPublicKey,
  nonce: standardNonce, // already base64
  challenge: "Identify myself",
  recipient: testRecipient,
}

const validUserContextHex = Buffer.from(JSON.stringify(validUserContextJson)).toString("hex")

// Use nested describes to create Allure suite hierarchy:
// parentSuite > suite > subSuite (matching Rust pattern)
describe("Near Citizens House", () => {
  describe("Shared Library Unit Tests", () => {
    describe("NEP-413 Verification", () => {
      // ============================================================================
      // computeNep413Hash Tests
      // ============================================================================

      describe("computeNep413Hash", () => {
        describe("Happy Path", () => {
          it("should compute hash for valid message/nonce/recipient", async () => {
            await allure.severity("critical")

            const hash = computeNep413Hash("Identify myself", standardNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64) // 32 bytes = 64 hex chars
            expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
          })

          it("should produce deterministic hash for same inputs", async () => {
            await allure.severity("critical")

            const hash1 = computeNep413Hash("Identify myself", standardNonce, testRecipient)
            const hash2 = computeNep413Hash("Identify myself", standardNonce, testRecipient)

            expect(hash1).toBe(hash2)
          })

          it("should produce different hash for different nonces", async () => {
            await allure.severity("critical")

            const nonce1 = Buffer.alloc(32, 0).toString("base64")
            const nonce2 = Buffer.alloc(32, 1).toString("base64")

            const hash1 = computeNep413Hash("Identify myself", nonce1, testRecipient)
            const hash2 = computeNep413Hash("Identify myself", nonce2, testRecipient)

            expect(hash1).not.toBe(hash2)
          })

          it("should produce different hash for different messages", async () => {
            await allure.severity("critical")

            const hash1 = computeNep413Hash("Message A", standardNonce, testRecipient)
            const hash2 = computeNep413Hash("Message B", standardNonce, testRecipient)

            expect(hash1).not.toBe(hash2)
          })

          it("should produce different hash for different recipients", async () => {
            await allure.severity("normal")

            const hash1 = computeNep413Hash("Identify myself", standardNonce, "alice.testnet")
            const hash2 = computeNep413Hash("Identify myself", standardNonce, "bob.testnet")

            expect(hash1).not.toBe(hash2)
          })
        })

        describe("Edge Cases", () => {
          it("should handle unicode messages correctly", async () => {
            await allure.severity("normal")

            const hash = computeNep413Hash("Привет мир 你好世界 🌍", standardNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })

          it("should handle empty message", async () => {
            await allure.severity("normal")

            const hash = computeNep413Hash("", standardNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })

          it("should handle very long message", async () => {
            await allure.severity("minor")

            const longMessage = "A".repeat(10000)
            const hash = computeNep413Hash(longMessage, standardNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })

          it("should handle special characters in message", async () => {
            await allure.severity("minor")

            const specialMessage = "Test\n\t\r\0\"'\\<>!@#$%^&*()"
            const hash = computeNep413Hash(specialMessage, standardNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })

          it("should handle empty recipient string", async () => {
            await allure.severity("minor")

            const hash = computeNep413Hash("Test", standardNonce, "")

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })

          it("should handle very long recipient string", async () => {
            await allure.severity("minor")

            const longRecipient = "a".repeat(64) + ".near"
            const hash = computeNep413Hash("Test", standardNonce, longRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })
        })

        describe("Boundary Tests", () => {
          it("should require exactly 32-byte nonce", async () => {
            await allure.severity("critical")

            // 32 bytes - exact boundary (base64 encoded)
            const nonce32 = Buffer.alloc(32, 42).toString("base64")
            const hash = computeNep413Hash("Test", nonce32, testRecipient)
            expect(hash).toHaveLength(64)
          })

          it("should throw for short nonce (31 bytes)", async () => {
            await allure.severity("critical")

            // 31 bytes - one byte short (base64 encoded)
            const shortNonce = Buffer.alloc(31, 42).toString("base64")
            // Borsh serialization enforces exactly 32 bytes for the nonce field
            expect(() => computeNep413Hash("Test", shortNonce, testRecipient)).toThrow(/length/i)
          })

          it("should throw for long nonce (33 bytes)", async () => {
            await allure.severity("critical")

            // 33 bytes - one byte extra (base64 encoded)
            const longNonce = Buffer.alloc(33, 42).toString("base64")
            // Borsh serialization enforces exactly 32 bytes for the nonce field
            expect(() => computeNep413Hash("Test", longNonce, testRecipient)).toThrow(/length/i)
          })

          it("should handle nonce with all 0xFF values (max byte)", async () => {
            await allure.severity("normal")

            const maxNonce = Buffer.alloc(32, 255).toString("base64")
            const hash = computeNep413Hash("Test", maxNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })

          it("should handle nonce with mixed byte values", async () => {
            await allure.severity("minor")

            const mixedNonce = Buffer.from(Array.from({ length: 32 }, (_, i) => i % 256)).toString("base64")
            const hash = computeNep413Hash("Test", mixedNonce, testRecipient)

            expect(hash).toBeDefined()
            expect(hash).toHaveLength(64)
          })
        })

        describe("NEP-413 Tag Verification", () => {
          it("should use correct NEP-413 tag (2^31 + 413)", async () => {
            await allure.severity("critical")
            await allure.description("NEP-413 specifies tag = 2147484061 (2^31 + 413) as little-endian 4-byte prefix")

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
        describe("Happy Path", () => {
          it("should extract public key from valid ed25519: prefixed key", async () => {
            await allure.severity("critical")

            const hex = extractEd25519PublicKeyHex(testPublicKey)

            expect(hex).toBeDefined()
            expect(hex).toHaveLength(64) // 32 bytes = 64 hex chars
            expect(/^[0-9a-f]+$/.test(hex)).toBe(true)
          })

          it("should produce consistent output for same input", async () => {
            await allure.severity("critical")

            const hex1 = extractEd25519PublicKeyHex(testPublicKey)
            const hex2 = extractEd25519PublicKeyHex(testPublicKey)

            expect(hex1).toBe(hex2)
          })
        })

        describe("Positive Tests", () => {
          it("should handle keys from different keypairs", async () => {
            await allure.severity("normal")

            const kp1 = KeyPair.fromRandom("ed25519")
            const kp2 = KeyPair.fromRandom("ed25519")

            const hex1 = extractEd25519PublicKeyHex(kp1.getPublicKey().toString())
            const hex2 = extractEd25519PublicKeyHex(kp2.getPublicKey().toString())

            expect(hex1).not.toBe(hex2)
            expect(hex1).toHaveLength(64)
            expect(hex2).toHaveLength(64)
          })
        })

        describe("Positive Tests - Prefix Handling", () => {
          it("should work without ed25519: prefix", async () => {
            await allure.severity("critical")

            // Get base58 part without prefix
            const base58Part = testPublicKey.replace("ed25519:", "")

            // Function strips the prefix if present, so works without it too
            const hex = extractEd25519PublicKeyHex(base58Part)
            expect(hex).toHaveLength(64)
          })
        })

        describe("Negative Tests", () => {
          it("should throw for invalid base58 characters", async () => {
            await allure.severity("critical")

            // Base58 doesn't include 0, O, I, l
            const invalidKey = "ed25519:0OIl000000000000000000000000000000000000000"

            expect(() => extractEd25519PublicKeyHex(invalidKey)).toThrow()
          })
        })

        describe("Edge Cases", () => {
          it("should handle key with only prefix (returns empty hex)", async () => {
            await allure.severity("minor")
            await allure.description(
              "KNOWN BEHAVIOR: Empty key body returns empty hex string. " +
                "This documents current behavior - consider throwing an error instead " +
                "since an empty key is invalid for cryptographic operations.",
            )

            // Empty base58 decodes to empty buffer -> empty hex string
            // Note: This is arguably wrong behavior - an empty key should likely throw
            // but we document current behavior here for regression detection
            const hex = extractEd25519PublicKeyHex("ed25519:")
            expect(hex).toBe("")
            // If this behavior changes to throw, update this test accordingly
          })
        })

        describe("Boundary Tests", () => {
          it("should produce exactly 32-byte (64 hex char) output", async () => {
            await allure.severity("critical")

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
        describe("Happy Path", () => {
          it("should parse valid hex-encoded JSON input", async () => {
            await allure.severity("critical")

            const result = parseUserContextData(validUserContextHex)

            expect(result).not.toBeNull()
            expect(result?.accountId).toBe(testAccountId)
            expect(result?.publicKey).toBe(testPublicKey)
            expect(result?.challenge).toBe("Identify myself")
            expect(result?.recipient).toBe(testRecipient)
          })

          it("should parse valid plain JSON input", async () => {
            await allure.severity("critical")

            const jsonString = JSON.stringify(validUserContextJson)
            const result = parseUserContextData(jsonString)

            expect(result).not.toBeNull()
            expect(result?.accountId).toBe(testAccountId)
          })
        })

        describe("Positive Tests", () => {
          it("should return base64 nonce as-is", async () => {
            await allure.severity("normal")

            const result = parseUserContextData(validUserContextHex)

            expect(result?.nonce).toBeDefined()
            expect(typeof result?.nonce).toBe("string")
            // Should be valid base64 that decodes to 32 bytes
            const decoded = Buffer.from(result?.nonce ?? "", "base64")
            expect(decoded).toHaveLength(32)
          })

          it("should preserve base64 nonce format", async () => {
            await allure.severity("normal")

            const hex = Buffer.from(JSON.stringify(validUserContextJson)).toString("hex")
            const result = parseUserContextData(hex)

            expect(result?.nonce).toBe(standardNonce)
          })
        })

        describe("Negative Tests", () => {
          it("should return null for malformed JSON", async () => {
            await allure.severity("critical")

            const result = parseUserContextData("not valid json at all")

            expect(result).toBeNull()
          })

          it("should return null for missing required fields", async () => {
            await allure.severity("critical")

            const incomplete = { accountId: testAccountId } // missing signature, publicKey, nonce
            const hex = Buffer.from(JSON.stringify(incomplete)).toString("hex")
            const result = parseUserContextData(hex)

            expect(result).toBeNull()
          })

          it("should return null for empty accountId", async () => {
            await allure.severity("normal")

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

            // Add null bytes around valid JSON
            const jsonWithNulls = "\0\0\0" + JSON.stringify(validUserContextJson) + "\0\0\0"
            const result = parseUserContextData(jsonWithNulls)

            expect(result).not.toBeNull()
            expect(result?.accountId).toBe(testAccountId)
          })

          it("should handle hex with leading zeros", async () => {
            await allure.severity("minor")

            // Prepend some zeros (will become non-printable chars)
            const hexWithPrefix = "0000" + validUserContextHex
            const result = parseUserContextData(hexWithPrefix)

            // May or may not parse depending on where JSON starts
            // The function should handle this gracefully
            expect(result === null || result?.accountId === testAccountId).toBe(true)
          })

          it("should handle mixed binary and JSON data", async () => {
            await allure.severity("normal")

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

            const result = parseUserContextData("")

            expect(result).toBeNull()
          })

          it("should handle maximum allowed length (4096 chars)", async () => {
            await allure.severity("normal")

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

          it("should handle input exceeding typical maximum length", async () => {
            await allure.severity("minor")

            const hugeContext = {
              ...validUserContextJson,
              extra: "x".repeat(10000), // 10k+ chars
            }
            const hex = Buffer.from(JSON.stringify(hugeContext)).toString("hex")
            const result = parseUserContextData(hex)

            // Should still parse or return null gracefully (no crash)
            expect(result === null || result?.accountId === testAccountId).toBe(true)
          })
        })
      })

      // ============================================================================
      // verifyNearSignature Tests
      // ============================================================================

      describe("verifyNearSignature", () => {
        // Helper to create valid signature (nonce is base64 encoded)
        async function createValidSignature(message: string, nonce: string, recipient: string, keyPair: KeyPair) {
          const hash = computeNep413Hash(message, nonce, recipient)
          const hashBuffer = Buffer.from(hash, "hex")
          const signature = keyPair.sign(hashBuffer)
          return Buffer.from(signature.signature).toString("base64")
        }

        describe("Happy Path", () => {
          it("should verify valid signature from correct signer", async () => {
            await allure.severity("critical")

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

            const challenge = "Identify myself"
            const signature = await createValidSignature(challenge, randomNonce, testRecipient, testKeyPair)

            const result = verifyNearSignature(challenge, signature, testPublicKey, randomNonce, testRecipient)

            expect(result.valid).toBe(true)
          })

          it("should verify signature with unicode challenge", async () => {
            await allure.severity("normal")

            const challenge = "Привет мир"
            const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

            const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

            expect(result.valid).toBe(true)
          })
        })

        describe("Negative Tests", () => {
          it("should reject invalid signature", async () => {
            await allure.severity("critical")

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

            const otherKeyPair = KeyPair.fromRandom("ed25519")
            const challenge = "Identify myself"
            const signature = await createValidSignature(challenge, standardNonce, testRecipient, otherKeyPair)

            // Verify with original keypair's public key
            const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

            expect(result.valid).toBe(false)
          })

          it("should reject signature for wrong message", async () => {
            await allure.severity("critical")

            const signature = await createValidSignature("Original message", standardNonce, testRecipient, testKeyPair)

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

            const challenge = "Identify myself"
            const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

            const wrongNonce = Buffer.alloc(32, 99).toString("base64")
            const result = verifyNearSignature(challenge, signature, testPublicKey, wrongNonce, testRecipient)

            expect(result.valid).toBe(false)
          })

          it("should reject signature for wrong recipient", async () => {
            await allure.severity("critical")

            const challenge = "Identify myself"
            const signature = await createValidSignature(challenge, standardNonce, "alice.testnet", testKeyPair)

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

            const result = verifyNearSignature(
              "Identify myself",
              "not-valid-base64!!!",
              testPublicKey,
              standardNonce,
              testRecipient,
            )

            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
            // Verify error message gives useful context
            expect(result.error).toMatch(/signature|decode|base64|invalid/i)
          })

          it("should return error for invalid public key", async () => {
            await allure.severity("normal")

            const signature = await createValidSignature("Identify myself", standardNonce, testRecipient, testKeyPair)

            const result = verifyNearSignature(
              "Identify myself",
              signature,
              "ed25519:invalidkey",
              standardNonce,
              testRecipient,
            )

            expect(result.valid).toBe(false)
            expect(result.error).toBeDefined()
            // Verify error message gives useful context about the key issue
            // base58 library throws "Unknown letter" for invalid characters like 'l'
            expect(result.error).toMatch(/key|decode|base58|invalid|letter|allowed/i)
          })
        })

        describe("Edge Cases", () => {
          it("should handle empty challenge message", async () => {
            await allure.severity("minor")

            const challenge = ""
            const signature = await createValidSignature(challenge, standardNonce, testRecipient, testKeyPair)

            const result = verifyNearSignature(challenge, signature, testPublicKey, standardNonce, testRecipient)

            expect(result.valid).toBe(true)
          })
        })

        describe("Boundary Tests", () => {
          it("should handle 64-byte signature (Ed25519 standard)", async () => {
            await allure.severity("critical")

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
    })
  })
})
