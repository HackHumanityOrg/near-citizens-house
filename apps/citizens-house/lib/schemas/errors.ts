/**
 * Error Schemas
 *
 * Consolidated error codes, messages, and helper functions.
 * Single source of truth for all verification error handling.
 */
import { z } from "zod"

// ============================================================================
// Error Code Schema
// ============================================================================

/**
 * All possible verification error codes.
 * Used across API responses, session storage, and client error handling.
 */
export const verificationErrorCodeSchema = z.enum([
  "MISSING_FIELDS",
  "VERIFICATION_FAILED",
  "NULLIFIER_MISSING",
  "NEAR_SIGNATURE_INVALID",
  "NEAR_SIGNATURE_MISSING",
  "SIGNATURE_EXPIRED",
  "SIGNATURE_TIMESTAMP_INVALID",
  "DUPLICATE_PASSPORT",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",
  "STORAGE_FAILED",
  "INTERNAL_ERROR",
])

export type VerificationErrorCode = z.infer<typeof verificationErrorCodeSchema>

// ============================================================================
// Error Messages
// ============================================================================

/**
 * User-friendly error messages for each error code.
 * Used in API responses and error displays.
 */
export const VERIFICATION_ERROR_MESSAGES: Record<VerificationErrorCode, string> = {
  MISSING_FIELDS: "Missing required fields",
  VERIFICATION_FAILED: "Verification failed",
  NULLIFIER_MISSING: "Nullifier missing from proof",
  NEAR_SIGNATURE_INVALID: "NEAR signature verification failed",
  NEAR_SIGNATURE_MISSING: "Invalid or missing NEAR signature data",
  SIGNATURE_EXPIRED: "Signature expired",
  SIGNATURE_TIMESTAMP_INVALID: "Invalid signature timestamp",
  DUPLICATE_PASSPORT: "This passport has already been registered",
  ACCOUNT_ALREADY_VERIFIED: "This NEAR account is already verified",
  CONTRACT_PAUSED: "Verification is temporarily unavailable",
  STORAGE_FAILED: "Unable to finalize verification at this time",
  INTERNAL_ERROR: "Internal server error",
} as const

// ============================================================================
// Non-Retryable Errors
// ============================================================================

/**
 * Error codes that indicate non-recoverable issues.
 * Users cannot retry verification with the same account/passport.
 */
export const NON_RETRYABLE_ERRORS = ["DUPLICATE_PASSPORT", "ACCOUNT_ALREADY_VERIFIED", "CONTRACT_PAUSED"] as const

export type NonRetryableErrorCode = (typeof NON_RETRYABLE_ERRORS)[number]

/**
 * Check if an error code indicates a non-retryable error.
 * Non-retryable errors cannot be resolved by the user trying again.
 */
export function isNonRetryableError(errorCode: string | null | undefined): boolean {
  return (
    errorCode !== null && errorCode !== undefined && NON_RETRYABLE_ERRORS.includes(errorCode as NonRetryableErrorCode)
  )
}

// ============================================================================
// Validation Issues Schema
// ============================================================================

/**
 * Zod validation issue for structured error responses.
 * Allows API to return detailed field-level validation errors.
 */
export const validationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
  code: z.string().optional(),
})

export type ValidationIssue = z.infer<typeof validationIssueSchema>

// ============================================================================
// Error Helpers
// ============================================================================

/**
 * Verification error response type.
 * Matches the error variant in verifyResponseSchema (api.ts).
 */
export interface VerificationError {
  status: "error"
  result: false
  code: VerificationErrorCode
  reason: string
  issues?: ValidationIssue[]
}

/**
 * Create a typed verification error response.
 */
export function createVerificationError(
  code: VerificationErrorCode,
  details?: string,
  issues?: ValidationIssue[],
): VerificationError {
  const baseMessage = VERIFICATION_ERROR_MESSAGES[code]
  return {
    status: "error",
    result: false,
    code,
    reason: details ? `${baseMessage}: ${details}` : baseMessage,
    ...(issues && { issues }),
  }
}

/**
 * Map contract/storage error messages to error codes.
 * Used to translate low-level errors to user-facing codes.
 */
export function mapContractErrorToCode(errorMessage: string): VerificationErrorCode {
  const message = errorMessage.toLowerCase()

  if (message.includes("nullifier already used") || message.includes("already registered")) {
    return "DUPLICATE_PASSPORT"
  }

  if (message.includes("near account already verified")) {
    return "ACCOUNT_ALREADY_VERIFIED"
  }

  if (message.includes("contract is paused")) {
    return "CONTRACT_PAUSED"
  }

  if (
    message.includes("invalid near signature") ||
    message.includes("signature account id") ||
    message.includes("signature recipient")
  ) {
    return "NEAR_SIGNATURE_INVALID"
  }

  if (
    message.includes("attestation id") ||
    message.includes("nullifier") ||
    message.includes("public signals") ||
    message.includes("proof component") ||
    message.includes("user context data")
  ) {
    return "VERIFICATION_FAILED"
  }

  return "STORAGE_FAILED"
}

// ============================================================================
// User-Facing Error Helpers
// ============================================================================

/**
 * Get a user-friendly title for an error code.
 * Used in error dialogs and UI displays.
 */
export function getErrorTitle(errorCode: string | null | undefined): string {
  switch (errorCode) {
    case "DUPLICATE_PASSPORT":
      return "Already Verified"
    case "ACCOUNT_ALREADY_VERIFIED":
      return "Account Already Verified"
    case "CONTRACT_PAUSED":
      return "Verification Unavailable"
    default:
      return "Verification Failed"
  }
}

/**
 * Get a detailed user-friendly message for an error code.
 * Known error codes get custom UX copy that takes priority over generic backend messages.
 *
 * @param errorCode - The error code from the backend
 * @param fallbackMessage - Optional fallback message if error code is unknown
 */
export function getErrorMessage(errorCode: string | null | undefined, fallbackMessage?: string): string {
  if (!errorCode) {
    return fallbackMessage || "An unexpected error occurred. Please try again."
  }

  switch (errorCode) {
    case "DUPLICATE_PASSPORT":
      return "This passport has already been used to verify another NEAR account. Each passport can only verify one account."
    case "ACCOUNT_ALREADY_VERIFIED":
      return "This NEAR account is already verified. Connect a different account to continue."
    case "CONTRACT_PAUSED":
      return "Verification is temporarily unavailable. Please try again later."
    default:
      // Check if it's a known error code from the schema
      if (errorCode in VERIFICATION_ERROR_MESSAGES) {
        return VERIFICATION_ERROR_MESSAGES[errorCode as VerificationErrorCode]
      }
      // Return the error code itself as last resort (may be a descriptive message)
      return fallbackMessage || errorCode
  }
}
