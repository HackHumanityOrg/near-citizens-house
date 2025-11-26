/** @type {import('next').NextConfig} */
const nextConfig = {
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
    return config
  },
  transpilePackages: ["@hot-labs/near-connect", "@walletconnect/sign-client"],
}

export default nextConfig
