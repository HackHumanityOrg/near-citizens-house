/**
 * Session Schemas
 *
 * Redis session storage schemas with type-safe parsing.
 * Replaces unsafe `JSON.parse() as Session` casts.
 */
import { z } from "zod"
import { attestationIdSchema } from "./core"
import { nearAccountIdSchema } from "./near"

// ============================================================================
// Session Status Schema
// ============================================================================

/**
 * Session status enum.
 */
export const sessionStatusSchema = z.enum(["pending", "success", "error"])

export type SessionStatus = z.infer<typeof sessionStatusSchema>

// ============================================================================
// Session Schema
// ============================================================================

/**
 * Full session schema for Redis storage.
 * All fields except status and timestamp are optional.
 */
export const sessionSchema = z.object({
  status: sessionStatusSchema,
  accountId: nearAccountIdSchema.optional(),
  attestationId: attestationIdSchema.optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  timestamp: z.number(),
})

export type Session = z.infer<typeof sessionSchema>

// ============================================================================
// Session ID Schema
// ============================================================================

/**
 * Session ID schema (UUID format).
 * Uses Zod's native UUID validation.
 */
export const sessionIdSchema = z.string().uuid("Invalid session ID format")

export type SessionId = z.infer<typeof sessionIdSchema>

// ============================================================================
// Session Parsing Helpers
// ============================================================================

/**
 * Parse session data from JSON string.
 * Returns null if parsing or validation fails.
 *
 * Use this instead of `JSON.parse(data) as Session` to ensure type safety.
 */
export function parseSession(data: string): Session | null {
  try {
    const parsed = JSON.parse(data)
    const result = sessionSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/**
 * Validate a session ID format.
 * Returns true if the session ID is a valid UUID.
 */
export function isValidSessionId(sessionId: string): boolean {
  return sessionIdSchema.safeParse(sessionId).success
}
