// ==============================================================================
// CENTRALIZED ENVIRONMENT CONFIGURATION
// ==============================================================================
// All environment variables should be accessed through this file.
// Do NOT use process.env directly elsewhere in the codebase.
// ==============================================================================

import { z } from "zod"

// ==============================================================================
// ENVIRONMENT VALIDATION
// ==============================================================================
// Validates environment variables at startup for faster feedback on misconfigurations.
// Server-side variables are optional (not available on client).
// ==============================================================================

const envSchema = z.object({
  // Required for all environments (client & server)
  NEXT_PUBLIC_NEAR_NETWORK: z.enum(["testnet", "mainnet"]).optional(),

  // Contract addresses (required for functionality, but may be empty during setup)
  NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_SPUTNIK_DAO_CONTRACT: z.string().optional(),

  // Server-side only (not available on client)
  NEAR_ACCOUNT_ID: z.string().optional(),
  NEAR_PRIVATE_KEY: z.string().optional(),
})

// Validate environment at module load time
const envResult = envSchema.safeParse(process.env)
if (!envResult.success) {
  const issues = envResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
  console.warn(`[Config] Environment validation warnings: ${issues}`)
}

// Log configuration status on server-side for debugging
if (typeof window === "undefined") {
  const hasBackendWallet = !!(process.env.NEAR_ACCOUNT_ID && process.env.NEAR_PRIVATE_KEY)
  const hasContracts = !!(
    process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT || process.env.NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT
  )
  if (!hasBackendWallet) {
    console.warn("[Config] Backend wallet credentials not configured - write operations will fail")
  }
  if (!hasContracts) {
    console.warn("[Config] No contract addresses configured - contract operations will fail")
  }
}

// NEAR Network Configuration
const networkId = (process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet") as "testnet" | "mainnet"

// Default RPC URLs for FastNear
const defaultRpcUrl = networkId === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com"

export const NEAR_CONFIG = {
  networkId,
  // Primary RPC URL (can be overridden via env var)
  rpcUrl: process.env.NEXT_PUBLIC_NEAR_RPC_URL || defaultRpcUrl,
  // Optional API key for authenticated RPC access (FastNear paid plans)
  rpcApiKey: process.env.NEAR_RPC_API_KEY || "",
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
  ofac: true,
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
