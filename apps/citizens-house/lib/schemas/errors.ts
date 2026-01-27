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

// ==========================================================================
// Status Subsets (for verification state)
// ==========================================================================

export const verificationStatusErrorCodes = [
  "VERIFICATION_ON_HOLD",
  "VERIFICATION_REJECTED",
  "VERIFICATION_RETRY",
  "DUPLICATE_IDENTITY",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",
] as const satisfies ReadonlyArray<VerificationErrorCode>

export const verificationStatusFailureCodes = [
  "VERIFICATION_REJECTED",
  "VERIFICATION_RETRY",
  "DUPLICATE_IDENTITY",
  "ACCOUNT_ALREADY_VERIFIED",
  "CONTRACT_PAUSED",
] as const satisfies ReadonlyArray<VerificationErrorCode>

export const verificationStatusErrorCodeSchema = z.enum(verificationStatusErrorCodes)
export type VerificationStatusErrorCode = z.infer<typeof verificationStatusErrorCodeSchema>

export const verificationStatusFailureCodeSchema = z.enum(verificationStatusFailureCodes)
export type VerificationStatusFailureCode = z.infer<typeof verificationStatusFailureCodeSchema>

// ============================================================================
// Error Categories & Definitions
// ============================================================================

export type ErrorCategory = "retryable" | "hold" | "non-retryable" | "internal"

export interface ErrorDefinition {
  code: VerificationErrorCode
  title: string
  description: string
  category: ErrorCategory
  apiMessage: string
}

/**
 * Single source of truth for all verification errors.
 * Each error has a title, description, category, and API message.
 */
export const VERIFICATION_ERRORS = {
  // Signature validation - retryable
  NEAR_SIGNATURE_INVALID: {
    code: "NEAR_SIGNATURE_INVALID",
    title: "Signature Verification Failed",
    description: "We couldn't verify your wallet signature. Please try signing the message again.",
    category: "retryable",
    apiMessage: "NEAR signature verification failed",
  },
  SIGNATURE_EXPIRED: {
    code: "SIGNATURE_EXPIRED",
    title: "Signature Expired",
    description: "Your signature has expired. Please sign a new message to continue.",
    category: "retryable",
    apiMessage: "Signature expired",
  },
  SIGNATURE_TIMESTAMP_INVALID: {
    code: "SIGNATURE_TIMESTAMP_INVALID",
    title: "Signature Expired",
    description: "Your signature has expired. Please sign a new message to continue.",
    category: "retryable",
    apiMessage: "Invalid signature timestamp",
  },

  // Contract errors - non-retryable
  DUPLICATE_IDENTITY: {
    code: "DUPLICATE_IDENTITY",
    title: "Already Verified",
    description:
      "This identity has already been used to verify another NEAR account. Each person can only verify one account.",
    category: "non-retryable",
    apiMessage: "This identity has already been registered",
  },
  ACCOUNT_ALREADY_VERIFIED: {
    code: "ACCOUNT_ALREADY_VERIFIED",
    title: "Account Already Verified",
    description: "This NEAR account is already verified. Connect a different account to continue.",
    category: "non-retryable",
    apiMessage: "This NEAR account is already verified",
  },
  CONTRACT_PAUSED: {
    code: "CONTRACT_PAUSED",
    title: "Verification Unavailable",
    description: "Verification is temporarily unavailable. Please try again later.",
    category: "non-retryable",
    apiMessage: "Verification is temporarily unavailable",
  },

  // Verification outcomes
  VERIFICATION_ON_HOLD: {
    code: "VERIFICATION_ON_HOLD",
    title: "Verification Under Review",
    description: "Your documents are being reviewed by our team. This typically takes a few hours.",
    category: "hold",
    apiMessage: "Verification requires manual review",
  },
  VERIFICATION_REJECTED: {
    code: "VERIFICATION_REJECTED",
    title: "Verification Rejected",
    description: "Your verification could not be approved. Please contact support if you believe this is an error.",
    category: "non-retryable",
    apiMessage: "Verification was rejected",
  },
  VERIFICATION_RETRY: {
    code: "VERIFICATION_RETRY",
    title: "Documents Need Resubmission",
    description: "Please resubmit your documents with clearer images. Ensure your ID is fully visible and not blurry.",
    category: "retryable",
    apiMessage: "Please resubmit with clearer documents",
  },

  // API-specific errors
  INVALID_REQUEST: {
    code: "INVALID_REQUEST",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "non-retryable",
    apiMessage: "Invalid request format",
  },
  TOKEN_GENERATION_FAILED: {
    code: "TOKEN_GENERATION_FAILED",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "internal",
    apiMessage: "Failed to generate access token",
  },
  WEBHOOK_SIGNATURE_INVALID: {
    code: "WEBHOOK_SIGNATURE_INVALID",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "non-retryable",
    apiMessage: "Invalid webhook signature",
  },
  WEBHOOK_PAYLOAD_INVALID: {
    code: "WEBHOOK_PAYLOAD_INVALID",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "non-retryable",
    apiMessage: "Invalid webhook payload",
  },
  MISSING_NEAR_METADATA: {
    code: "MISSING_NEAR_METADATA",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "non-retryable",
    apiMessage: "Missing NEAR account metadata",
  },
  NONCE_ALREADY_USED: {
    code: "NONCE_ALREADY_USED",
    title: "Signature Already Used",
    description: "This signature has already been used. Please sign a new message to continue.",
    category: "retryable",
    apiMessage: "Signature nonce already used",
  },
  BACKEND_NOT_CONFIGURED: {
    code: "BACKEND_NOT_CONFIGURED",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "internal",
    apiMessage: "Backend not configured",
  },
  STORAGE_FAILED: {
    code: "STORAGE_FAILED",
    title: "Something Went Wrong",
    description: "Something went wrong on our end. Please try again, or contact support if the issue persists.",
    category: "internal",
    apiMessage: "Failed to store verification",
  },

  // Client-side errors - retryable
  TIMEOUT: {
    code: "TIMEOUT",
    title: "Verification Taking Longer",
    description: "Verification is taking longer than expected. Please check back later.",
    category: "retryable",
    apiMessage: "Verification is taking longer than expected",
  },
  TOKEN_FETCH_FAILED: {
    code: "TOKEN_FETCH_FAILED",
    title: "Connection Error",
    description: "Failed to initialize verification. Please try again.",
    category: "retryable",
    apiMessage: "Failed to initialize verification",
  },
} as const satisfies Record<VerificationErrorCode, ErrorDefinition>

