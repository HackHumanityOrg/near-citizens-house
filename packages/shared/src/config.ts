// ==============================================================================
// CENTRALIZED ENVIRONMENT CONFIGURATION
// ==============================================================================
// All environment variables should be accessed through this file.
// Do NOT use process.env directly elsewhere in the codebase.
// ==============================================================================

import { z } from "zod"
import { countries } from "@selfxyz/core"

// ==============================================================================
// ENVIRONMENT VALIDATION
// ==============================================================================
// Validates environment variables at startup for faster feedback on misconfigurations.
// Server-side variables are optional (not available on client).
// ==============================================================================

const envSchema = z.object({
  // Required for all environments (client & server)
  NEXT_PUBLIC_NEAR_NETWORK: z.enum(["testnet", "mainnet"]).optional(),

  // Self.xyz network (independent from NEAR network)
  // "mainnet" = Real passports with OFAC checks, "testnet" = Mock passports
  NEXT_PUBLIC_SELF_NETWORK: z.enum(["testnet", "mainnet"]).optional(),

  // Contract addresses (required for functionality, but may be empty during setup)
  NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_NEAR_BRIDGE_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_SPUTNIK_DAO_CONTRACT: z.string().optional(),

  // Server-side only (not available on client)
  NEAR_ACCOUNT_ID: z.string().optional(),
  NEAR_PRIVATE_KEY: z.string().optional(),

  // Redis for session storage (server-side only)
  REDIS_URL: z.string().optional(),

  // Celo RPC URLs for ZK proof verification (comma-separated, server-side only)
  CELO_RPC_URLS: z.string().optional(),
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
  if (!process.env.REDIS_URL) {
    console.warn("[Config] REDIS_URL not configured - session storage will fail")
  }

  // Log network configuration
  const nearNetwork = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
  const selfNetwork = process.env.NEXT_PUBLIC_SELF_NETWORK || "mainnet"
  console.log(`[Config] NEAR network: ${nearNetwork}`)
  console.log(`[Config] Self.xyz network: ${selfNetwork}`)
  if (nearNetwork !== selfNetwork) {
    console.log(`[Config] Running in mixed-network mode (NEAR ${nearNetwork} + Self ${selfNetwork})`)
  }
}

// NEAR Network Configuration
const networkId = (process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet") as "testnet" | "mainnet"

// Self.xyz Network Configuration (independent from NEAR network)
// This allows using NEAR testnet with Self.xyz mainnet for real passport verification with OFAC checks
const selfNetworkId = (process.env.NEXT_PUBLIC_SELF_NETWORK || "mainnet") as "testnet" | "mainnet"

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
  excludedCountries: [
    countries.IRAN,
    countries.IRAQ,
    countries.NORTH_KOREA,
    countries.RUSSIA,
    countries.SYRIAN_ARAB_REPUBLIC,
    countries.VENEZUELA,
  ],
  ofac: true,
}

export const SELF_CONFIG = {
  appName: "NEAR Citizens House",
  scope: "near-citizens-house",
  // Self.xyz network (independent from NEAR network)
  // "mainnet" = Real passports with OFAC checks
  // "testnet" = Mock passports for testing (no OFAC)
  networkId: selfNetworkId,
  get endpoint() {
    return `${APP_URLS.verification}/api/verify`
  },
  get deeplinkCallback() {
    return `${APP_URLS.verification}/verify-callback`
  },
  endpointType: "https" as const,
  logoBase64: "/self-logo.png",
  // useMockPassport is derived from networkId
  // testnet = mock passports, mainnet = real passports
  get useMockPassport() {
    return this.networkId === "testnet"
  },
  // Single source of truth for both frontend and backend
  // Must match exactly for Self.xyz verification to work
  disclosures: DISCLOSURE_CONFIG,
}

// Celo RPC Configuration (for ZK proof verification)
export const CELO_CONFIG = {
  // Parse CELO_RPC_URLS: null means use built-in defaults, empty string treated as unset
  rpcUrls: (() => {
    const envValue = process.env.CELO_RPC_URLS?.trim()
    if (!envValue) return null // empty or undefined = use defaults
    const urls = envValue
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
    return urls.length > 0 ? urls : null
  })(),
}

// Application Constants
export const CONSTANTS = {
  SIGNING_MESSAGE: "Identify myself",
}
