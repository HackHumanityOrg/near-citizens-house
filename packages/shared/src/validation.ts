/**
 * Shared Validation Schemas
 *
 * Common Zod schemas used across both applications.
 * For app-specific validation schemas, define them locally in the app.
 */
import { z } from "zod"

// ============================================================================
// NEAR Account Validation
// ============================================================================

/**
 * NEAR Account ID validation
 * Validates format: lowercase alphanumeric with dots, dashes, underscores
 * Examples: "alice.near", "bob.testnet", "my-account_123.near"
 */
export const nearAccountIdSchema = z
  .string()
  .min(2, "Account ID must be at least 2 characters")
  .max(64, "Account ID must be at most 64 characters")
  .regex(
    /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/,
    "Account ID must start/end with alphanumeric and contain only lowercase letters, numbers, dots, dashes, underscores",
  )

export type NearAccountId = z.infer<typeof nearAccountIdSchema>

// ============================================================================
// Pagination
// ============================================================================

/**
 * Pagination parameters - strict object to catch any extra fields
 */
export const paginationSchema = z.strictObject({
  page: z.number().int().min(0, "Page must be non-negative").max(100000, "Page too large"),
  pageSize: z.number().int().min(1, "Page size must be at least 1").max(100, "Page size must be at most 100"),
})

export type PaginationParams = z.infer<typeof paginationSchema>
