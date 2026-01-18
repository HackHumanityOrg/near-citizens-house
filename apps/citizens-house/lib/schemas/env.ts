/**
 * Environment Variable Validation using T3 Env
 *
 * Type-safe environment variables with build-time validation.
 * @see https://env.t3.gg/docs/nextjs
 */
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  /**
   * Server-only environment variables schema.
   * These are only available in server code.
   */
  server: {
    // FastNEAR API key (optional - enhances RPC reliability)
    FASTNEAR_API_KEY: z.string().optional(),

    // Backend wallet credentials (required for writing to contract)
    NEAR_ACCOUNT_ID: z.string().optional(),
    NEAR_PRIVATE_KEY: z.string().optional(),

    // Redis for session storage - REQUIRED for verification flow
    REDIS_URL: z.string().min(1, "Redis URL is required for session storage"),

    // Celo RPC URL for ZK proof verification (optional - has default)
    CELO_RPC_URL: z.string().url().optional(),

    // E2E Testing flags - WARNING: Must NEVER be "true" in production
    SKIP_ZK_VERIFICATION: z.string().optional(),
    E2E_TESTING: z.string().optional(),

    // Logging configuration
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  },

  /**
   * Client-safe environment variables schema.
   * These are available in both client and server code.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {
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

    // PostHog analytics (optional)
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),

    // WalletConnect project ID (optional - enables WalletConnect wallets)
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  },

  /**
   * Runtime environment mapping.
   * T3 Env requires explicit mapping to handle tree-shaking properly.
   */
  runtimeEnv: {
    // Server variables
    FASTNEAR_API_KEY: process.env.FASTNEAR_API_KEY,
    NEAR_ACCOUNT_ID: process.env.NEAR_ACCOUNT_ID,
    NEAR_PRIVATE_KEY: process.env.NEAR_PRIVATE_KEY,
    REDIS_URL: process.env.REDIS_URL,
    CELO_RPC_URL: process.env.CELO_RPC_URL,
    SKIP_ZK_VERIFICATION: process.env.SKIP_ZK_VERIFICATION,
    E2E_TESTING: process.env.E2E_TESTING,
    LOG_LEVEL: process.env.LOG_LEVEL,
    // Client variables
    NEXT_PUBLIC_NEAR_NETWORK: process.env.NEXT_PUBLIC_NEAR_NETWORK,
    NEXT_PUBLIC_SELF_NETWORK: process.env.NEXT_PUBLIC_SELF_NETWORK,
    NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: process.env.NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_USERJOT_PROJECT_ID: process.env.NEXT_PUBLIC_USERJOT_PROJECT_ID,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  },

  /**
   * Treat empty strings as undefined.
   * Prevents empty env vars from breaking validation for optional fields.
   */
  emptyStringAsUndefined: true,
})
