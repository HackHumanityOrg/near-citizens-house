/**
 * NEAR RPC Provider Configuration (Server-only)
 *
 * Uses FastNEAR as the single RPC endpoint.
 * Optional API key is sent via X-API-Key header.
 *
 * NOTE: This module is server-only because it uses the RPC API key.
 */
import "server-only"

import { JsonRpcProvider } from "@near-js/providers"
import type { Provider } from "@near-js/providers"
import { NEAR_SERVER_CONFIG } from "../config.server"

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
 * Get the RPC URL for direct fetch calls
 */
export function getRpcUrl(): string {
  return NEAR_SERVER_CONFIG.rpcUrl
}

/**
 * Get FastNEAR RPC headers including API key if configured
 */
export function getRpcHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  if (NEAR_SERVER_CONFIG.rpcApiKey) {
    headers["X-API-Key"] = NEAR_SERVER_CONFIG.rpcApiKey
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
  const rpcUrl = getRpcUrl()
  const headers = getRpcHeaders()
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
