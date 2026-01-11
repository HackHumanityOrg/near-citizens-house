/**
 * NEAR RPC Provider Configuration
 *
 * Uses FailoverRpcProvider for automatic fallback between RPC endpoints.
 * Primary: dRPC (5,000 RPS, no rate limits - API key in URL)
 * Fallback: FastNEAR (reliable for transactions - API key in header)
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
 * Get FastNEAR URL for the current network (paid endpoints)
 */
function getFastNearUrl(): string {
  return NEAR_CONFIG.networkId === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com"
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

function isFastNearUrl(url: string): boolean {
  return url.includes("fastnear.com")
}

// ============================================================================
// Provider Creation
// ============================================================================

/**
 * Create a FailoverRpcProvider with automatic fallback:
 * 1. Primary: dRPC (5,000 RPS, no rate limits - API key embedded in URL)
 * 2. Fallback: FastNEAR (reliable for transactions - API key in header)
 *
 * If primary fails (timeout, HTTP 500, etc.), automatically switches to FastNEAR.
 */
export function createRpcProvider(): Provider {
  const primaryUrl = NEAR_CONFIG.rpcUrl
  const fallbackUrl = getFastNearUrl()

  const primaryHost = primaryUrl.replace(/https?:\/\//, "").split("/")[0]
  const fallbackHost = fallbackUrl.replace(/https?:\/\//, "").split("/")[0]
  console.log(`[RPC] FailoverRpcProvider: ${primaryHost} -> ${fallbackHost}`)

  const usesFastNear = isFastNearUrl(primaryUrl)
  const primaryHeaders = usesFastNear ? getFastNearHeaders() : undefined
  // Primary: dRPC (API key is embedded in URL, no headers needed)
  const primaryProvider = new JsonRpcProvider({ url: primaryUrl, headers: primaryHeaders }, RPC_RETRY_OPTIONS)

  // Fallback: FastNEAR with API key header
  const fallbackHeaders = getFastNearHeaders()
  const fallbackProvider = new JsonRpcProvider({ url: fallbackUrl, headers: fallbackHeaders }, RPC_RETRY_OPTIONS)

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
