/**
 * Type definitions for wide event logging
 *
 * This file re-exports all types from the Zod-based logger schemas.
 * The schemas provide both runtime validation capability and compile-time type safety.
 */

export type {
  // Enums
  LogLevel,
  Outcome,
  ErrorStage,
  Platform,
  // Event types
  VerifyRequestEvent,
  StatusRequestEvent,
  GetVerificationsEvent,
  CheckIsVerifiedEvent,
  WideEvent,
  // Timer types
  VerifyTimers,
  StatusTimers,
  GetVerificationsTimers,
  CheckIsVerifiedTimers,
  // Type mappings
  EventTimers,
} from "../schemas/logger"
