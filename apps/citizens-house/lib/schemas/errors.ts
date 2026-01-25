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
  // Signature validation
  "NEAR_SIGNATURE_INVALID",
  "SIGNATURE_EXPIRED",
  "SIGNATURE_TIMESTAMP_INVALID",

  // Contract errors (propagated via Redis)
  "DUPLICATE_IDENTITY",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",

  // Verification outcomes
  "VERIFICATION_ON_HOLD",
  "VERIFICATION_REJECTED",
  "VERIFICATION_RETRY",

  // API-specific error codes
  "INVALID_REQUEST",
  "TOKEN_GENERATION_FAILED",
  "WEBHOOK_SIGNATURE_INVALID",
  "WEBHOOK_PAYLOAD_INVALID",
  "MISSING_NEAR_METADATA",
  "NONCE_ALREADY_USED",
  "BACKEND_NOT_CONFIGURED",
  "STORAGE_FAILED",

  // Client-side error codes
  "TIMEOUT",
  "TOKEN_FETCH_FAILED",
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
  // Signature validation
  NEAR_SIGNATURE_INVALID: "NEAR signature verification failed",
  SIGNATURE_EXPIRED: "Signature expired",
  SIGNATURE_TIMESTAMP_INVALID: "Invalid signature timestamp",

  // Contract errors
  DUPLICATE_IDENTITY: "This identity has already been registered",
  ACCOUNT_ALREADY_VERIFIED: "This NEAR account is already verified",
  CONTRACT_PAUSED: "Verification is temporarily unavailable",

  // Verification outcomes
  VERIFICATION_ON_HOLD: "Verification requires manual review",
  VERIFICATION_REJECTED: "Verification was rejected",
  VERIFICATION_RETRY: "Please resubmit with clearer documents",

  // API-specific errors
  INVALID_REQUEST: "Invalid request format",
  TOKEN_GENERATION_FAILED: "Failed to generate access token",
  WEBHOOK_SIGNATURE_INVALID: "Invalid webhook signature",
  WEBHOOK_PAYLOAD_INVALID: "Invalid webhook payload",
  MISSING_NEAR_METADATA: "Missing NEAR account metadata",
  NONCE_ALREADY_USED: "Signature nonce already used",
  BACKEND_NOT_CONFIGURED: "Backend not configured",
  STORAGE_FAILED: "Failed to store verification",

  // Client-side errors
  TIMEOUT: "Verification is taking longer than expected",
  TOKEN_FETCH_FAILED: "Failed to initialize verification",
} as const

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Error codes that can be retried by the user.
 */
export const RETRYABLE_ERRORS = [
  "NEAR_SIGNATURE_INVALID",
  "SIGNATURE_EXPIRED",
  "SIGNATURE_TIMESTAMP_INVALID",
  "VERIFICATION_RETRY",
  "TIMEOUT",
  "TOKEN_FETCH_FAILED",
  "NONCE_ALREADY_USED",
] as const satisfies readonly VerificationErrorCode[]

export type RetryableErrorCode = (typeof RETRYABLE_ERRORS)[number]

/**
 * Error codes that indicate verification is on hold.
 */
export const HOLD_ERRORS = ["VERIFICATION_ON_HOLD"] as const satisfies readonly VerificationErrorCode[]

export type HoldErrorCode = (typeof HOLD_ERRORS)[number]

/**
 * Error codes that indicate non-recoverable issues.
 * Users cannot retry verification with the same account/identity.
 */
export const NON_RETRYABLE_ERRORS = [
  "DUPLICATE_IDENTITY",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",
  "VERIFICATION_REJECTED",
  "WEBHOOK_SIGNATURE_INVALID",
  "WEBHOOK_PAYLOAD_INVALID",
  "MISSING_NEAR_METADATA",
  "INVALID_REQUEST",
] as const

export type NonRetryableErrorCode = (typeof NON_RETRYABLE_ERRORS)[number]

/**
 * Internal/technical errors that indicate system issues.
 * Users should retry, but the issue is on our end.
 */
export const INTERNAL_ERRORS = [
  "TOKEN_GENERATION_FAILED",
  "BACKEND_NOT_CONFIGURED",
  "STORAGE_FAILED",
] as const satisfies readonly VerificationErrorCode[]

export type InternalErrorCode = (typeof INTERNAL_ERRORS)[number]

/**
 * Exhaustive error category mapping.
 * TypeScript will error if any VerificationErrorCode is not assigned a category.
 */
