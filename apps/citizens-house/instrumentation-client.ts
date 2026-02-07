// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"

const isDev = process.env.NODE_ENV === "development"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Intelligent trace sampling: always sample verification flow, 10% baseline
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (isDev) return 1
    if (name?.includes("verification")) return 1
    return inheritOrSampleWith(0.1)
  },

  // Profiling piggybacks on sampled traces
  profileSessionSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  profileLifecycle: "trace",

  // Enable Sentry structured logging
  enableLogs: true,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.browserProfilingIntegration(),
    // Session replay for error context
    Sentry.replayIntegration(),
    // Forward console.log, console.warn, and console.error to Sentry Logs
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],

  // Replay sample rates
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
