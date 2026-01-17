/**
 * Server-only Application Configuration
 *
 * Contains configuration that requires server-side environment variables.
 * This file is marked with "server-only" to prevent accidental client imports.
 *
 * Import this module only in:
 * - Server Components
 * - API Routes
 * - Server Actions
 * - Other server-only code
 */
import "server-only"

import { env } from "./schemas/env"
import { NEAR_CONFIG, SELF_CONFIG } from "./config"

// ============================================================================
// Server-only NEAR Configuration
// ============================================================================

/**
 * Extended NEAR configuration with server-only credentials.
 * Use this in server code that needs RPC API key or backend wallet access.
 */
export const NEAR_SERVER_CONFIG = {
  ...NEAR_CONFIG,
  // FastNEAR API key (X-API-Key header)
  rpcApiKey: env.FASTNEAR_API_KEY ?? "",
  // Backend wallet credentials (server-side only)
  backendAccountId: env.NEAR_ACCOUNT_ID ?? "",
  backendPrivateKey: env.NEAR_PRIVATE_KEY ?? "",
}

// ============================================================================
// Celo RPC Configuration (for ZK proof verification)
// ============================================================================

/**
 * Celo RPC configuration for ZK proof verification.
 * Default URLs based on Self.xyz network setting.
 */
const defaultCeloRpcUrl =
  SELF_CONFIG.networkId === "mainnet" ? "https://forno.celo.org" : "https://alfajores-forno.celo-testnet.org"

export const CELO_CONFIG = {
  // Single RPC URL (can be overridden via env var)
  rpcUrl: env.CELO_RPC_URL ?? defaultCeloRpcUrl,
}

// ============================================================================
// Server-only Helper Functions
// ============================================================================

/**
 * Check if backend wallet is configured for contract writes.
 * Call this before attempting write operations.
 */
export function isBackendWalletConfigured(): boolean {
  return Boolean(env.NEAR_ACCOUNT_ID && env.NEAR_PRIVATE_KEY)
}

/**
 * Check if ZK verification should be skipped (E2E testing only).
 * WARNING: This should NEVER return true in production.
 */
export function shouldSkipZkVerification(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false
  }
  return env.SKIP_ZK_VERIFICATION === "true"
}

/**
 * Check if running in E2E testing mode.
 */
export function isE2ETesting(): boolean {
  return env.E2E_TESTING === "true"
}
