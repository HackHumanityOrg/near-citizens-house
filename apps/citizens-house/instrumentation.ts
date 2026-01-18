/**
 * Next.js Instrumentation
 *
 * This file is used for server-side initialization.
 * Environment validation is handled by T3 Env in next.config.ts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializeOtelLogs } from "@/lib/logger/otel-logs"

export async function register() {
  initializeOtelLogs()
}
