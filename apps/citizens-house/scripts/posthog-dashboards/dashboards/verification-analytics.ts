import type { DashboardDefinition } from "../schemas"

/**
 * Verification event names - derived from lib/schemas/analytics.ts
 *
 * Happy path flow:
 * 1. flow_started - User enters verification page
 * 2. cta_clicked - User clicks "Get Verified" button
 * 3. wallet_connect_succeeded - Wallet connected
 * 4. sign_completed - Message signed
 * 5. sumsub_sdk_loaded - SumSub SDK initialized
 * 6. sumsub_submitted - User submitted documents
 * 7. stored_onchain - Server confirmed verification (authoritative)
 * 8. success_displayed - User sees success screen
 */
const VERIFICATION_EVENTS = {
  // Flow lifecycle
  flow_started: "verification:flow_started",
  cta_clicked: "verification:cta_clicked",
  // Wallet connection
  wallet_connect_started: "verification:wallet_connect_started",
  wallet_connect_succeeded: "verification:wallet_connect_succeeded",
  wallet_connect_failed: "verification:wallet_connect_failed",
  // Message signing
  sign_started: "verification:sign_started",
  sign_completed: "verification:sign_completed",
  sign_failed: "verification:sign_failed",
  // Token fetch
  token_fetch_started: "verification:token_fetch_started",
  token_fetch_succeeded: "verification:token_fetch_succeeded",
  token_fetch_failed: "verification:token_fetch_failed",
  // SumSub SDK
  sumsub_sdk_loaded: "verification:sumsub_sdk_loaded",
  sumsub_ready: "verification:sumsub_ready",
  sumsub_submitted: "verification:sumsub_submitted",
  sumsub_rejected: "verification:sumsub_rejected",
  // Polling
  polling_started: "verification:polling_started",
  polling_approved: "verification:polling_approved",
  polling_timeout: "verification:polling_timeout",
  // Server-side
  proof_submitted: "verification:proof_submitted",
  proof_validated: "verification:proof_validated",
  stored_onchain: "verification:stored_onchain",
  rejected: "verification:rejected",
  // Success/Error
  success_displayed: "verification:success_displayed",
  error_shown: "verification:error_shown",
  manual_review_shown: "verification:manual_review_shown",
} as const

/**
 * Single high-value dashboard for verification analytics
 * Includes: full funnel (client + server events), paths, platform breakdown, and key metrics
 */
