/**
 * SumSub Schemas - KYC verification request/response types and webhook payloads.
 *
 * SumSub provides identity verification via document scanning and liveness checks.
 * The WebSDK handles the verification flow client-side, and webhooks notify
 * our backend when verification is complete.
 */
import { z } from "zod"
import { nearAccountIdSchema } from "./near"

// ==============================================================================
// Access Token API
// ==============================================================================

/**
 * Request to generate a SumSub access token.
 * Frontend sends this after completing NEAR wallet signature.
 */
export const sumsubTokenRequestSchema = z.object({
  /** NEAR signature data to attach as metadata */
  nearSignature: z.object({
    accountId: nearAccountIdSchema,
    signature: z.string(),
    publicKey: z.string(),
    nonce: z.string(),
    timestamp: z.number(),
  }),
})

export type SumSubTokenRequest = z.infer<typeof sumsubTokenRequestSchema>

/**
 * Response from access token generation.
 */
export const sumsubTokenResponseSchema = z.object({
  /** SumSub access token for WebSDK initialization */
  token: z.string(),
  /** External user ID (NEAR account ID) used in SumSub */
  externalUserId: z.string(),
})

export type SumSubTokenResponse = z.infer<typeof sumsubTokenResponseSchema>

// ==============================================================================
// Webhook Payloads
// ==============================================================================

/**
 * SumSub applicant review status.
 */
export const reviewAnswerSchema = z.enum([
  "GREEN", // Approved
  "RED", // Rejected
  "YELLOW", // Needs manual review
])

export type ReviewAnswer = z.infer<typeof reviewAnswerSchema>

/**
 * SumSub rejection type.
 * RETRY = user can resubmit documents
 * FINAL = permanent rejection, cannot retry
 */
export const reviewRejectTypeSchema = z.enum(["RETRY", "FINAL"])

export type ReviewRejectType = z.infer<typeof reviewRejectTypeSchema>

/**
 * Review result details from SumSub webhook.
 */
export const reviewResultSchema = z.object({
  reviewAnswer: reviewAnswerSchema,
  reviewRejectType: reviewRejectTypeSchema.optional(),
  rejectLabels: z.array(z.string()).optional(),
  reviewResult: z.string().optional(),
  moderationComment: z.string().optional(),
  clientComment: z.string().optional(),
})

export type ReviewResult = z.infer<typeof reviewResultSchema>

/**
 * SumSub webhook payload for applicantReviewed event.
 * This is the main webhook we handle for verification completion.
 */
export const sumsubWebhookPayloadSchema = z.object({
  /** Webhook event type */
  type: z.string(),
  /** SumSub applicant ID */
  applicantId: z.string(),
  /** Unique inspection ID */
  inspectionId: z.string().optional(),
  /** Correlation ID for tracking */
  correlationId: z.string().optional(),
  /** Webhook level name (e.g., "id-and-liveness") */
  levelName: z.string().optional(),
  /** External user ID (we use NEAR account ID) */
  externalUserId: z.string(),
  /** Type of external user ID */
  externalUserIdType: z.string().optional(),
  /** Review result (present for applicantReviewed events) */
  reviewResult: reviewResultSchema.optional(),
  /** Review status */
  reviewStatus: z.string().optional(),
  /** Timestamp of the event */
  createdAtMs: z.string().optional(),
  createdAt: z.string().optional(),
  /** Sandbox mode indicator */
  sandboxMode: z.boolean().optional(),
})

export type SumSubWebhookPayload = z.infer<typeof sumsubWebhookPayloadSchema>

/**
 * Applicant reviewed webhook - the primary webhook we process.
 */
export const applicantReviewedWebhookSchema = sumsubWebhookPayloadSchema.extend({
  type: z.literal("applicantReviewed"),
  reviewResult: reviewResultSchema,
})

export type ApplicantReviewedWebhook = z.infer<typeof applicantReviewedWebhookSchema>

// ==============================================================================
// Applicant Metadata
// ==============================================================================

/**
 * Metadata we store on the SumSub applicant.
 * This links the verification to the NEAR account.
 */
export const applicantMetadataSchema = z.object({
  near_account_id: nearAccountIdSchema,
  near_signature: z.string(),
  near_public_key: z.string(),
  near_nonce: z.string(),
  near_timestamp: z.string(),
})

export type ApplicantMetadata = z.infer<typeof applicantMetadataSchema>

// ==============================================================================
// Verification Data
// ==============================================================================

/**
 * SumSub-based verification data (replaces Self.xyz nullifier-based data).
 */
export const sumsubVerificationDataSchema = z.object({
  nearAccountId: nearAccountIdSchema,
})

export type SumSubVerificationData = z.infer<typeof sumsubVerificationDataSchema>

/**
 * Verification summary for API responses.
 */
