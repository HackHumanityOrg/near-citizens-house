// Validate environment at build time (fail-fast on misconfiguration)
// @see https://env.t3.gg/docs/nextjs
import "./lib/schemas/env"

import type { NextConfig } from "next"
import { withPostHogConfig } from "@posthog/nextjs-config"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@selfxyz/core"],
  // Empty turbopack config to allow turbopack to work
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false }
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /require-in-the-middle/,
        message:
          /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
      },
    ]
    return config
  },
  transpilePackages: ["@hot-labs/near-connect", "@walletconnect/sign-client"],
  // Required for PostHog proxy
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // PostHog proxy rewrites
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ]
  },
}

/**
 * PostHog Source Maps Upload
 *
 * Enables readable stack traces in PostHog error tracking.
 * Source maps are uploaded during production builds when configured.
 *
 * Required environment variables:
 * - POSTHOG_PERSONAL_API_KEY: Personal API key from https://app.posthog.com/settings/user-api-keys
 * - POSTHOG_ENV_ID: Environment ID from https://app.posthog.com/settings/environment#variables
 *
 * Note: The env ID is a PostHog-specific identifier, not derived from Vercel.
 * Find it in PostHog → Project Settings → Environment.
 */
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
const hasPostHogSourceMaps = isProduction && process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_ENV_ID

export default hasPostHogSourceMaps
  ? withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      envId: process.env.POSTHOG_ENV_ID!,
      host: "https://us.posthog.com",
      sourcemaps: {
        enabled: true,
        project: "citizens-house",
        deleteAfterUpload: true,
      },
    })
  : nextConfig
