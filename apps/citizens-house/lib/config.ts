// ==============================================================================
// CENTRALIZED ENVIRONMENT CONFIGURATION
// ==============================================================================
// All environment variables should be accessed through this file.
// Do NOT use process.env directly elsewhere in the codebase.
// ==============================================================================

import { z } from "zod"
import type { VerificationConfig } from "@selfxyz/core"
import type { NearAccountId } from "./schemas/near"

// ==============================================================================
// ENVIRONMENT VALIDATION
// ==============================================================================
// Validates environment variables at startup for faster feedback on misconfigurations.
// Server-side variables are optional (not available on client).
// ==============================================================================

const envSchema = z.object({
  // Required for all environments (client & server)
  NEXT_PUBLIC_NEAR_NETWORK: z.enum(["testnet", "mainnet"]).optional(),

  // Server-side RPC configuration
  FASTNEAR_API_KEY: z.string().optional(), // FastNEAR API key for RPC header

  // Self.xyz network (independent from NEAR network)
  NEXT_PUBLIC_SELF_NETWORK: z.enum(["testnet", "mainnet"]).optional(),

  // Contract addresses (required for functionality, but may be empty during setup)
  NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: z.string().optional(),

  // Server-side only (not available on client)
  NEAR_ACCOUNT_ID: z.string().optional(),
  NEAR_PRIVATE_KEY: z.string().optional(),

  // Redis for session storage (server-side only)
  REDIS_URL: z.string().optional(),

  // Celo RPC URL for ZK proof verification (server-side only)
  CELO_RPC_URL: z.string().optional(),

  // E2E Testing: Skip Self.xyz ZK proof verification (server-side only)
  // WARNING: Must NEVER be "true" in production
  SKIP_ZK_VERIFICATION: z.string().optional(),
})

// Validate environment at module load time
envSchema.safeParse(process.env)

// NEAR Network Configuration
const networkId = (process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet") as "testnet" | "mainnet"

// Self.xyz Network Configuration (independent from NEAR network)
// This allows using NEAR testnet with Self.xyz mainnet for real passport verification
const selfNetworkId = (process.env.NEXT_PUBLIC_SELF_NETWORK || "mainnet") as "testnet" | "mainnet"

// FastNEAR RPC URL
const getFastNearUrl = () =>
  networkId === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com"

export const NEAR_CONFIG = {
  networkId,
  // FastNEAR RPC URL
  rpcUrl: getFastNearUrl(),
  // FastNEAR API key (X-API-Key header)
  rpcApiKey: process.env.FASTNEAR_API_KEY || "",
  // Contract addresses
  verificationContractId: process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT || "",
  // Backend wallet credentials (server-side only)
  backendAccountId: process.env.NEAR_ACCOUNT_ID || "",
  backendPrivateKey: process.env.NEAR_PRIVATE_KEY || "",
  // Explorer URLs
  get explorerUrl() {
    return this.networkId === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io"
  },
  get explorerAccountUrl() {
    return (accountId: NearAccountId) => `${this.explorerUrl}/address/${accountId}`
  },
}

// App URL (single app after merge of verification and governance)
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://citizenshouse.org"

// Self.xyz Configuration
// Verification rules are enforced by the backend verifier and contracts.
// Disclosure requests (like nationality) are frontend-only and returned in discloseOutput.
const VERIFICATION_CONFIG: VerificationConfig = {
  excludedCountries: [],
}

const DISCLOSURE_CONFIG: VerificationConfig & { nationality: boolean } = {
  ...VERIFICATION_CONFIG,
  nationality: true, // Request nationality disclosure from passport
}

export const SELF_VERIFICATION_CONFIG = VERIFICATION_CONFIG

const selfEndpointType: "https" | "staging_https" = selfNetworkId === "mainnet" ? "https" : "staging_https"

export const SELF_CONFIG = {
  appName: "NEAR Citizens House",
  scope: "near-citizens-house",
  // Self.xyz network (independent from NEAR network)
  networkId: selfNetworkId,
  get endpoint() {
    return `${APP_URL}/api/verification/verify`
  },
  get deeplinkCallback() {
    return `${APP_URL}/verification/callback`
  },
  endpointType: selfEndpointType,
  logoBase64: `${APP_URL}/self-logo.png`,
  // useMockPassport is derived from networkId
  // testnet = mock passports, mainnet = real passports
  get useMockPassport() {
    return this.networkId === "testnet"
  },
  // Frontend disclosure config (verification rules + disclosure requests)
  // Verification rules must match SELF_VERIFICATION_CONFIG on the backend
  disclosures: DISCLOSURE_CONFIG,
}

// Celo RPC Configuration (for ZK proof verification)
// Default public Celo RPC URLs
const defaultCeloRpcUrl =
  selfNetworkId === "mainnet" ? "https://forno.celo.org" : "https://alfajores-forno.celo-testnet.org"

export const CELO_CONFIG = {
  // Single RPC URL (can be overridden via env var)
  rpcUrl: process.env.CELO_RPC_URL || defaultCeloRpcUrl,
}

// UserJot Configuration (Feedback Widget)
export const USERJOT_CONFIG = {
  projectId: process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID || "",
  get enabled() {
    return !!this.projectId
  },
}

// Application Constants
export function getSigningRecipient(): string {
  const contractId = NEAR_CONFIG.verificationContractId
  if (!contractId) {
    throw new Error("Verification contract ID not configured")
  }
  return contractId
}

export function getSigningMessage(): string {
  const contractId = NEAR_CONFIG.verificationContractId || "unknown-contract"
  return `Identify myself for ${contractId} at ${APP_URL}`
}

export const CONSTANTS = {
  SIGNING_MESSAGE: getSigningMessage(),
}
