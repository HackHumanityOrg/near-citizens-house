import type { ActionDefinition } from "./schemas"

/**
 * Action that combines QR display (desktop) and deeplink opened (mobile) events.
 * In PostHog, actions use OR logic between steps - any matching step triggers the action.
 * This allows us to have a single funnel step that works for both platforms.
 */
export const selfAppInitiatedAction: ActionDefinition = {
  name: "Self App Initiated",
  description: "User initiated verification in Self app (QR scan on desktop or deeplink on mobile)",
  steps: [{ event: "verification:qr_displayed" }, { event: "verification:deeplink_opened" }],
  tags: ["verification"],
}

/**
 * All actions to be created in PostHog
 */
export const allActions: ActionDefinition[] = [selfAppInitiatedAction]

export const actionNames = allActions.map((a) => a.name)
