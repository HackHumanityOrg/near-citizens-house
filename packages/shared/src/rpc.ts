/**
 * NEAR RPC Provider Configuration
 *
 * Uses FailoverRpcProvider for automatic fallback between RPC endpoints.
 * Primary: configured RPC (e.g., dRPC for caching)
 * Fallback: FastNEAR (reliable for transactions)
 */
import { JsonRpcProvider, FailoverRpcProvider } from "@near-js/providers"
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
 * Get FastNEAR URL for the current network
 */
function getFastNearUrl(): string {
  return NEAR_CONFIG.networkId === "mainnet"
    ? "https://free.rpc.fastnear.com"
    : "https://test.rpc.fastnear.com"
}

// ============================================================================
// Provider Creation
// ============================================================================

/**
 * Create a FailoverRpcProvider with automatic fallback:
 * 1. Primary: configured RPC (dRPC or custom)
 * 2. Fallback: FastNEAR (reliable for transactions)
 *
 * If primary fails (timeout, HTTP 500, etc.), automatically switches to FastNEAR.
 */
export function createRpcProvider(): Provider {
  const primaryUrl = NEAR_CONFIG.rpcUrl
  const fallbackUrl = getFastNearUrl()

  const primaryHost = primaryUrl.replace(/https?:\/\//, "").split("/")[0]
  const fallbackHost = fallbackUrl.replace(/https?:\/\//, "").split("/")[0]
  console.log(`[RPC] FailoverRpcProvider: ${primaryHost} -> ${fallbackHost}`)

  const primaryProvider = new JsonRpcProvider({ url: primaryUrl }, RPC_RETRY_OPTIONS)
  const fallbackProvider = new JsonRpcProvider({ url: fallbackUrl }, RPC_RETRY_OPTIONS)

  return new FailoverRpcProvider([primaryProvider, fallbackProvider])
}

// ============================================================================
// Singleton Provider Instance
// ============================================================================

let rpcProviderInstance: Provider | null = null

/**
 * Get the singleton Provider instance (FailoverRpcProvider)
 */
export function getRpcProvider(): Provider {
  if (!rpcProviderInstance) {
    rpcProviderInstance = createRpcProvider()
  }
  return rpcProviderInstance
}
