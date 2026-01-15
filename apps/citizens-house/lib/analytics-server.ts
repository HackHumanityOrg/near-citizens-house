import "server-only"

import { PostHog } from "posthog-node"
import { logger, LogScope, Op } from "./logger"
import { AnalyticsProperties } from "./analytics-schema"

let posthog: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null

  if (!posthog) {
    posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: "https://us.i.posthog.com",
      flushAt: 1, // Flush immediately (serverless)
      flushInterval: 0,
    })
  }
  return posthog
}

export function extractPostHogDistinctIdFromCookies(cookieHeader?: string | string[]): string | undefined {
  if (!cookieHeader) return undefined

  const cookieString = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader
  const postHogCookieMatch = cookieString.match(/ph_phc_[^_]+_posthog=([^;]+)/)

  if (!postHogCookieMatch?.[1]) return undefined

  try {
    const decodedCookie = decodeURIComponent(postHogCookieMatch[1])
    const postHogData = JSON.parse(decodedCookie) as { distinct_id?: string }
    return postHogData.distinct_id
  } catch {
    return undefined
  }
}

function logAnalyticsError(message: string, error: unknown, extra: Record<string, unknown> = {}): void {
  const errorDetails =
    error instanceof Error
      ? {
          error_type: error.name,
          error_message: error.message,
          error_stack: error.stack,
        }
      : { error_message: String(error) }

  logger.error(message, {
    scope: LogScope.ANALYTICS,
    operation: Op.VERIFICATION.ANALYTICS,
    ...extra,
    ...errorDetails,
  })
}

export async function trackVerificationStartedServer(props: {
  distinctId: string
  accountId?: string
  attestationId: string
  sessionId?: string
  requestId?: string
  selfNetwork?: string
  verificationMethod?: string
  timestamp?: number
}): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  const properties = {
    [AnalyticsProperties.attestationId]: props.attestationId,
    [AnalyticsProperties.trackingSource]: "server",
    [AnalyticsProperties.verificationStage]: "started",
    ...(props.accountId ? { [AnalyticsProperties.accountId]: props.accountId } : {}),
    ...(props.sessionId ? { [AnalyticsProperties.sessionId]: props.sessionId } : {}),
    ...(props.requestId ? { [AnalyticsProperties.requestId]: props.requestId } : {}),
    ...(props.selfNetwork ? { [AnalyticsProperties.selfNetwork]: props.selfNetwork } : {}),
    ...(props.verificationMethod ? { [AnalyticsProperties.verificationMethod]: props.verificationMethod } : {}),
    ...(props.accountId ? {} : { $process_person_profile: false }),
  }

  try {
    await ph.captureImmediate({
      distinctId: props.distinctId,
      event: "verification_started",
      properties,
      timestamp: props.timestamp ? new Date(props.timestamp) : undefined,
    })
  } catch (error) {
    logAnalyticsError("Failed to capture verification started", error, {
      [AnalyticsProperties.distinctId]: props.distinctId,
      [AnalyticsProperties.accountId]: props.accountId,
      [AnalyticsProperties.sessionId]: props.sessionId,
      [AnalyticsProperties.attestationId]: props.attestationId,
      [AnalyticsProperties.requestId]: props.requestId,
    })
  }
}

export async function trackVerificationCompletedServer(props: {
  accountId: string
  nationality?: string
  attestationId: string
  selfNetwork?: string
  isValid?: boolean
  sessionId?: string
  requestId?: string
  distinctId?: string
  timestamp?: number
}): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  const properties = {
    [AnalyticsProperties.accountId]: props.accountId,
    [AnalyticsProperties.attestationId]: props.attestationId,
    [AnalyticsProperties.trackingSource]: "server",
    [AnalyticsProperties.verificationStage]: "completed",
    ...(props.nationality ? { [AnalyticsProperties.nationality]: props.nationality } : {}),
    ...(props.selfNetwork ? { [AnalyticsProperties.selfNetwork]: props.selfNetwork } : {}),
    ...(typeof props.isValid === "boolean" ? { [AnalyticsProperties.isValid]: props.isValid } : {}),
    ...(props.sessionId ? { [AnalyticsProperties.sessionId]: props.sessionId } : {}),
    ...(props.requestId ? { [AnalyticsProperties.requestId]: props.requestId } : {}),
    // Set person properties
    $set: {
      [AnalyticsProperties.nearAccount]: props.accountId,
      [AnalyticsProperties.lastVerificationAt]: new Date().toISOString(),
      ...(props.nationality ? { [AnalyticsProperties.nationality]: props.nationality } : {}),
    },

    $set_once: {
      [AnalyticsProperties.firstVerificationAt]: new Date().toISOString(),
      ...(props.nationality ? { [AnalyticsProperties.firstNationality]: props.nationality } : {}),
    },
  }

  // Use captureImmediate to guarantee the HTTP request completes
  // before the serverless function terminates (prevents event loss)
  try {
    await ph.captureImmediate({
      distinctId: props.distinctId ?? props.accountId,
      event: "verification_completed",
      properties,
      timestamp: props.timestamp ? new Date(props.timestamp) : undefined,
    })
  } catch (error) {
    logAnalyticsError("Failed to capture verification completed", error, {
      [AnalyticsProperties.accountId]: props.accountId,
      [AnalyticsProperties.sessionId]: props.sessionId,
      [AnalyticsProperties.attestationId]: props.attestationId,
      [AnalyticsProperties.requestId]: props.requestId,
    })
  }
}

