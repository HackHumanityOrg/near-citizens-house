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
import { NEAR_CONFIG } from "./config"

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
// SumSub Server Configuration
// ============================================================================

/**
 * SumSub credentials for ID verification.
 */
export const SUMSUB_SERVER_CONFIG = {
  appToken: env.SUMSUB_APP_TOKEN,
  secretKey: env.SUMSUB_SECRET_KEY,
  webhookSecret: env.SUMSUB_WEBHOOK_SECRET,
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
