// Validate environment at build time (fail-fast on misconfiguration)
// @see https://env.t3.gg/docs/nextjs
import "./lib/schemas/env"

import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@selfxyz/core", "pino", "thread-stream", "pino-pretty"],
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

export default nextConfig
