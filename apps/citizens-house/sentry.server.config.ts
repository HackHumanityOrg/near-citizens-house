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
  // Filter expected server-side errors that are not actionable bugs
  ignoreErrors: [
    // HTTP client disconnect — occurs when a user navigates away mid-request
    "Error: aborted",
  ],
})
