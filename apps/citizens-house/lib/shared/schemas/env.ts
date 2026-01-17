/**
 * Environment Variable Schemas
 *
 * Strengthened environment validation with fail-fast behavior.
 * Required variables will throw descriptive errors at startup if missing.
 */
import { z } from "zod"

// ============================================================================
// Environment Schema
// ============================================================================

/**
 * Client-safe environment variables schema.
 * These are available in both client and server code.
 */
export const clientEnvSchema = z.object({
  // NEAR network configuration
  NEXT_PUBLIC_NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),

  // Self.xyz network (independent from NEAR network)
  NEXT_PUBLIC_SELF_NETWORK: z.enum(["testnet", "mainnet"]).default("mainnet"),

  // Contract address - REQUIRED for functionality
  NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: z.string().min(1, "Verification contract ID is required"),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // UserJot (optional feedback widget)
  NEXT_PUBLIC_USERJOT_PROJECT_ID: z.string().optional(),
})

/**
 * Server-only environment variables schema.
 * These are only available in server code.
 */
export const serverEnvSchema = clientEnvSchema.extend({
  // FastNEAR API key (optional - enhances RPC reliability)
  FASTNEAR_API_KEY: z.string().optional(),

  // Backend wallet credentials (required for writing to contract)
  NEAR_ACCOUNT_ID: z.string().optional(),
  NEAR_PRIVATE_KEY: z.string().optional(),

  // Redis for session storage - REQUIRED for verification flow
  REDIS_URL: z.string().min(1, "Redis URL is required for session storage"),

  // Celo RPC URL for ZK proof verification (optional - has default)
  CELO_RPC_URL: z.string().url().optional(),

  // E2E Testing flag - WARNING: Must NEVER be "true" in production
  SKIP_ZK_VERIFICATION: z
    .string()
    .optional()
    .refine(
      (val) => {
        // In production, this must not be "true"
        if (process.env.NODE_ENV === "production" && val === "true") {
          return false
        }
        return true
      },
      { message: "SKIP_ZK_VERIFICATION cannot be 'true' in production" },
    ),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>
export type ServerEnv = z.infer<typeof serverEnvSchema>

// ============================================================================
// Environment Validation
// ============================================================================

// Cached environment to avoid re-validation
let cachedClientEnv: ClientEnv | null = null
let cachedServerEnv: ServerEnv | null = null

/**
 * Get validated client environment variables.
 * Throws a descriptive error if required variables are missing.
 *
 * Call this at app startup to fail fast on misconfiguration.
 */
export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) return cachedClientEnv

  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_NEAR_NETWORK: process.env.NEXT_PUBLIC_NEAR_NETWORK,
    NEXT_PUBLIC_SELF_NETWORK: process.env.NEXT_PUBLIC_SELF_NETWORK,
    NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_USERJOT_PROJECT_ID: process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID,
  })

  if (!result.success) {
    const errors = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`Environment validation failed:\n${errors}`)
  }

  cachedClientEnv = result.data
  return cachedClientEnv
}

/**
 * Get validated server environment variables.
 * Throws a descriptive error if required variables are missing.
 *
 * Call this at app startup to fail fast on misconfiguration.
 * Only call from server-side code.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv

  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_NEAR_NETWORK: process.env.NEXT_PUBLIC_NEAR_NETWORK,
    NEXT_PUBLIC_SELF_NETWORK: process.env.NEXT_PUBLIC_SELF_NETWORK,
    NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_USERJOT_PROJECT_ID: process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID,
    FASTNEAR_API_KEY: process.env.FASTNEAR_API_KEY,
    NEAR_ACCOUNT_ID: process.env.NEAR_ACCOUNT_ID,
    NEAR_PRIVATE_KEY: process.env.NEAR_PRIVATE_KEY,
    REDIS_URL: process.env.REDIS_URL,
    CELO_RPC_URL: process.env.CELO_RPC_URL,
    SKIP_ZK_VERIFICATION: process.env.SKIP_ZK_VERIFICATION,
  })

  if (!result.success) {
    const errors = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n")
    throw new Error(`Server environment validation failed:\n${errors}`)
  }

  cachedServerEnv = result.data
  return cachedServerEnv
}

/**
 * Check if backend wallet is configured for contract writes.
 * Call this before attempting write operations.
 */
export function isBackendWalletConfigured(): boolean {
  const env = getServerEnv()
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
  return process.env.SKIP_ZK_VERIFICATION === "true"
}
