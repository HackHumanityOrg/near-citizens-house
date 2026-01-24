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
  "SUMSUB_APPLICANT_MISSING",
  "SUMSUB_VERIFICATION_REJECTED",
  "NEAR_SIGNATURE_INVALID",
  "NEAR_SIGNATURE_MISSING",
  "SIGNATURE_EXPIRED",
  "SIGNATURE_TIMESTAMP_INVALID",
  "DUPLICATE_IDENTITY",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",
  "STORAGE_FAILED",
  "INTERNAL_ERROR",
  "VERIFICATION_ON_HOLD",
  "VERIFICATION_REJECTED",
  "VERIFICATION_RETRY",
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
  SUMSUB_APPLICANT_MISSING: "SumSub applicant ID missing",
  SUMSUB_VERIFICATION_REJECTED: "Identity verification was rejected",
  NEAR_SIGNATURE_INVALID: "NEAR signature verification failed",
  NEAR_SIGNATURE_MISSING: "Invalid or missing NEAR signature data",
  SIGNATURE_EXPIRED: "Signature expired",
  SIGNATURE_TIMESTAMP_INVALID: "Invalid signature timestamp",
  DUPLICATE_IDENTITY: "This identity has already been registered",
  ACCOUNT_ALREADY_VERIFIED: "This NEAR account is already verified",
  CONTRACT_PAUSED: "Verification is temporarily unavailable",
  STORAGE_FAILED: "Unable to finalize verification at this time",
  INTERNAL_ERROR: "Internal server error",
  VERIFICATION_ON_HOLD: "Verification requires manual review",
  VERIFICATION_REJECTED: "Verification was rejected",
  VERIFICATION_RETRY: "Please resubmit with clearer documents",
} as const

// ============================================================================
// Non-Retryable Errors
// ============================================================================

/**
 * Error codes that indicate non-recoverable issues.
 * Users cannot retry verification with the same account/identity.
 */
export const NON_RETRYABLE_ERRORS = [
  "DUPLICATE_IDENTITY",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",
  "VERIFICATION_REJECTED",
] as const

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

  if (message.includes("sumsub applicant already used") || message.includes("already registered")) {
    return "DUPLICATE_IDENTITY"
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

  if (message.includes("sumsub") || message.includes("applicant") || message.includes("user context data")) {
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
    case "DUPLICATE_IDENTITY":
      return "Already Verified"
    case "ACCOUNT_ALREADY_VERIFIED":
      return "Account Already Verified"
    case "CONTRACT_PAUSED":
      return "Verification Unavailable"
    case "SUMSUB_VERIFICATION_REJECTED":
      return "Verification Rejected"
    case "VERIFICATION_ON_HOLD":
      return "Verification Under Review"
    case "VERIFICATION_REJECTED":
      return "Verification Rejected"
    case "VERIFICATION_RETRY":
      return "Documents Need Resubmission"
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
    case "DUPLICATE_IDENTITY":
      return "This identity has already been used to verify another NEAR account. Each person can only verify one account."
    case "ACCOUNT_ALREADY_VERIFIED":
      return "This NEAR account is already verified. Connect a different account to continue."
    case "CONTRACT_PAUSED":
      return "Verification is temporarily unavailable. Please try again later."
    case "SUMSUB_VERIFICATION_REJECTED":
      return "Your identity verification was not approved. Please ensure your documents are clear and valid."
    case "VERIFICATION_ON_HOLD":
      return "Your documents are being reviewed by our team. This typically takes a few hours."
    case "VERIFICATION_REJECTED":
      return "Your verification could not be approved. Please contact support if you believe this is an error."
    case "VERIFICATION_RETRY":
      return "Please resubmit your documents with clearer images. Ensure your ID is fully visible and not blurry."
    default:
      // Check if it's a known error code from the schema
      if (errorCode in VERIFICATION_ERROR_MESSAGES) {
        return VERIFICATION_ERROR_MESSAGES[errorCode as VerificationErrorCode]
      }
      // Return the error code itself as last resort (may be a descriptive message)
      return fallbackMessage || errorCode
  }
}
