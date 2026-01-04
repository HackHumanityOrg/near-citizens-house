/**
 * NEAR RPC Provider Configuration
 *
 * Centralized RPC provider using a single configured endpoint.
 * All contract clients should use this module for RPC access.
 */
import { JsonRpcProvider } from "@near-js/providers"
import { NEAR_CONFIG } from "./config"

// ============================================================================
// RPC Configuration
// ============================================================================

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
 * Create a JsonRpcProvider for the configured RPC URL
 */
export function createRpcProvider(): JsonRpcProvider {
  const rpcUrl = NEAR_CONFIG.rpcUrl
  console.log(`[RPC] Creating JsonRpcProvider: ${rpcUrl.replace(/https?:\/\//, "")}`)
  return new JsonRpcProvider({ url: rpcUrl }, RPC_RETRY_OPTIONS)
}

// ============================================================================
// Singleton Provider Instance
// ============================================================================

let rpcProviderInstance: JsonRpcProvider | null = null

/**
 * Get the singleton JsonRpcProvider instance
 */
export function getRpcProvider(): JsonRpcProvider {
  if (!rpcProviderInstance) {
    rpcProviderInstance = createRpcProvider()
  }
  return rpcProviderInstance
}