export const verificationAnalyticsDashboard: DashboardDefinition = {
  name: "Verification Analytics",
  description: "Core verification metrics: conversion funnel, user paths, platform breakdown, and key metrics",
  tags: ["verification", "analytics"],
  tiles: [
    // Row 1: Verification Funnel (full width, taller for 8 steps)
    // Complete funnel including client-side and server-side events
    {
      type: "insight",
      insight: {
        name: "Verification Funnel",
        description: "Complete verification journey from page load to success",
        query: {
          kind: "InsightVizNode",
          source: {
            kind: "FunnelsQuery",
            dateRange: { date_from: "-30d" },
            funnelsFilter: {
              funnelVizType: "steps",
              funnelWindowInterval: 7,
              funnelWindowIntervalUnit: "day",
            },
            series: [
              // Step 1: User enters verification page
              { kind: "EventsNode", event: VERIFICATION_EVENTS.flow_started, name: "Flow Started" },
              // Step 2: User clicks CTA button
              { kind: "EventsNode", event: VERIFICATION_EVENTS.cta_clicked, name: "CTA Clicked" },
              // Step 3: Wallet connected successfully
              { kind: "EventsNode", event: VERIFICATION_EVENTS.wallet_connect_succeeded, name: "Wallet Connected" },
              // Step 4: Message signed
              { kind: "EventsNode", event: VERIFICATION_EVENTS.sign_completed, name: "Message Signed" },
              // Step 5: SumSub SDK loaded (ID verification started)
              { kind: "EventsNode", event: VERIFICATION_EVENTS.sumsub_sdk_loaded, name: "ID Verification Started" },
              // Step 6: User submitted documents to SumSub
              { kind: "EventsNode", event: VERIFICATION_EVENTS.sumsub_submitted, name: "Documents Submitted" },
              // Step 7: Server confirmed and stored on-chain (authoritative success)
              { kind: "EventsNode", event: VERIFICATION_EVENTS.stored_onchain, name: "Stored On-chain" },
              // Step 8: User sees success screen
              { kind: "EventsNode", event: VERIFICATION_EVENTS.success_displayed, name: "Success Displayed" },
            ],
          },
        },
      },
      layouts: {
        sm: { h: 8, w: 12, x: 0, y: 0 },
      },
    },

    // Row 2: Verification User Paths (full width)
    // Shows ONLY verification domain events to understand user journey
    {
      type: "insight",
      insight: {
        name: "Verification User Paths",
        description: "Granular view of how users navigate through the verification flow",
        filters: {
          insight: "PATHS",
          date_from: "-30d",
          // Only custom events (our analytics events)
          include_event_types: ["custom_event"],
          // Start from flow_started to see the full journey
          start_point: VERIFICATION_EVENTS.flow_started,
          // More steps to see granular flow
          step_limit: 10,
          // Exclude all non-verification events and noisy verification events
          exclude_events: [
            // === Non-verification domain events ===
            // Citizens domain
            "citizens:details_viewed",
            "citizens:signature_verify_opened",
            "citizens:copied_to_clipboard",
            "citizens:external_verifier_opened",
            // Consent domain
            "consent:response",
            // Errors domain
            "errors:exception_captured",
            // === Noisy verification events ===
            // Exclude repetitive SumSub SDK messages (fires many times)
            "verification:sumsub_message",
            "verification:sumsub_status_received",
            // Exclude server-side events (not visible to user)
            "verification:proof_submitted",
            "verification:proof_validated",
          ],
        },
      },
      layouts: {
        sm: { h: 6, w: 12, x: 0, y: 8 },
      },
    },

    // Row 3: Key metrics (4 across)
    {
      type: "insight",
      insight: {
        name: "Total Verifications",
        description: "All-time successful verifications",
        filters: {
          insight: "TRENDS",
          date_from: "all",
          display: "BoldNumber",
          events: [
            {
              id: VERIFICATION_EVENTS.stored_onchain,
              type: "events",
              name: "Stored On-chain",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 0, y: 14 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "This Week",
        description: "Verifications in the last 7 days",
        filters: {
          insight: "TRENDS",
          date_from: "-7d",
          display: "BoldNumber",
          compare: true,
          events: [
            {
              id: VERIFICATION_EVENTS.stored_onchain,
              type: "events",
              name: "Stored On-chain",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 3, y: 14 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Conversion Rate",
        description: "Flow started to verification complete",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          display: "BoldNumber",
          formula: "A / B * 100",
          events: [
            {
              id: VERIFICATION_EVENTS.stored_onchain,
              type: "events",
              name: "Completed (A)",
              math: "total",
            },
            {
              id: VERIFICATION_EVENTS.flow_started,
              type: "events",
              name: "Started (B)",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 6, y: 14 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Daily Trend",
        description: "Verification trend over time",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          interval: "day",
          display: "ActionsLineGraph",
          events: [
            {
              id: VERIFICATION_EVENTS.stored_onchain,
              type: "events",
              name: "Verifications",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 9, y: 14 },
      },
    },

    // Row 4: Breakdowns (2 across)
    {
      type: "insight",
      insight: {
        name: "Rejection Reasons",
        description: "Why verifications are rejected",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          display: "ActionsPie",
          events: [
            {
              id: VERIFICATION_EVENTS.rejected,
              type: "events",
              name: "Rejected",
              math: "total",
            },
          ],
          breakdown: "reason",
          breakdown_type: "event",
        },
      },
      layouts: {
        sm: { h: 5, w: 6, x: 0, y: 18 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Verifications by Platform",
        description: "Desktop vs Mobile verification breakdown",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          display: "ActionsPie",
          events: [
            {
              id: VERIFICATION_EVENTS.success_displayed,
              type: "events",
              name: "Success Screen",
              math: "total",
            },
          ],
          breakdown: "platform",
          breakdown_type: "event",
        },
      },
      layouts: {
        sm: { h: 5, w: 6, x: 6, y: 18 },
      },
    },
  ],
}
