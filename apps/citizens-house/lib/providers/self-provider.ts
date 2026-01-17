import { DefaultConfigStore, SelfBackendVerifier } from "@selfxyz/core"
import { Buffer } from "buffer"
import { SELF_CONFIG, SELF_VERIFICATION_CONFIG } from "../config"
import { shouldSkipZkVerification, isE2ETesting } from "../schemas/env"
import type { AttestationId } from "../schemas/selfxyz"

// ==============================================================================
// E2E TESTING: MOCK VERIFIER
// ==============================================================================
// When SKIP_ZK_VERIFICATION=true, skip Self.xyz ZK proof verification.
// This allows E2E tests to test the full flow including NEAR signature
// verification and contract storage, without requiring real passport data.
// ==============================================================================

const USE_MOCK_VERIFIER = shouldSkipZkVerification() || isE2ETesting()

// Safety check: Never allow mock mode in production (unless explicitly running E2E tests)
if (USE_MOCK_VERIFIER && process.env.NODE_ENV === "production" && !isE2ETesting()) {
  throw new Error("CRITICAL: SKIP_ZK_VERIFICATION cannot be enabled in production")
}

/**
 * Mock verifier for E2E testing.
 * Returns a valid-looking response without actually verifying ZK proofs.
 * NEAR signature verification still happens in the route handler.
 */
class MockSelfBackendVerifier {
  async verify(attestationId: AttestationId, _proof: unknown, _publicSignals: string[], userContextData: string) {
    // Try to extract sessionId from userContextData for proper tracking
    let sessionId = `e2e-session-${Date.now()}`
    try {
      // userContextData is hex-encoded JSON
      const decoded = Buffer.from(userContextData, "hex").toString("utf-8")
      const parsed = JSON.parse(decoded)
      if (parsed.sessionId) {
        sessionId = parsed.sessionId
      }
    } catch {
      // Fallback to generated sessionId if parsing fails
    }

    // Generate unique nullifier to prevent collisions
    const nullifier = `e2e-nullifier-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

    return {
      attestationId,
      userData: {
        userIdentifier: sessionId,
        userDefinedData: userContextData,
      },
      discloseOutput: {
        nullifier,
        nationality: "USA", // Mock nationality
      },
      isValidDetails: {
        isValid: true,
      },
    }
  }
}

// Attestation types: 1=Passport, 2=Biometric ID Card (National ID), 3=Aadhaar
const AllowedAttestationIds = new Map<AttestationId, boolean>([
  [1, true], // Passport
  [2, true], // Biometric ID Card (National ID)
  [3, true], // Aadhaar
])

let selfBackendVerifier: SelfBackendVerifier | MockSelfBackendVerifier | null = null

export function getVerifier(): SelfBackendVerifier | MockSelfBackendVerifier {
  if (!selfBackendVerifier) {
    if (USE_MOCK_VERIFIER) {
      // Use mock verifier for E2E testing
      selfBackendVerifier = new MockSelfBackendVerifier()
    } else {
      // Use real Self.xyz verifier
      selfBackendVerifier = new SelfBackendVerifier(
        SELF_CONFIG.scope,
        SELF_CONFIG.endpoint,
        SELF_CONFIG.useMockPassport,
        AllowedAttestationIds,
        new DefaultConfigStore(SELF_VERIFICATION_CONFIG),
        "uuid",
      )
    }
  }
  return selfBackendVerifier
}
