/**
 * NEAR RPC Provider Configuration (Server-only)
 *
 * Uses FastNEAR as the single RPC endpoint.
 * FastNEAR API key is sent via X-API-Key header.
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
 * Get FastNEAR RPC headers.
 * FASTNEAR_API_KEY is required for all RPC requests.
 */
export function getRpcHeaders(): Record<string, string> {
  const apiKey = NEAR_SERVER_CONFIG.rpcApiKey.trim()
  if (!apiKey) {
    throw new Error("FASTNEAR_API_KEY is required for FastNEAR RPC requests")
  }

  return { "X-API-Key": apiKey }
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
