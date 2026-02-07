// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const isDev = process.env.NODE_ENV === "development"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Intelligent trace sampling: inherit parent or 10% baseline
  tracesSampler: ({ inheritOrSampleWith }) => {
    if (isDev) return 1
    return inheritOrSampleWith(0.1)
  },

  // Enable Sentry structured logging
  enableLogs: true,

  integrations: [
    // Forward console.log, console.warn, and console.error to Sentry Logs
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
})