export const ERROR_CATEGORIES = {
  NEAR_SIGNATURE_INVALID: "retryable",
  SIGNATURE_EXPIRED: "retryable",
  SIGNATURE_TIMESTAMP_INVALID: "retryable",
  VERIFICATION_RETRY: "retryable",
  TIMEOUT: "retryable",
  TOKEN_FETCH_FAILED: "retryable",
  VERIFICATION_ON_HOLD: "hold",
  DUPLICATE_IDENTITY: "non-retryable",
  ACCOUNT_ALREADY_VERIFIED: "non-retryable",
  CONTRACT_PAUSED: "non-retryable",
  VERIFICATION_REJECTED: "non-retryable",
  WEBHOOK_SIGNATURE_INVALID: "non-retryable",
  WEBHOOK_PAYLOAD_INVALID: "non-retryable",
  MISSING_NEAR_METADATA: "non-retryable",
  NONCE_ALREADY_USED: "retryable",
  INVALID_REQUEST: "non-retryable",
  TOKEN_GENERATION_FAILED: "internal",
  BACKEND_NOT_CONFIGURED: "internal",
  STORAGE_FAILED: "internal",
} as const satisfies Record<VerificationErrorCode, "retryable" | "hold" | "non-retryable" | "internal">

export type ErrorCategory = (typeof ERROR_CATEGORIES)[VerificationErrorCode]

/**
 * Check if an error code indicates a non-retryable error.
 * Non-retryable errors cannot be resolved by the user trying again.
 */
export function isNonRetryableError(errorCode: string | null | undefined): boolean {
  return (
    errorCode !== null && errorCode !== undefined && NON_RETRYABLE_ERRORS.includes(errorCode as NonRetryableErrorCode)
  )
}

/**
 * Check if an error code indicates verification is on hold.
 * Hold errors show a dedicated "under review" step.
 */
export function isHoldError(errorCode: string | null | undefined): boolean {
  return errorCode === "VERIFICATION_ON_HOLD"
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
 * Returns null for unknown errors to allow webhook retries.
 */
export function mapContractErrorToCode(errorMessage: string): VerificationErrorCode | null {
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

  // Unknown contract/storage error - allow webhook retry
  return null
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
    // Non-retryable errors
    case "DUPLICATE_IDENTITY":
      return "Already Verified"
    case "ACCOUNT_ALREADY_VERIFIED":
      return "Account Already Verified"
    case "CONTRACT_PAUSED":
      return "Verification Unavailable"
    case "VERIFICATION_REJECTED":
      return "Verification Rejected"

    // Hold errors
    case "VERIFICATION_ON_HOLD":
      return "Verification Under Review"

    // Retryable errors
    case "VERIFICATION_RETRY":
      return "Documents Need Resubmission"
    case "NEAR_SIGNATURE_INVALID":
      return "Signature Verification Failed"
    case "SIGNATURE_EXPIRED":
      return "Signature Expired"
    case "SIGNATURE_TIMESTAMP_INVALID":
      return "Signature Expired"
    case "TIMEOUT":
      return "Verification Taking Longer"
    case "TOKEN_FETCH_FAILED":
      return "Connection Error"
    case "NONCE_ALREADY_USED":
      return "Signature Already Used"

    // Technical/internal errors (generic title)
    case "INVALID_REQUEST":
    case "TOKEN_GENERATION_FAILED":
    case "WEBHOOK_SIGNATURE_INVALID":
    case "WEBHOOK_PAYLOAD_INVALID":
    case "MISSING_NEAR_METADATA":
    case "BACKEND_NOT_CONFIGURED":
    case "STORAGE_FAILED":
      return "Something Went Wrong"

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
    case "VERIFICATION_ON_HOLD":
      return "Your documents are being reviewed by our team. This typically takes a few hours."
    case "VERIFICATION_REJECTED":
      return "Your verification could not be approved. Please contact support if you believe this is an error."
    case "VERIFICATION_RETRY":
      return "Please resubmit your documents with clearer images. Ensure your ID is fully visible and not blurry."
    case "TIMEOUT":
      return "Verification is taking longer than expected. Please check back later."
    case "TOKEN_FETCH_FAILED":
      return "Failed to initialize verification. Please try again."
    case "NEAR_SIGNATURE_INVALID":
      return "We couldn't verify your wallet signature. Please try signing the message again."
    case "SIGNATURE_EXPIRED":
      return "Your signature has expired. Please sign a new message to continue."
    case "SIGNATURE_TIMESTAMP_INVALID":
      return "Your signature has expired. Please sign a new message to continue."
    case "NONCE_ALREADY_USED":
      return "This signature has already been used. Please sign a new message to continue."
    case "INVALID_REQUEST":
    case "TOKEN_GENERATION_FAILED":
    case "WEBHOOK_SIGNATURE_INVALID":
    case "WEBHOOK_PAYLOAD_INVALID":
    case "MISSING_NEAR_METADATA":
    case "BACKEND_NOT_CONFIGURED":
    case "STORAGE_FAILED":
      return "Something went wrong on our end. Please try again, or contact support if the issue persists."
    default:
      // Check if it's a known error code from the schema
      if (errorCode in VERIFICATION_ERROR_MESSAGES) {
        return VERIFICATION_ERROR_MESSAGES[errorCode as VerificationErrorCode]
      }
      // Return the error code itself as last resort (may be a descriptive message)
      return fallbackMessage || errorCode
  }
}
