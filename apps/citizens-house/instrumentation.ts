/**
 * Next.js Instrumentation
 *
 * This file is used for server-side initialization.
 * Environment validation is handled by T3 Env in next.config.ts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }

  // Register backend key pool on-chain (only on Node.js runtime, not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run async without blocking server startup
    import("@/lib/backend-key-registration")
      .then(({ ensureBackendKeysRegistered }) => ensureBackendKeysRegistered())
      .catch((err) => console.error("[Instrumentation] Failed to load backend-key-registration:", err))
  }
}

export const onRequestError = Sentry.captureRequestError
