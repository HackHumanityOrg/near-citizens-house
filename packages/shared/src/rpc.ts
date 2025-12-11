/**
 * NEAR RPC Provider Configuration
 *
 * Centralized RPC provider with FastNear as primary and automatic failover.
 * All contract clients should use this module for RPC access.
 */
import { JsonRpcProvider, FailoverRpcProvider } from "@near-js/providers"
import { NEAR_CONFIG } from "./config"

// ============================================================================
// RPC URL Configuration
// ============================================================================

/**
 * RPC endpoints by network, ordered by priority (FastNear first)
 */
export const RPC_ENDPOINTS = {
  mainnet: [
    "https://rpc.mainnet.fastnear.com", // FastNear - primary (supports API key)
    "https://free.rpc.fastnear.com", // FastNear - free tier
    "https://near.lava.build:443", // Lava
    "https://rpc.mainnet.near.org", // NEAR Foundation
  ],
  testnet: [
    "https://rpc.testnet.fastnear.com", // FastNear - primary
    "https://test.rpc.fastnear.com", // FastNear - alternate
    "https://rpc.testnet.near.org", // NEAR Foundation
  ],
} as const

/**
 * Retry configuration for RPC requests
 */
export const RPC_RETRY_OPTIONS = {
  retries: 3,
  wait: 500, // ms between retries
  backoff: 2, // exponential backoff multiplier
}

// ============================================================================
// Provider Creation
// ============================================================================

/**
 * Get RPC endpoints for the current network
 */
export function getRpcEndpoints(): readonly string[] {
  return RPC_ENDPOINTS[NEAR_CONFIG.networkId] ?? RPC_ENDPOINTS.testnet
}

/**
 * Get headers for RPC requests (includes API key if configured)
 */
export function getRpcHeaders(url: string): Record<string, string> {
  // Only apply API key to fastnear.com URLs
  if (NEAR_CONFIG.rpcApiKey && url.includes("fastnear.com")) {
    return { "x-api-key": NEAR_CONFIG.rpcApiKey }
  }
  return {}
}

/**
 * Create a single JsonRpcProvider for a given URL
 */
export function createJsonRpcProvider(url: string): JsonRpcProvider {
  return new JsonRpcProvider(
    {
      url,
      headers: getRpcHeaders(url),
    },
    RPC_RETRY_OPTIONS,
  )
}

/**
 * Create a FailoverRpcProvider with all configured endpoints
 * Automatically falls back to next provider on failure
 */
export function createFailoverProvider(): FailoverRpcProvider {
  const endpoints = getRpcEndpoints()

  // If custom RPC URL is configured and not already in list, put it first
  const customRpc = NEAR_CONFIG.rpcUrl
  const orderedEndpoints = customRpc && !endpoints.includes(customRpc) ? [customRpc, ...endpoints] : [...endpoints]

  const providers = orderedEndpoints.map((url) => createJsonRpcProvider(url))

  console.log(
    `[RPC] Creating FailoverRpcProvider with ${providers.length} endpoints:`,
    orderedEndpoints.map((url) => url.replace(/https?:\/\//, "")),
  )

  if (NEAR_CONFIG.rpcApiKey) {
    console.log("[RPC] Using FastNear API key for authenticated access")
  }

  return new FailoverRpcProvider(providers)
}

// ============================================================================
// Singleton Provider Instances
// ============================================================================

let failoverProviderInstance: FailoverRpcProvider | null = null
let jsonRpcProviderInstance: JsonRpcProvider | null = null

/**
 * Get the singleton FailoverRpcProvider instance
 * Use this for read operations that benefit from automatic failover
 */
export function getFailoverProvider(): FailoverRpcProvider {
  if (!failoverProviderInstance) {
    failoverProviderInstance = createFailoverProvider()
  }
  return failoverProviderInstance
}

/**
 * Get a simple JsonRpcProvider using the primary RPC endpoint
 * Use this for simple read operations where failover isn't critical
 */
export function getJsonRpcProvider(): JsonRpcProvider {
  if (!jsonRpcProviderInstance) {
    const endpoints = getRpcEndpoints()
    const primaryUrl = NEAR_CONFIG.rpcUrl || endpoints[0]
    jsonRpcProviderInstance = createJsonRpcProvider(primaryUrl)
    console.log(`[RPC] Created JsonRpcProvider: ${primaryUrl.replace(/https?:\/\//, "")}`)
  }
  return jsonRpcProviderInstance
}

/**
 * Reset provider instances (useful for testing or config changes)
 */
export function resetProviders(): void {
  failoverProviderInstance = null
  jsonRpcProviderInstance = null
}
