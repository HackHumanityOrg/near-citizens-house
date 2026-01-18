/**
 * Type definitions for wide event logging
 *
 * Each request produces a single comprehensive event with all business context,
 * timing breakdowns, and PostHog user correlation.
 */

export type LogLevel = "info" | "warn" | "error"

export type Outcome =
  | "success"
  | "validation_error"
  | "signature_error"
  | "proof_error"
  | "storage_error"
  | "internal_error"
  | "pending"
  | "expired"
  | "not_found"
  | "verified"
  | "not_verified"
  | "partial"
  | "error"

export type ErrorStage =
  | "request_validation"
  | "self_verify"
  | "self_verify_response"
  | "signature_parse"
  | "signature_validate"
  | "storage"
  | "config"
  | "internal"

export type Platform = "desktop" | "mobile" | "unknown"

// Timer names per event type
export type VerifyTimers =
  | "parseBody"
  | "selfxyzVerify"
  | "signatureValidation"
  | "nonceReservation"
  | "contractStorage"
  | "sessionUpdate"
  | "keyPoolSelection"

export type StatusTimers = "redisLookup" | "contractFallback"

export type GetVerificationsTimers = "contractFetch" | "zkVerification"

export type CheckIsVerifiedTimers = "contractCall"

/**
 * Error context for failed requests
 */
export interface ErrorContext {
  code?: string
  message?: string
  isRetryable?: boolean
  stage?: ErrorStage
}

/**
 * Stage tracking for request progress
 */
export interface StageReached {
  parsed?: boolean
  signatureValidated?: boolean
  proofValidated?: boolean
  nonceReserved?: boolean
  storedOnChain?: boolean
}

/**
 * External service call tracking
 */
export interface ExternalCalls {
  selfxyzCalled?: boolean
  selfxyzSuccess?: boolean
  nearRpcCalled?: boolean
  nearRpcSuccess?: boolean
  redisCalled?: boolean
  redisSuccess?: boolean
  contractCalled?: boolean
  contractSuccess?: boolean
  celoRpcCalled?: boolean
  celoRpcSuccess?: boolean
}

/**
 * Contract operation details
 */
export interface ContractContext {
  contractId?: string
  methodCalled?: string
  rpcRetries?: number
  usedPollingFallback?: boolean
}

/**
 * Key pool context for backend transactions
 */
export interface KeyPoolContext {
  index?: number
}

/**
 * Base event fields shared by all events
 */
export interface BaseEventFields {
  requestId: string
  timestamp?: number
  distinctId?: string | null
  sessionId?: string | null
  platform?: Platform
}

/**
 * Verify request event - /api/verification/verify
 */
export interface VerifyRequestEvent extends BaseEventFields {
  route: "/api/verification/verify"
  method: "POST"
  nearAccountId?: string
  attestationType?: string
  attestationId?: number
  nationality?: string
  hasProof?: boolean
  hasPublicSignals?: boolean
  hasUserContextData?: boolean
  signaturePresent?: boolean
  signatureTimestampAge?: number
  stageReached?: StageReached
  timings?: Partial<Record<VerifyTimers | "total", number>>
  externalCalls?: ExternalCalls
  contract?: ContractContext
  keyPool?: KeyPoolContext
  outcome?: Outcome
  statusCode?: number
  error?: ErrorContext
}

/**
 * Status request event - /api/verification/status
 */
export interface StatusRequestEvent extends BaseEventFields {
  route: "/api/verification/status"
  method: "GET"
  nearAccountId?: string
  sessionId?: string | null
  sessionFound?: boolean
  sessionStatus?: string
  sessionAge?: number
  usedContractFallback?: boolean
  contractCheckSuccess?: boolean
  timings?: Partial<Record<StatusTimers | "total", number>>
  outcome?: Outcome
  statusCode?: number
  error?: ErrorContext
}

/**
 * Server action event - getVerificationsWithStatus
 */
export interface GetVerificationsEvent extends BaseEventFields {
  action: "getVerificationsWithStatus"
  page?: number
  pageSize?: number
  verificationsRequested?: number
  verificationsReturned?: number
  totalVerifications?: number
  zkVerificationAttempted?: number
  zkVerificationSucceeded?: number
  zkVerificationFailed?: number
  signatureVerificationAttempted?: number
  signatureVerificationSucceeded?: number
  signatureVerificationFailed?: number
  timings?: Partial<Record<GetVerificationsTimers | "total", number>>
  outcome?: Outcome
}

/**
 * Server action event - checkIsVerified
 */
export interface CheckIsVerifiedEvent extends BaseEventFields {
  action: "checkIsVerified"
  nearAccountId?: string
  isVerified?: boolean
  timings?: Partial<Record<CheckIsVerifiedTimers | "total", number>>
  outcome?: Outcome
}

/**
 * Union type for all wide events
 */
export type WideEvent = VerifyRequestEvent | StatusRequestEvent | GetVerificationsEvent | CheckIsVerifiedEvent
