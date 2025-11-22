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
  logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
  disclosures: {
    minimumAge: 18,
    ofac: false, // Set to true only when using real passports in production
  },
  backendConfig: {
    minimumAge: 18,
    ofac: false, // Set to true only when using real passports in production
  },
}

export const NEAR_CONFIG = {
  networkId: "testnet",
  contractName: "self-verification.testnet",
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
