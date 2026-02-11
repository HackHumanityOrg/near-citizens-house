// Validate environment at build time (fail-fast on misconfiguration)
// @see https://env.t3.gg/docs/nextjs
import "./lib/schemas/env"

import type { NextConfig } from "next"
import { withPostHogConfig } from "@posthog/nextjs-config"

function buildCspReportOnlyValue(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https://*.sumsub.com https://us.posthog.com https://us.i.posthog.com",
    "frame-src https://*.sumsub.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join("; ")
}

function buildSecurityHeaders() {
  const headers = [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildCspReportOnlyValue(),
    },
  ]

  if (process.env.NODE_ENV === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    })
  }

  return headers
}

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [],
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(),
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
 * - POSTHOG_PROJECT_ID: Environment ID from https://app.posthog.com/settings/environment#variables
 *
 * Note: The env ID is a PostHog-specific identifier, not derived from Vercel.
 * Find it in PostHog → Project Settings → Environment.
 */
const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
const hasPostHogSourceMaps = isProduction && process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID

export default hasPostHogSourceMaps
  ? withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      envId: process.env.POSTHOG_PROJECT_ID!,
      host: "https://us.posthog.com",
      sourcemaps: {
        enabled: true,
        project: "citizens-house",
        deleteAfterUpload: true,
      },
    })
  : nextConfig