export const sumsubVerificationSummarySchema = z.object({
  nearAccountId: nearAccountIdSchema,
  verifiedAt: z.number(),
})

export type SumSubVerificationSummary = z.output<typeof sumsubVerificationSummarySchema>

// ==============================================================================
// SumSub API Response Types
// ==============================================================================

/**
 * Access token response from SumSub API.
 */
export const sumsubAccessTokenApiResponseSchema = z.object({
  token: z.string(),
  userId: z.string(),
})

export type SumSubAccessTokenApiResponse = z.infer<typeof sumsubAccessTokenApiResponseSchema>

/**
 * Metadata item structure for SumSub API.
 */
export const sumsubMetadataItemSchema = z.object({
  key: z.string(),
  value: z.string(),
})

export type SumSubMetadataItem = z.infer<typeof sumsubMetadataItemSchema>

/**
 * Applicant data from SumSub API.
 */
export const sumsubApplicantSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  externalUserId: z.string().optional(),
  review: z
    .object({
      reviewStatus: z.string().optional(),
      reviewResult: reviewResultSchema.optional(),
    })
    .optional(),
  metadata: z.array(sumsubMetadataItemSchema).optional(),
})

export type SumSubApplicant = z.infer<typeof sumsubApplicantSchema>

// ==============================================================================
// WebSDK Types (for @sumsub/websdk-react which lacks TypeScript definitions)
// @see https://docs.sumsub.com/docs/websdk-messages
// ==============================================================================

/**
 * All known WebSDK message event types.
 * Events are prefixed with "idCheck." in the SDK.
 */
export type SumSubWebSdkMessageType =
  | "idCheck.onReady"
  | "idCheck.onInitialized"
  | "idCheck.onStepInitiated"
  | "idCheck.onStepCompleted"
  | "idCheck.onLivenessCompleted"
  | "idCheck.onApplicantLoaded"
  | "idCheck.onApplicantSubmitted"
  | "idCheck.onApplicantResubmitted"
  | "idCheck.onApplicantStatusChanged"
  | "idCheck.onApplicantActionLoaded"
  | "idCheck.onApplicantActionSubmitted"
  | "idCheck.onApplicantActionStatusChanged"
  | "idCheck.onApplicantActionCompleted"
  | "idCheck.onApplicantLevelChanged"
  | "idCheck.onError"
  | "idCheck.onResize"
  | "idCheck.onUploadError"
  | "idCheck.onUploadWarning"
  | "idCheck.onNavigationUiControlsStateChanged"
  | "idCheck.onVideoIdentCallStarted"
  | "idCheck.onVideoIdentModeratorJoined"
  | "idCheck.onVideoIdentCompleted"
  | "idCheck.moduleResultPresented"
  // Legacy/undocumented events we've seen in practice
  | "idCheck.applicantStatus"

/**
 * Payload for idCheck.onApplicantLoaded event.
 */
export interface SumSubApplicantLoadedPayload {
  applicantId: string
}

/**
 * Payload for idCheck.onStepInitiated event.
 */
export interface SumSubStepInitiatedPayload {
  idDocSetType: string
  types: string[]
}

/**
 * Payload for idCheck.onStepCompleted event.
 */
export interface SumSubStepCompletedPayload {
  idDocSetType: string
}

/**
 * Payload for idCheck.onLivenessCompleted event.
 */
export interface SumSubLivenessCompletedPayload {
  answer: ReviewAnswer
  allowContinuing: boolean
}

/**
 * Payload for idCheck.onApplicantStatusChanged event.
 */
export interface SumSubApplicantStatusChangedPayload {
  reprocessing?: boolean
  levelName?: string
  createDate?: string
  expireDate?: string
  reviewStatus?: string
  reviewResult?: {
    reviewAnswer?: ReviewAnswer
    reviewRejectType?: ReviewRejectType
    rejectLabels?: string[]
  }
  autoChecked?: boolean
}

/**
 * Payload for idCheck.onError event.
 */
export interface SumSubErrorPayload {
  code: string
  error: string
  reason?: string
}

/**
 * Payload for idCheck.onResize event.
 */
export interface SumSubResizePayload {
  height: number
}

/**
 * Payload for idCheck.moduleResultPresented event.
 */
export interface SumSubModuleResultPayload {
  answer: ReviewAnswer
}

/**
 * Payload for idCheck.onUploadError and idCheck.onUploadWarning events.
 */
export interface SumSubUploadMessagePayload {
  code: string
  msg: string
}

/**
 * Payload for idCheck.onApplicantActionCompleted event.
 */
export interface SumSubApplicantActionCompletedPayload {
  action: string
  applicantActionId: string
  answer: ReviewAnswer
}

/**
 * Payload for idCheck.onApplicantLevelChanged event.
 */
export interface SumSubApplicantLevelChangedPayload {
  levelName: string
}

/**
 * Union of all possible WebSDK message payloads.
 * Use type narrowing based on the message type.
 */