export async function trackVerificationFailedServer(props: {
  distinctId: string
  accountId?: string
  nationality?: string
  attestationId?: string
  errorCode: string
  errorReason?: string
  stage: string
  selfNetwork?: string
  isValid?: boolean
  sessionId?: string
  requestId?: string
  timestamp?: number
}): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  // Build person properties only if we have a valid accountId
  // (distinctId might be sessionId or "unknown" for early failures)
  const personProps =
    props.accountId && props.nationality
      ? {
          $set: {
            [AnalyticsProperties.nearAccount]: props.accountId,
            [AnalyticsProperties.lastFailedVerificationAt]: new Date().toISOString(),
            [AnalyticsProperties.nationality]: props.nationality,
          },
          $set_once: {
            [AnalyticsProperties.firstNationality]: props.nationality,
          },
        }
      : {}

  const properties = {
    [AnalyticsProperties.trackingSource]: "server",
    [AnalyticsProperties.errorCode]: props.errorCode,
    [AnalyticsProperties.verificationStage]: props.stage,
    ...(props.accountId ? { [AnalyticsProperties.accountId]: props.accountId } : {}),
    ...(props.attestationId ? { [AnalyticsProperties.attestationId]: props.attestationId } : {}),
    ...(props.nationality ? { [AnalyticsProperties.nationality]: props.nationality } : {}),
    ...(props.errorReason
      ? {
          [AnalyticsProperties.errorReason]: props.errorReason,
          [AnalyticsProperties.errorMessage]: props.errorReason,
        }
      : {}),
    ...(props.selfNetwork ? { [AnalyticsProperties.selfNetwork]: props.selfNetwork } : {}),
    ...(typeof props.isValid === "boolean" ? { [AnalyticsProperties.isValid]: props.isValid } : {}),
    ...(props.sessionId ? { [AnalyticsProperties.sessionId]: props.sessionId } : {}),
    ...(props.requestId ? { [AnalyticsProperties.requestId]: props.requestId } : {}),
    ...(props.accountId ? {} : { $process_person_profile: false }),
    ...personProps,
  }

  try {
    await ph.captureImmediate({
      distinctId: props.distinctId,
      event: "verification_failed",
      properties,
      timestamp: props.timestamp ? new Date(props.timestamp) : undefined,
    })
  } catch (error) {
    logAnalyticsError("Failed to capture verification failed", error, {
      [AnalyticsProperties.distinctId]: props.distinctId,
      [AnalyticsProperties.accountId]: props.accountId,
      [AnalyticsProperties.sessionId]: props.sessionId,
      [AnalyticsProperties.requestId]: props.requestId,
      [AnalyticsProperties.errorCode]: props.errorCode,
    })
  }
}

/**
 * Capture a server-side exception to PostHog
 * Used by instrumentation.ts for automatic error tracking
 */
export async function captureServerException(
  error: Error,
  distinctId?: string,
  additionalProperties?: Record<string, unknown>,
): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  try {
    await ph.captureException(error, distinctId, additionalProperties)
  } catch (captureError) {
    logAnalyticsError("Failed to capture server exception", captureError, {
      [AnalyticsProperties.distinctId]: distinctId,
      [AnalyticsProperties.errorType]: error.name,
      [AnalyticsProperties.errorMessage]: error.message,
    })
  }
}

/**
 * Gracefully shutdown PostHog server instance
 * Ensures all queued events are flushed before shutdown
 */
export async function shutdownPostHog(): Promise<void> {
  if (posthog) {
    await posthog.shutdown()
  }
}
