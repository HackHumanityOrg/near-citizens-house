import * as Sentry from "@sentry/nextjs"

const isDevelopment = process.env.NODE_ENV === "development"

function prioritizeCriticalRoutes(name: string | undefined): boolean {
  if (!name) return false
  return name.includes("/verification") || name.includes("/proposals") || name.includes("/waiting")
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  sendDefaultPii: false,
  enableLogs: true,
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (isDevelopment) return 1
    if (prioritizeCriticalRoutes(name)) return 1
    return inheritOrSampleWith(0.1)
  },
  replaysSessionSampleRate: isDevelopment ? 1 : 0.1,
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
  beforeSend(event) {
    const url = event.request?.url
    if (url) {
      // Drop events from local development environments
      if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) return null
      // Drop events from Vercel preview deployments — only capture production (citizenshouse.org)
      // VERCEL_ENV is not available client-side (no NEXT_PUBLIC_ prefix), so all Vercel builds
      // appear as "production". Filter by URL to avoid preview noise polluting production alerts.
      if (url.includes(".vercel.app")) return null
    }
    return event
  },
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
