/**
 * UI Schemas
 *
 * UI-specific schemas for the verified-accounts app.
 * These types are app-specific and not shared across the monorepo.
 */
import { z } from "zod"

// ============================================================================
// Verification Step Schema
// ============================================================================

/**
 * Verification step status in UI flow.
 */
export const verificationStepStatusSchema = z.enum(["pending", "active", "complete", "error"])

export type VerificationStepStatus = z.infer<typeof verificationStepStatusSchema>

/**
 * Verification step in UI flow.
 * Used to display multi-step verification progress.
 */
export const verificationStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: verificationStepStatusSchema,
})

export type VerificationStep = z.infer<typeof verificationStepSchema>

// ============================================================================
// Verification Status Schema
// ============================================================================

/**
 * Verification status for passport QR scanner.
 */
export const verificationStatusSchema = z.enum(["idle", "scanning", "verifying", "success", "error"])

export type VerificationStatus = z.infer<typeof verificationStatusSchema>
