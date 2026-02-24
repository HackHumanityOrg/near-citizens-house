import * as Sentry from "@sentry/nextjs"

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const sentryEnvironment = process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV

Sentry.init({
  dsn: sentryDsn,
  enabled: Boolean(sentryDsn),
  environment: sentryEnvironment,
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
    // Browser extension postMessage and proxy errors
    /tronlinkParams/i,
    /DataCloneError/i,
    // Wallet extension postMessage errors on pages that don't support it
    /Error invoking post: Method not found/i,
    // Browser extension property descriptor conflict (chunk-inject.js injected scripts)
    /Invalid property descriptor/,
    // User dismissed HOT wallet popup — expected user action
    "Wallet closed",
    // User cancelled WalletConnect pairing dialog — expected user action
    /User cancelled pairing/i,
    // WalletConnect session proposal timed out — expected
    "Proposal expired",
    // WalletConnect IndexedDB cleanup race on page unload (from @walletconnect/safe-json)
    /Failed to execute 'transaction' on 'IDBDatabase'/,
  ],
  beforeSend(event, hint) {
    const rawError = hint.originalException
    const exceptionValue = event.exception?.values?.[0]
    const errorMessage = typeof exceptionValue?.value === "string" ? exceptionValue.value : ""
    const topLevelMessage = typeof event.message === "string" ? event.message : ""
    const message = typeof rawError === "string" ? rawError : `${errorMessage} ${topLevelMessage}`
    const frames = exceptionValue?.stacktrace?.frames ?? []
    const hasInjectedFrame = frames.some((frame) => {
      const filename = typeof frame.filename === "string" ? frame.filename : ""
      return filename.includes("app:///injected/") || filename.includes("injected.js")
    })

    if (/tronlink/i.test(message) && hasInjectedFrame) {
      return null
    }
    if (/DataCloneError/i.test(message)) {
      return null
    }
    if (/Error invoking post: Method not found/i.test(message)) {
      return null
    }
    if (/Unexpected Suspense handler tag/i.test(message) && event?.transaction?.includes("/proposals")) {
      return null
    }

    // Filter errors from HOT wallet's sandboxed iframe internals — not first-party code
    const hasSandboxedWalletFrame = frames.some((frame) => {
      const filename = typeof frame.filename === "string" ? frame.filename : ""
      return filename.includes("SandboxedWallet/")
    })
    if (hasSandboxedWalletFrame) {
      return null
    }

    // Filter Next.js stale deployment noise — server action IDs change across deploys,
    // causing in-flight clients with old JS to report "Load failed" for missing actions
    if (
      /Load failed/i.test(message) &&
      frames.some((f) => typeof f.filename === "string" && f.filename.includes("server-action-reducer"))
    ) {
      return null
    }

    return event
  },
  // Don't capture errors originating from browser extensions
  denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /extensions\//i],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
