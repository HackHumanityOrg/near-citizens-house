import { SelfBackendVerifier, type VerificationConfig } from "@selfxyz/core"
import { SELF_CONFIG, SELF_VERIFICATION_CONFIG } from "./config"

// ==============================================================================
// E2E TESTING: MOCK VERIFIER
// ==============================================================================
// When SKIP_ZK_VERIFICATION=true, skip Self.xyz ZK proof verification.
// This allows E2E tests to test the full flow including NEAR signature
// verification and contract storage, without requiring real passport data.
// ==============================================================================

const SKIP_ZK_VERIFICATION = process.env.SKIP_ZK_VERIFICATION === "true"
const E2E_TESTING = process.env.E2E_TESTING === "true"

// Safety check: Never allow mock mode in production (unless explicitly running E2E tests)
if (SKIP_ZK_VERIFICATION && process.env.NODE_ENV === "production" && !E2E_TESTING) {
  throw new Error("CRITICAL: SKIP_ZK_VERIFICATION cannot be enabled in production")
}

if (SKIP_ZK_VERIFICATION) {
  console.warn("[Self Verifier] ⚠️  SKIP_ZK_VERIFICATION is enabled - ZK proofs will NOT be verified")
}

/**
 * Mock verifier for E2E testing.
 * Returns a valid-looking response without actually verifying ZK proofs.
 * NEAR signature verification still happens in the route handler.
 */
class MockSelfBackendVerifier {
  async verify(_attestationId: number, _proof: unknown, _publicSignals: string[], userContextData: string) {
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
      isValid: true,
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
        isOfacValid: false, // false = NOT on OFAC list (good)
      },
    }
  }
}

export class InMemoryConfigStore {
  private config: VerificationConfig

  constructor(config: VerificationConfig) {
    this.config = config
  }

  async getConfig(_configId: string) {
    return this.config
  }

  async setConfig(_configId: string, config: VerificationConfig) {
    this.config = config
    return true
  }

  async getActionId(_userIdentifier: string, _userDefinedData?: string) {
    return "default"
  }
}

// Attestation types: 1=Passport, 2=Biometric ID Card, 3=Aadhaar
const AllowedAttestationIds = new Map<1 | 2 | 3, boolean>([
  [1, true], // Passport
  [2, true], // Biometric ID Card
  [3, true], // Aadhaar
])

let selfBackendVerifier: SelfBackendVerifier | MockSelfBackendVerifier | null = null

export function getVerifier(): SelfBackendVerifier | MockSelfBackendVerifier {
  if (!selfBackendVerifier) {
    if (SKIP_ZK_VERIFICATION) {
      // Use mock verifier for E2E testing
      selfBackendVerifier = new MockSelfBackendVerifier()
    } else {
      // Use real Self.xyz verifier
      selfBackendVerifier = new SelfBackendVerifier(
        SELF_CONFIG.scope,
        SELF_CONFIG.endpoint,
        SELF_CONFIG.useMockPassport,
        AllowedAttestationIds,
        new InMemoryConfigStore(SELF_VERIFICATION_CONFIG),
        "uuid",
      )
    }
  }
  return selfBackendVerifier
}
