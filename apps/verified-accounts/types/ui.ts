/**
 * UI-specific type schemas for the verified-accounts app
 * These types are app-specific and not shared across the monorepo
 */
import { z } from "zod"

// Verification step in UI flow
export const verificationStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(["pending", "active", "complete", "error"]),
})

export type VerificationStep = z.infer<typeof verificationStepSchema>

// Verification status for passport QR scanner
export const verificationStatusSchema = z.enum(["idle", "scanning", "verifying", "success", "error"])

export type VerificationStatus = z.infer<typeof verificationStatusSchema>
