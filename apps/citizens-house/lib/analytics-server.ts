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

export function trackVerificationCompletedServer(props: {
  accountId: string
  nationality: string
  attestationId: string
}) {
  const ph = getPostHogServer()
  if (!ph) return

  ph.capture({
    distinctId: props.accountId,
    event: "verification_completed",
    properties: {
      account_id: props.accountId,
      nationality: props.nationality,
      attestation_id: props.attestationId,
      tracking_source: "server",
    },
  })
}
