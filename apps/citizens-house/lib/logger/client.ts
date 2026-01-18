/**
 * Client Logger Entry Point
 *
 * Use this import for client-side logging (components, hooks, etc.)
 *
 * @example
 * ```ts
 * "use client"
 * import { logger, serializeError } from "@/lib/logger/client"
 *
 * function VerifyButton() {
 *   const handleClick = () => {
 *     logger.info("verification", "start", { source: "button_click" }, "User clicked verify")
 *   }
 *   return <button onClick={handleClick}>Verify</button>
 * }
 * ```
 */
"use client"

export { logger, serializeError } from "./logger.client"

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
