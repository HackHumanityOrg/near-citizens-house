/**
 * NEAR RPC Provider Configuration
 *
 * Uses FastNEAR as the single RPC endpoint.
 * Optional API key is sent via X-API-Key header.
 */
import { JsonRpcProvider } from "@near-js/providers"
import type { Provider } from "@near-js/providers"
import { NEAR_CONFIG } from "./config"

// ============================================================================
// RPC Configuration
// ============================================================================

/**
 * Retry configuration for individual RPC requests
 */
export const RPC_RETRY_OPTIONS = {
  retries: 3,
  wait: 500, // ms between retries
  backoff: 2, // exponential backoff multiplier
}

/**
 * Get FastNEAR RPC headers including API key if configured
 */
function getFastNearHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (NEAR_CONFIG.rpcApiKey) {
    headers["X-API-Key"] = NEAR_CONFIG.rpcApiKey
  }
  return headers
}

// ============================================================================
// Provider Creation
// ============================================================================

/**
 * Create a JsonRpcProvider backed by FastNEAR.
 */
export function createRpcProvider(): Provider {
  const rpcUrl = NEAR_CONFIG.rpcUrl
  const host = rpcUrl.replace(/https?:\/\//, "").split("/")[0]
  console.log(`[RPC] JsonRpcProvider: ${host}`)
  const headers = getFastNearHeaders()
  return new JsonRpcProvider({ url: rpcUrl, headers }, RPC_RETRY_OPTIONS)
}

// ============================================================================
// Singleton Provider Instance
// ============================================================================

let rpcProviderInstance: Provider | null = null

/**
 * Get the singleton Provider instance
 */
export function getRpcProvider(): Provider {
  if (!rpcProviderInstance) {
    rpcProviderInstance = createRpcProvider()
  }
  return rpcProviderInstance
}
