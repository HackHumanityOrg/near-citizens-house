import * as Sentry from "@sentry/nextjs"

const isDevelopment = process.env.NODE_ENV === "development"

function prioritizeCriticalRoutes(name: string | undefined): boolean {
  if (!name) return false
  return (
    name.includes("/api/verification") ||
    name.includes("/api/governance") ||
    name.includes("/proposals") ||
    name.includes("/waiting")
  )
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
  // Filter expected server-side errors that are not actionable bugs
  ignoreErrors: [
    // HTTP client disconnect — occurs when a user navigates away mid-request
    "Error: aborted",
  ],
})
