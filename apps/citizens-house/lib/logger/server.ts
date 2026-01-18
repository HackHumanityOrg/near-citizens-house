/**
 * Server Logger Entry Point
 *
 * Use this import for server-side logging (API routes, server components, etc.)
 *
 * @example
 * ```ts
 * import { logger, serializeError, withRequestContext } from "@/lib/logger/server"
 *
 * export async function POST(req: NextRequest) {
 *   return withRequestContext({ requestId: crypto.randomUUID() }, async () => {
 *     logger.info("verification", "start", { source: "button_click" }, "Started")
 *     // requestId automatically included in log
 *   })
 * }
 * ```
 */
import "server-only"

export { logger, serializeError } from "./logger.server"
export { withRequestContext, getRequestContext, updateRequestContext, requestContext } from "./context"
export type { RequestContext } from "./context"

// Re-export types for convenience
export type {
  LogLevel,
  LogDomain,
  LogEvent,
  VerificationLog,
  SessionLog,
  RpcLog,
  CitizensLog,
  AuthLog,
  LogError,
  LogActionForDomain,
  LogEventForAction,
} from "@/lib/schemas/log"

export { logEventSchema, logLevelSchema, logErrorSchema, parseLogEvent } from "@/lib/schemas/log"
