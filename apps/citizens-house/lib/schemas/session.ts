/**
 * Session Schemas - Redis session storage schemas with type-safe parsing.
 */
import { z } from "zod"
import { nearAccountIdSchema } from "./near"

export const sessionStatusSchema = z.enum(["pending", "success", "error"])

export type SessionStatus = z.infer<typeof sessionStatusSchema>

export const sessionSchema = z.object({
  status: sessionStatusSchema,
  accountId: nearAccountIdSchema.optional(),
  sumsubApplicantId: z.string().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  timestamp: z.number(),
})

export type Session = z.infer<typeof sessionSchema>

export const sessionIdSchema = z.uuid({ message: "Invalid session ID format" })

export type SessionId = z.infer<typeof sessionIdSchema>

export function parseSession(data: string): Session | null {
  try {
    const parsed = JSON.parse(data)
    const result = sessionSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function isValidSessionId(sessionId: string): boolean {
  return sessionIdSchema.safeParse(sessionId).success
}
