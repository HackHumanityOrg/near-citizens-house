export const AnalyticsProperties = {
  // Identity & Context
  accountId: "account_id",
  distinctId: "distinct_id",
  sessionId: "session_id",
  requestId: "request_id",
  trackingSource: "tracking_source",

  // Verification Flow
  attestationId: "attestation_id",
  verificationMethod: "verification_method",
  verificationStage: "verification_stage",
  isValid: "is_valid",
  selfNetwork: "self_network",
  nationality: "nationality",

  // Error Properties
  errorCode: "error_code",
  errorMessage: "error_message",
  errorReason: "error_reason",
  errorType: "error_type",
  errorDigest: "error_digest",
  errorBoundary: "error_boundary",

  // Logging
  logLevel: "log_level",
  logMessage: "log_message",

  // User Journey Events
  stepReached: "step_reached",
  pageNumber: "page_number",
  viewedAccountId: "viewed_account_id",
  fileType: "file_type",
  verifierType: "verifier_type",
  pageUrl: "page_url",
  displayMethod: "display_method",
  userAgent: "user_agent",

  // Person Properties
  nearAccount: "near_account",
  nearNetwork: "near_network",
  lastVerificationAt: "last_verification_at",
  firstVerificationAt: "first_verification_at",
  lastFailedVerificationAt: "last_failed_verification_at",
  firstNationality: "first_nationality",
  firstConnectedAt: "first_connected_at",
  firstConnectedUrl: "first_connected_url",

  // Next.js Request Context
  currentUrl: "$current_url",
  requestMethod: "request_method",
  routerKind: "router_kind",
  routePath: "route_path",
  routeType: "route_type",
  renderSource: "render_source",
  revalidateReason: "revalidate_reason",
  renderType: "render_type",
} as const

const REDACTED_VALUE = "[redacted]"

const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /nonce/i,
  /signature/i,
  /publickey/i,
  /privatekey/i,
  /secret/i,
  /token/i,
  /error_stack/i,
]

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item))
  }

  if (value && typeof value === "object") {
    return redactSensitiveFields(value as Record<string, unknown>)
  }

  return value
}

export function redactSensitiveFields<T>(input: T): T {
  if (!input || typeof input !== "object") {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactValue(item)) as T
  }

  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (shouldRedactKey(key)) {
      output[key] = REDACTED_VALUE
      continue
    }

    output[key] = redactValue(value)
  }

  return output as T
}
