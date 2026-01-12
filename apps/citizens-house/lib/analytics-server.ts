import "server-only"

import { PostHog } from "posthog-node"

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

export async function trackVerificationCompletedServer(props: {
  accountId: string
  nationality?: string
  attestationId: string
  selfNetwork?: string
  isValid?: boolean
  sessionId?: string
  timestamp?: number
}): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  const properties = {
    account_id: props.accountId,
    attestation_id: props.attestationId,
    tracking_source: "server",
    ...(props.nationality ? { nationality: props.nationality } : {}),
    ...(props.selfNetwork ? { self_network: props.selfNetwork } : {}),
    ...(typeof props.isValid === "boolean" ? { is_valid: props.isValid } : {}),
    ...(props.sessionId ? { session_id: props.sessionId } : {}),
    // Set person properties
    $set: {
      near_account: props.accountId,
      last_verification_at: new Date().toISOString(),
      ...(props.nationality ? { nationality: props.nationality } : {}),
    },

    $set_once: {
      first_verification_at: new Date().toISOString(),
      ...(props.nationality ? { first_nationality: props.nationality } : {}),
    },
  }

  // Use captureImmediate to guarantee the HTTP request completes
  // before the serverless function terminates (prevents event loss)
  await ph.captureImmediate({
    distinctId: props.accountId,
    event: "verification_completed",
    properties,
    timestamp: props.timestamp ? new Date(props.timestamp) : undefined,
  })
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
            near_account: props.accountId,
            last_failed_verification_at: new Date().toISOString(),
            nationality: props.nationality,
          },
          $set_once: {
            first_nationality: props.nationality,
          },
        }
      : {}

  const properties = {
    tracking_source: "server",
    error_code: props.errorCode,
    verification_stage: props.stage,
    ...(props.accountId ? { account_id: props.accountId } : {}),
    ...(props.attestationId ? { attestation_id: props.attestationId } : {}),
    ...(props.nationality ? { nationality: props.nationality } : {}),
    ...(props.errorReason ? { error_reason: props.errorReason } : {}),
    ...(props.selfNetwork ? { self_network: props.selfNetwork } : {}),
    ...(typeof props.isValid === "boolean" ? { is_valid: props.isValid } : {}),
    ...(props.sessionId ? { session_id: props.sessionId } : {}),
    ...personProps,
  }

  await ph.captureImmediate({
    distinctId: props.distinctId,
    event: "verification_failed",
    properties,
    timestamp: props.timestamp ? new Date(props.timestamp) : undefined,
  })
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

  await ph.captureException(error, distinctId, additionalProperties)
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
