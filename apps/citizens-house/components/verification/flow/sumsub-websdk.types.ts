/**
 * SumSub WebSDK Types (Frontend Only)
 *
 * The @sumsub/websdk-react package lacks TypeScript definitions.
 */

export type SumSubReviewAnswer = "GREEN" | "RED" | "YELLOW"
export type SumSubReviewRejectType = "RETRY" | "FINAL"

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
  | "idCheck.applicantStatus"

export interface SumSubApplicantLoadedPayload {
  applicantId: string
}

export interface SumSubStepInitiatedPayload {
  idDocSetType: string
  types: string[]
}

export interface SumSubStepCompletedPayload {
  idDocSetType: string
}

export interface SumSubLivenessCompletedPayload {
  answer: SumSubReviewAnswer
  allowContinuing: boolean
}

export interface SumSubApplicantStatusChangedPayload {
  reprocessing?: boolean
  levelName?: string
  createDate?: string
  expireDate?: string
  reviewStatus?: string
  reviewResult?: {
    reviewAnswer?: SumSubReviewAnswer
    reviewRejectType?: SumSubReviewRejectType
    rejectLabels?: string[]
  }
  autoChecked?: boolean
}

export interface SumSubErrorPayload {
  code: string
  error: string
  reason?: string
}

export interface SumSubResizePayload {
  height: number
}

export interface SumSubModuleResultPayload {
  answer: SumSubReviewAnswer
}

export interface SumSubUploadMessagePayload {
  code: string
  msg: string
}

export interface SumSubApplicantActionCompletedPayload {
  action: string
  applicantActionId: string
  answer: SumSubReviewAnswer
}

export interface SumSubApplicantLevelChangedPayload {
  levelName: string
}

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

export interface SumSubWebSdkConfig {
  lang?: string
  translationName?: string
  customizationName?: string
  country?: string
  theme?: "light" | "dark"
  email?: string
  phone?: string
  documentDefinitions?: Record<string, unknown>
  autoSelectDocumentDefinitions?: boolean
  controlledNavigationBack?: boolean
}

export interface SumSubWebSdkOptions {
  addViewportTag?: boolean
  adaptIframeHeight?: boolean
  enableScrollIntoView?: boolean
}

export interface SumSubWebSdkProps {
  accessToken: string
  expirationHandler: () => Promise<string>
  config: SumSubWebSdkConfig
  options?: SumSubWebSdkOptions
  onMessage: (type: SumSubWebSdkMessageType | string, payload: SumSubWebSdkPayload) => void
  onError: (error: Error) => void
}
