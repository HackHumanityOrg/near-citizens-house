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

    // SumSub KYC verification credentials
    SUMSUB_APP_TOKEN: z.string().optional(),
    SUMSUB_SECRET_KEY: z.string().optional(),
    SUMSUB_WEBHOOK_SECRET: z.string().optional(),
  },

  /**
   * Client-safe environment variables schema.
   * These are available in both client and server code.
   * Must be prefixed with NEXT_PUBLIC_.
   */
  client: {
    // NEAR network configuration
    NEXT_PUBLIC_NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),

    // SumSub verification level name
    NEXT_PUBLIC_SUMSUB_LEVEL_NAME: z.string().default("id-and-liveness"),

    // Contract address - REQUIRED for functionality
    NEXT_PUBLIC_NEAR_VERIFICATION_CONTRACT: z.string().min(1, "Verification contract ID is required"),

    // App URL (used in wallet signing messages)
    NEXT_PUBLIC_APP_URL: z.url().optional(),

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
    SUMSUB_APP_TOKEN: process.env.SUMSUB_APP_TOKEN,
    SUMSUB_SECRET_KEY: process.env.SUMSUB_SECRET_KEY,
    SUMSUB_WEBHOOK_SECRET: process.env.SUMSUB_WEBHOOK_SECRET,
    // Client variables
    NEXT_PUBLIC_NEAR_NETWORK: process.env.NEXT_PUBLIC_NEAR_NETWORK,
    NEXT_PUBLIC_SUMSUB_LEVEL_NAME: process.env.NEXT_PUBLIC_SUMSUB_LEVEL_NAME,
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
