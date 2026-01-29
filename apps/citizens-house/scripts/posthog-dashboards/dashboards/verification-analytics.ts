import type { DashboardDefinition } from "../schemas"

/**
 * Verification event names - derived from lib/schemas/analytics.ts
 *
 * Happy path flow:
 * 1. flow_start - User enters verification page
 * 2. cta_click - User clicks "Get Verified" button
 * 3. wallet_connect_success - Wallet connected
 * 4. sign_success - Message signed
 * 5. sumsub_sdk_load - SumSub SDK initialized
 * 6. sumsub_submit - User submitted documents
 * 7. onchain_store_success - Server confirmed verification (authoritative)
 * 8. success_view - User sees success screen
 */
const VERIFICATION_EVENTS = {
  // Flow lifecycle
  flow_start: "verification:flow_start",
  cta_click: "verification:cta_click",
  // Wallet connection
  wallet_connect_start: "verification:wallet_connect_start",
  wallet_connect_success: "verification:wallet_connect_success",
  wallet_connect_fail: "verification:wallet_connect_fail",
  // Message signing
  sign_start: "verification:sign_start",
  sign_success: "verification:sign_success",
  sign_fail: "verification:sign_fail",
  // Token fetch
  token_fetch_start: "verification:token_fetch_start",
  token_fetch_success: "verification:token_fetch_success",
  token_fetch_fail: "verification:token_fetch_fail",
  // SumSub SDK
  sumsub_sdk_load: "verification:sumsub_sdk_load",
  sumsub_ready: "verification:sumsub_ready",
  sumsub_submit: "verification:sumsub_submit",
  sumsub_review_reject: "verification:sumsub_review_reject",
  // Polling
  polling_start: "verification:polling_start",
  polling_approve: "verification:polling_approve",
  polling_timeout: "verification:polling_timeout",
  // Server-side
  proof_submit: "verification:proof_submit",
  proof_validate: "verification:proof_validate",
  onchain_store_success: "verification:onchain_store_success",
  onchain_store_reject: "verification:onchain_store_reject",
  // Success/Error
  success_view: "verification:success_view",
  error_modal_view: "verification:error_modal_view",
  manual_review_view: "verification:manual_review_view",
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
              { kind: "EventsNode", event: VERIFICATION_EVENTS.flow_start, name: "Flow Started" },
              // Step 2: User clicks CTA button
              { kind: "EventsNode", event: VERIFICATION_EVENTS.cta_click, name: "CTA Clicked" },
              // Step 3: Wallet connected successfully
              { kind: "EventsNode", event: VERIFICATION_EVENTS.wallet_connect_success, name: "Wallet Connected" },
              // Step 4: Message signed
              { kind: "EventsNode", event: VERIFICATION_EVENTS.sign_success, name: "Message Signed" },
              // Step 5: SumSub SDK loaded (ID verification started)
              { kind: "EventsNode", event: VERIFICATION_EVENTS.sumsub_sdk_load, name: "ID Verification Started" },
              // Step 6: User submitted documents to SumSub
              { kind: "EventsNode", event: VERIFICATION_EVENTS.sumsub_submit, name: "Documents Submitted" },
              // Step 7: Server confirmed and stored on-chain (authoritative success)
              { kind: "EventsNode", event: VERIFICATION_EVENTS.onchain_store_success, name: "Stored On-chain" },
              // Step 8: User sees success screen
              { kind: "EventsNode", event: VERIFICATION_EVENTS.success_view, name: "Success Displayed" },
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
          // Start from flow_start to see the full journey
          start_point: VERIFICATION_EVENTS.flow_start,
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
            "verification:sumsub_message_receive",
            "verification:sumsub_status_receive",
            // Exclude server-side events (not visible to user)
            "verification:proof_submit",
            "verification:proof_validate",
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
              id: VERIFICATION_EVENTS.onchain_store_success,
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
              id: VERIFICATION_EVENTS.onchain_store_success,
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
              id: VERIFICATION_EVENTS.onchain_store_success,
              type: "events",
              name: "Completed (A)",
              math: "total",
            },
            {
              id: VERIFICATION_EVENTS.flow_start,
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
              id: VERIFICATION_EVENTS.onchain_store_success,
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
              id: VERIFICATION_EVENTS.onchain_store_reject,
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
              id: VERIFICATION_EVENTS.success_view,
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
