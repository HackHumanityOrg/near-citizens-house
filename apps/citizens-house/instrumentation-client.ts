import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  enableLogs: true,
  tracesSampleRate: 1,
  profilesSampleRate: 1,
  profileLifecycle: "trace",
  replaysSessionSampleRate: 1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.replayIntegration()],
  // Filter out errors that are expected user behavior or from third-party code
  ignoreErrors: [
    // User declined a wallet transaction — expected, not a bug
    /user rejected/i,
    // Wallet library iframe timing error — from SandboxedWallet, not our code
    "Iframe not loaded",
    // Browser extension errors from injected inpage.js scripts (e.g. MetaMask, NEAR wallet)
    /Cannot read properties of undefined \(reading 'removeListener'\)/,
    // Wallet extension postMessage errors on pages that don't support it
    /Error invoking post: Method not found/,
    // Browser extension property descriptor conflict (chunk-inject.js injected scripts)
    /Invalid property descriptor/,
  ],
  // Don't capture errors originating from browser extensions
  denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /extensions\//i],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