/**
 * Derived error category mapping for backward compatibility.
 * Used by debug menu to group errors by category.
 */
export const ERROR_CATEGORIES = Object.fromEntries(
  Object.entries(VERIFICATION_ERRORS).map(([code, def]) => [code, def.category]),
) as Record<VerificationErrorCode, ErrorCategory>

/**
 * Check if an error code indicates a non-retryable error.
 * Non-retryable errors cannot be resolved by the user trying again.
 */
export function isNonRetryableError(errorCode: string | null | undefined): boolean {
  if (!errorCode || !(errorCode in VERIFICATION_ERRORS)) return false
  return VERIFICATION_ERRORS[errorCode as VerificationErrorCode].category === "non-retryable"
}

/**
 * Check if an error code indicates verification is on hold.
 * Hold errors show a dedicated "under review" step.
 */
export function isHoldError(errorCode: string | null | undefined): boolean {
  return errorCode === "VERIFICATION_ON_HOLD"
}

// ============================================================================
// Error Response Schema
// ============================================================================

/**
 * Validation issue schema for structured error responses.
 */
export const validationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
  code: z.string().optional(),
})

export type ValidationIssue = z.infer<typeof validationIssueSchema>

/**
 * Verification error response schema.
 * Used to validate API error responses on both server and client.
 */
export const verificationErrorResponseSchema = z.object({
  status: z.literal("error"),
  result: z.literal(false),
  code: verificationErrorCodeSchema,
  reason: z.string(),
  issues: z.array(validationIssueSchema).optional(),
})

export type VerificationErrorResponse = z.infer<typeof verificationErrorResponseSchema>

// Legacy type alias for backward compatibility
export type VerificationError = VerificationErrorResponse

/**
 * Create a typed verification error response.
 */
export function createVerificationError(
  code: VerificationErrorCode,
  details?: string,
  issues?: ValidationIssue[],
): VerificationError {
  const { apiMessage } = VERIFICATION_ERRORS[code]
  return {
    status: "error",
    result: false,
    code,
    reason: details ? `${apiMessage}: ${details}` : apiMessage,
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
  if (!errorCode || !(errorCode in VERIFICATION_ERRORS)) {
    return "Verification Failed"
  }
  return VERIFICATION_ERRORS[errorCode as VerificationErrorCode].title
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
  if (!(errorCode in VERIFICATION_ERRORS)) {
    return fallbackMessage || errorCode
  }
  return VERIFICATION_ERRORS[errorCode as VerificationErrorCode].description
}
