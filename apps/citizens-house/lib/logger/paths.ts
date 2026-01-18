/**
 * Path type definitions for strongly-typed RequestContext
 *
 * Each event type has its own path union that defines all valid field paths
 * that can be set using dot notation (e.g., "error.code", "stageReached.parsed").
 */

import type {
  Outcome,
  ErrorStage,
  VerifyRequestEvent,
  StatusRequestEvent,
  GetVerificationsEvent,
  CheckIsVerifiedEvent,
  WideEvent,
  VerifyTimers,
  StatusTimers,
  GetVerificationsTimers,
  CheckIsVerifiedTimers,
} from "./types"

// ============================================================================
// Path unions for each event type
// ============================================================================

// Base event fields shared by route events
type BaseRoutePaths = "route" | "method" | "distinctId" | "platform"

// Base event fields shared by action events
type BaseActionPaths = "action" | "distinctId" | "platform"

export type VerifyPaths =
  // Base fields
  | BaseRoutePaths
  // Top-level fields
  | "nearAccountId"
  | "attestationType"
  | "attestationId"
  | "nationality"
  | "hasProof"
  | "hasPublicSignals"
  | "hasUserContextData"
  | "signaturePresent"
  | "signatureTimestampAge"
  | "sessionId"
  | "outcome"
  | "statusCode"
  // Nested - stageReached
  | "stageReached.parsed"
  | "stageReached.signatureValidated"
  | "stageReached.proofValidated"
  | "stageReached.nonceReserved"
  | "stageReached.storedOnChain"
  // Nested - externalCalls
  | "externalCalls.selfxyzCalled"
  | "externalCalls.selfxyzSuccess"
  | "externalCalls.nearRpcCalled"
  | "externalCalls.nearRpcSuccess"
  | "externalCalls.redisCalled"
  | "externalCalls.redisSuccess"
  | "externalCalls.contractCalled"
  | "externalCalls.contractSuccess"
  // Nested - error
  | "error.code"
  | "error.message"
  | "error.isRetryable"
  | "error.stage"
  // Nested - contract
  | "contract.contractId"
  | "contract.methodCalled"
  // Nested - keyPool
  | "keyPool.index"

export type StatusPaths =
  // Base fields
  | BaseRoutePaths
  // Top-level fields
  | "nearAccountId"
  | "sessionId"
  | "sessionFound"
  | "sessionStatus"
  | "sessionAge"
  | "usedContractFallback"
  | "contractCheckSuccess"
  | "outcome"
  | "statusCode"
  // Nested - error
  | "error.code"
  | "error.message"

export type GetVerificationsPaths =
  // Base fields
  | BaseActionPaths
  // Top-level fields
  | "page"
  | "pageSize"
  | "verificationsRequested"
  | "verificationsReturned"
  | "totalVerifications"
  | "zkVerificationAttempted"
  | "zkVerificationSucceeded"
  | "zkVerificationFailed"
  | "signatureVerificationAttempted"
  | "signatureVerificationSucceeded"
  | "signatureVerificationFailed"
  | "outcome"

export type CheckIsVerifiedPaths =
  // Base fields
  | BaseActionPaths
  // Top-level fields
  | "nearAccountId"
  | "isVerified"
  | "outcome"

// ============================================================================
// Path value type mapping - maps paths to their value types
// ============================================================================

/**
 * Maps a path to its expected value type for VerifyRequestEvent
 */
export type VerifyPathValue<P extends VerifyPaths> = P extends "outcome"
  ? Outcome
  : P extends
        | "stageReached.parsed"
        | "stageReached.signatureValidated"
        | "stageReached.proofValidated"
        | "stageReached.nonceReserved"
        | "stageReached.storedOnChain"
        | "externalCalls.selfxyzCalled"
        | "externalCalls.selfxyzSuccess"
        | "externalCalls.nearRpcCalled"
        | "externalCalls.nearRpcSuccess"
        | "externalCalls.redisCalled"
        | "externalCalls.redisSuccess"
        | "externalCalls.contractCalled"
        | "externalCalls.contractSuccess"
        | "hasProof"
        | "hasPublicSignals"
        | "hasUserContextData"
        | "signaturePresent"
        | "error.isRetryable"
    ? boolean
    : P extends "attestationId" | "signatureTimestampAge" | "statusCode" | "keyPool.index"
      ? number
      : P extends "error.stage"
        ? ErrorStage
        : string | null

/**
 * Maps a path to its expected value type for StatusRequestEvent
 */
export type StatusPathValue<P extends StatusPaths> = P extends "outcome"
  ? Outcome
  : P extends "sessionFound" | "usedContractFallback" | "contractCheckSuccess"
    ? boolean
    : P extends "statusCode" | "sessionAge"
      ? number
      : string | null

/**
 * Maps a path to its expected value type for GetVerificationsEvent
 */
export type GetVerificationsPathValue<P extends GetVerificationsPaths> = P extends "outcome"
  ? Outcome
  : P extends
        | "page"
        | "pageSize"
        | "verificationsRequested"
        | "verificationsReturned"
        | "totalVerifications"
        | "zkVerificationAttempted"
        | "zkVerificationSucceeded"
        | "zkVerificationFailed"
        | "signatureVerificationAttempted"
        | "signatureVerificationSucceeded"
        | "signatureVerificationFailed"
    ? number
    : string

/**
 * Maps a path to its expected value type for CheckIsVerifiedEvent
 */
export type CheckIsVerifiedPathValue<P extends CheckIsVerifiedPaths> = P extends "outcome"
  ? Outcome
  : P extends "isVerified"
    ? boolean
    : string

// ============================================================================
// Event-to-paths and event-to-timers type mappings
// ============================================================================

/**
 * Maps an event type to its valid paths
 */
export type EventPaths<E extends WideEvent> = E extends VerifyRequestEvent
  ? VerifyPaths
  : E extends StatusRequestEvent
    ? StatusPaths
    : E extends GetVerificationsEvent
      ? GetVerificationsPaths
      : E extends CheckIsVerifiedEvent
        ? CheckIsVerifiedPaths
        : never

/**
 * Maps an event type to its valid timer names
 */
export type EventTimers<E extends WideEvent> = E extends VerifyRequestEvent
  ? VerifyTimers
  : E extends StatusRequestEvent
    ? StatusTimers
    : E extends GetVerificationsEvent
      ? GetVerificationsTimers
      : E extends CheckIsVerifiedEvent
        ? CheckIsVerifiedTimers
        : never

/**
 * Maps an event type and path to the value type
 */
export type PathValue<E extends WideEvent, P extends EventPaths<E>> = E extends VerifyRequestEvent
  ? P extends VerifyPaths
    ? VerifyPathValue<P>
    : never
  : E extends StatusRequestEvent
    ? P extends StatusPaths
      ? StatusPathValue<P>
      : never
    : E extends GetVerificationsEvent
      ? P extends GetVerificationsPaths
        ? GetVerificationsPathValue<P>
        : never
      : E extends CheckIsVerifiedEvent
        ? P extends CheckIsVerifiedPaths
          ? CheckIsVerifiedPathValue<P>
          : never
        : never
