import * as Sentry from "@sentry/nextjs"

const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
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
  // Filter expected server-side errors that are not actionable bugs
  ignoreErrors: [
    // HTTP client disconnect — occurs when a user navigates away mid-request
    "Error: aborted",
  ],
})
