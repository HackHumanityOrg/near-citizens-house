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
  ofacEnabled?: boolean
  isValid?: boolean
  isMinimumAgeValid?: boolean
  isOfacValid?: boolean
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
    ...(typeof props.ofacEnabled === "boolean" ? { ofac_enabled: props.ofacEnabled } : {}),
    ...(typeof props.isValid === "boolean" ? { is_valid: props.isValid } : {}),
    ...(typeof props.isMinimumAgeValid === "boolean" ? { is_minimum_age_valid: props.isMinimumAgeValid } : {}),
    ...(typeof props.isOfacValid === "boolean" ? { is_ofac_valid: props.isOfacValid } : {}),
    ...(props.sessionId ? { session_id: props.sessionId } : {}),
    // Set person properties
    $set: {
      near_account: props.accountId,
      wallet_type: "near",
      last_verification_at: new Date().toISOString(),
      ...(props.nationality ? { nationality: props.nationality } : {}),
    },
    $set_once: {
      first_verification_at: new Date().toISOString(),
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
  ofacEnabled?: boolean
  isValid?: boolean
  isMinimumAgeValid?: boolean
  isOfacValid?: boolean
  sessionId?: string
  timestamp?: number
}): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  const properties = {
    tracking_source: "server",
    error_code: props.errorCode,
    verification_stage: props.stage,
    ...(props.accountId ? { account_id: props.accountId } : {}),
    ...(props.attestationId ? { attestation_id: props.attestationId } : {}),
    ...(props.nationality ? { nationality: props.nationality } : {}),
    ...(props.errorReason ? { error_reason: props.errorReason } : {}),
    ...(props.selfNetwork ? { self_network: props.selfNetwork } : {}),
    ...(typeof props.ofacEnabled === "boolean" ? { ofac_enabled: props.ofacEnabled } : {}),
    ...(typeof props.isValid === "boolean" ? { is_valid: props.isValid } : {}),
    ...(typeof props.isMinimumAgeValid === "boolean" ? { is_minimum_age_valid: props.isMinimumAgeValid } : {}),
    ...(typeof props.isOfacValid === "boolean" ? { is_ofac_valid: props.isOfacValid } : {}),
    ...(props.sessionId ? { session_id: props.sessionId } : {}),
  }

  await ph.captureImmediate({
    distinctId: props.distinctId,
    event: "verification_failed",
    properties,
    timestamp: props.timestamp ? new Date(props.timestamp) : undefined,
  })
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
