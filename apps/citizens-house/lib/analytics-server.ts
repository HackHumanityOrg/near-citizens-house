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
  }

  // Use captureImmediate to guarantee the HTTP request completes
  // before the serverless function terminates (prevents event loss)
  await ph.captureImmediate({
    distinctId: props.accountId,
    event: "verification_completed",
    properties,
  })
}

export async function trackVerificationFailedServer(props: {
  distinctId: string
  accountId?: string
  nationality?: string
  attestationId?: string
  errorCode: string
  errorReason?: string
  stage?: string
  selfNetwork?: string
  ofacEnabled?: boolean
  isValid?: boolean
  isMinimumAgeValid?: boolean
  isOfacValid?: boolean
  sessionId?: string
}): Promise<void> {
  const ph = getPostHogServer()
  if (!ph) return

  const properties = {
    tracking_source: "server",
    ...(props.accountId ? { account_id: props.accountId } : {}),
    ...(props.attestationId ? { attestation_id: props.attestationId } : {}),
    ...(props.nationality ? { nationality: props.nationality } : {}),
    ...(props.errorCode ? { error_code: props.errorCode } : {}),
    ...(props.errorReason ? { error_reason: props.errorReason } : {}),
    ...(props.stage ? { verification_stage: props.stage } : {}),
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
  })
}