export type SumSubWebSdkPayload =
  | SumSubApplicantLoadedPayload
  | SumSubStepInitiatedPayload
  | SumSubStepCompletedPayload
  | SumSubLivenessCompletedPayload
  | SumSubApplicantStatusChangedPayload
  | SumSubErrorPayload
  | SumSubResizePayload
  | SumSubModuleResultPayload
  | SumSubUploadMessagePayload
  | SumSubApplicantActionCompletedPayload
  | SumSubApplicantLevelChangedPayload
  | Record<string, unknown>
  | undefined

/**
 * WebSDK configuration options.
 * @see https://docs.sumsub.com/docs/get-started-with-web-sdk
 */
export interface SumSubWebSdkConfig {
  /** UI language in ISO 639-1 format (default: "en") */
  lang?: string
  /** Translation name override */
  translationName?: string
  /** Customization name override */
  customizationName?: string
  /** Alpha-3 country code for pre-selection */
  country?: string
  /** Theme mode */
  theme?: "light" | "dark"
  /** Pre-filled email for applicant */
  email?: string
  /** Pre-filled phone for applicant */
  phone?: string
  /** Document type definitions */
  documentDefinitions?: Record<string, unknown>
  /** Auto-select document definitions */
  autoSelectDocumentDefinitions?: boolean
  /** Enable controlled back navigation */
  controlledNavigationBack?: boolean
}

/**
 * WebSDK display options.
 */
export interface SumSubWebSdkOptions {
  /** Add viewport meta tag (default: true) */
  addViewportTag?: boolean
  /** Adapt iframe height to content (default: true) */
  adaptIframeHeight?: boolean
  /** Enable scroll into view (default: true) */
  enableScrollIntoView?: boolean
}

/**
 * Props for the SumSub WebSDK React component.
 * @see https://www.npmjs.com/package/@sumsub/websdk-react
 */
export interface SumSubWebSdkProps {
  /** Access token from backend */
  accessToken: string
  /** Called when token expires, must return fresh token */
  expirationHandler: () => Promise<string>
  /** SDK configuration */
  config: SumSubWebSdkConfig
  /** Display options */
  options?: SumSubWebSdkOptions
  /** Called when SDK generates activity messages */
  onMessage: (type: SumSubWebSdkMessageType | string, payload: SumSubWebSdkPayload) => void
  /** Called when SDK encounters errors */
  onError: (error: Error) => void
}

// ==============================================================================
// Webhook Status (for intermediate states before on-chain storage)
// ==============================================================================

/**
 * Intermediate webhook status stored in Redis.
 * Used to communicate webhook results to the frontend before on-chain finalization.
 */
export const webhookStatusCodeSchema = z.enum([
  "ON_HOLD", // Requires manual review (applicantOnHold webhook)
  "REJECTED", // RED with FINAL - cannot retry
  "RETRY", // RED with RETRY - user can resubmit documents
  // Contract storage errors (propagated via Redis when GREEN but contract fails)
  "DUPLICATE_IDENTITY", // Same identity already used
  "ACCOUNT_ALREADY_VERIFIED", // NEAR account already verified
  "CONTRACT_PAUSED", // Contract is paused
])

export type WebhookStatusCode = z.infer<typeof webhookStatusCodeSchema>

/**
 * Full webhook status response from Redis.
 */
export const webhookStatusSchema = z.object({
  status: webhookStatusCodeSchema,
  updatedAt: z.number(),
  rejectLabels: z.array(z.string()).optional(),
  moderationComment: z.string().optional(),
})

export type WebhookStatus = z.infer<typeof webhookStatusSchema>

// ==============================================================================
// Verification Status API Response
// ==============================================================================

/**
 * Response schema for the /api/verification/status endpoint.
 * Combines on-chain status with intermediate webhook states.
 */
export const verificationStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("APPROVED") }),
  z.object({ status: z.literal("ON_HOLD"), updatedAt: z.number() }),
  z.object({
    status: z.literal("REJECTED"),
    updatedAt: z.number(),
    rejectLabels: z.array(z.string()).optional(),
    moderationComment: z.string().optional(),
  }),
  z.object({
    status: z.literal("RETRY"),
    updatedAt: z.number(),
    rejectLabels: z.array(z.string()).optional(),
    moderationComment: z.string().optional(),
  }),
  // Contract storage errors
  z.object({ status: z.literal("DUPLICATE_IDENTITY"), updatedAt: z.number() }),
  z.object({ status: z.literal("ACCOUNT_ALREADY_VERIFIED"), updatedAt: z.number() }),
  z.object({ status: z.literal("CONTRACT_PAUSED"), updatedAt: z.number() }),
  z.object({ status: z.literal("NOT_FOUND") }),
])

export type VerificationStatusResponse = z.infer<typeof verificationStatusResponseSchema>
