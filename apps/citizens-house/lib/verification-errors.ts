/**
 * Shared utilities for verification error handling
 *
 * Provides consistent error titles, messages, and retry logic
 * across the verification flow (callback page and error modal).
 */

import { VERIFICATION_ERROR_MESSAGES, type VerificationErrorCode } from "@near-citizens/shared"

/**
 * Error codes that indicate non-recoverable issues.
 * Users cannot retry verification with the same account/passport.
 */
export const NON_RETRYABLE_ERRORS = ["DUPLICATE_PASSPORT", "ACCOUNT_ALREADY_VERIFIED", "CONTRACT_PAUSED"] as const

export type NonRetryableErrorCode = (typeof NON_RETRYABLE_ERRORS)[number]

/**
 * Get a user-friendly title for an error code.
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
      // Check if it's a known error code from shared types
      if (errorCode in VERIFICATION_ERROR_MESSAGES) {
        return VERIFICATION_ERROR_MESSAGES[errorCode as VerificationErrorCode]
      }
      // Return the error code itself as last resort (may be a descriptive message)
      return fallbackMessage || errorCode
  }
}

/**
 * Check if an error code indicates a non-retryable error.
 * Non-retryable errors cannot be resolved by the user trying again.
 */
export function isNonRetryableError(errorCode: string | null | undefined): boolean {
  return (
    errorCode !== null && errorCode !== undefined && NON_RETRYABLE_ERRORS.includes(errorCode as NonRetryableErrorCode)
  )
}
