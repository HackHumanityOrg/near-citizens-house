// Single source of truth for Self.xyz disclosure configuration
// Frontend and backend configs MUST match for verification to succeed
// Note: excludedCountries uses ISO 3166-1 alpha-3 codes (e.g., "USA", "IRN")
const DISCLOSURE_CONFIG = {
  minimumAge: 18,
  excludedCountries: [] as const, // Empty array - add country codes like "USA", "IRN" if needed
  ofac: false,
}

export const SELF_CONFIG = {
  appName: "NEAR Self Verify",
  scope: "near-self-verify",
  get endpoint() {
    if (process.env.NEXT_PUBLIC_SELF_ENDPOINT) {
      return process.env.NEXT_PUBLIC_SELF_ENDPOINT
    }
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api/verify`
    }
    throw new Error("NEXT_PUBLIC_SELF_ENDPOINT must be set for server-side rendering")
  },
  endpointType: "https" as const,
  logoBase64: "/self-logo.png",
  disclosures: {
    minimumAge: DISCLOSURE_CONFIG.minimumAge,
    ofac: DISCLOSURE_CONFIG.ofac,
  },
  backendConfig: DISCLOSURE_CONFIG,
}

export const NEAR_CONFIG = {
  networkId: (process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet") as "testnet" | "mainnet",
  contractName: process.env.NEAR_CONTRACT_ID || "",
  rpcUrl: process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://near-testnet.drpc.org",
}

export const CONSTANTS = {
  SIGNING_MESSAGE: "Identify myself",
}

export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: "Wallet not connected",
  SIGNING_NOT_SUPPORTED:
    "This wallet does not support message signing. Please use Meteor Wallet or another compatible wallet.",
  SIGNING_FAILED: "Failed to sign message",
  VERIFICATION_FAILED: "Verification failed. Please try again.",
  MISSING_FIELDS: "Missing required fields: proof, publicSignals, attestationId, and userContextData are required",
  NULLIFIER_MISSING: "Nullifier missing from proof - verification incomplete",
  DUPLICATE_PASSPORT: "This passport has already been registered. Each passport can only be used once.",
  NEAR_SIGNATURE_INVALID: "NEAR signature verification failed",
  NEAR_SIGNATURE_MISSING: "Invalid or missing NEAR signature data in proof",
}
