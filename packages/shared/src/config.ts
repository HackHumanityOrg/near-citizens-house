// ==============================================================================
// CENTRALIZED ENVIRONMENT CONFIGURATION
// ==============================================================================
// All environment variables should be accessed through this file.
// Do NOT use process.env directly elsewhere in the codebase.
// ==============================================================================

// NEAR Network Configuration
const networkId = (process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet") as "testnet" | "mainnet"

// Default RPC URLs for FastNear
const defaultRpcUrl = networkId === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com"

export const NEAR_CONFIG = {
  networkId,
  rpcUrl: process.env.NEXT_PUBLIC_NEAR_RPC_URL || defaultRpcUrl,
  // Optional API key for authenticated RPC access (FastNear paid plans)
  rpcApiKey: process.env.NEAR_RPC_API_KEY || "",
  // RPC headers for authenticated requests
  get rpcHeaders(): Record<string, string> {
    if (this.rpcApiKey) {
      return { "x-api-key": this.rpcApiKey }
    }
    return {}
  },
  // Public RPC URLs for frontend wallet transactions (no API key needed)
  // Used by @hot-labs/near-connect for transaction signing with automatic failover
  publicRpcUrls: {
    mainnet: ["https://free.rpc.fastnear.com", "https://near.lava.build:443", "https://rpc.shitzuapes.xyz"],
    testnet: ["https://rpc.testnet.fastnear.com", "https://test.rpc.fastnear.com", "https://near-testnet.drpc.org"],
  },
  // Contract addresses
  verificationContractId: process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT || "",
  governanceContractId: process.env.NEXT_PUBLIC_NEAR_GOVERNANCE_CONTRACT || "",
  bridgeContractId: process.env.NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT || "",
  sputnikDaoContractId: process.env.NEXT_PUBLIC_SPUTNIK_DAO_CONTRACT || "",
  // Backend wallet credentials (server-side only)
  backendAccountId: process.env.NEAR_ACCOUNT_ID || "",
  backendPrivateKey: process.env.NEAR_PRIVATE_KEY || "",
  // Explorer URLs
  get explorerUrl() {
    return this.networkId === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io"
  },
  get explorerAccountUrl() {
    return (accountId: string) => `${this.explorerUrl}/address/${accountId}`
  },
}

// App URLs (for cross-app navigation)
export const APP_URLS = {
  verification: process.env.NEXT_PUBLIC_VERIFICATION_APP_URL || "https://verification.houseofstake.dev",
  citizensHouse: process.env.NEXT_PUBLIC_CITIZENS_HOUSE_APP_URL || "https://citizenshouse.houseofstake.dev",
}

// Self.xyz Configuration
const DISCLOSURE_CONFIG = {
  minimumAge: 18,
  excludedCountries: [] as const,
  ofac: false,
}

export const SELF_CONFIG = {
  appName: "NEAR Citizens House",
  scope: "near-citizens-house",
  get endpoint() {
    return `${APP_URLS.verification}/api/verify`
  },
  endpointType: "https" as const,
  logoBase64: "/self-logo.png",
  useMockPassport: process.env.SELF_USE_MOCK_PASSPORT === "true",
  disclosures: {
    minimumAge: DISCLOSURE_CONFIG.minimumAge,
    ofac: DISCLOSURE_CONFIG.ofac,
  },
  backendConfig: DISCLOSURE_CONFIG,
}

// Celo RPC Configuration (for ZK proof verification)
export const CELO_CONFIG = {
  rpcUrls: process.env.CELO_RPC_URLS ? process.env.CELO_RPC_URLS.split(",") : null, // null means use built-in defaults
}

// Application Constants
export const CONSTANTS = {
  SIGNING_MESSAGE: "Identify myself",
}

// Error Messages
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
