// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs"
import { nodeProfilingIntegration } from "@sentry/profiling-node"

const isDev = process.env.NODE_ENV === "development"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Intelligent trace sampling: always sample critical paths, 10% baseline
  tracesSampler: ({ name, inheritOrSampleWith }) => {
    if (isDev) return 1
    if (name?.includes("webhook")) return 1
    if (name?.includes("token")) return 1
    return inheritOrSampleWith(0.1)
  },

  // Profiling piggybacks on sampled traces
  profileSessionSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  profileLifecycle: "trace",

  // Enable Sentry structured logging
  enableLogs: true,

  integrations: [
    nodeProfilingIntegration(),
    // Forward console.log, console.warn, and console.error to Sentry Logs
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
})
