import type { DashboardDefinition } from "../schemas"
import { VERIFICATION_EVENTS, CITIZENS_EVENTS, CONSENT_EVENTS, ERRORS_EVENTS } from "@/lib/schemas"

/**
 * Verification Analytics Dashboard
 *
 * Uses event constants from @/lib/schemas/analytics-events (single source of truth).
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
            CITIZENS_EVENTS.details_viewed,
            CITIZENS_EVENTS.signature_verify_opened,
            CITIZENS_EVENTS.copied_to_clipboard,
            CITIZENS_EVENTS.external_verifier_opened,
            // Consent domain
            CONSENT_EVENTS.response,
            // Errors domain
            ERRORS_EVENTS.exception_captured,
            // === Noisy verification events ===
            // Exclude repetitive SumSub SDK messages (fires many times)
            VERIFICATION_EVENTS.sumsub_message_receive,
            VERIFICATION_EVENTS.sumsub_status_receive,
            // Exclude server-side events (not visible to user)
            VERIFICATION_EVENTS.proof_submit,
            VERIFICATION_EVENTS.proof_validate,
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
              math: "dau",
            },
            {
              id: VERIFICATION_EVENTS.flow_start,
              type: "events",
              name: "Started (B)",
              math: "dau",
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
              math: "dau",
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

    // Row 5: Geographic distribution (full width)
    {
      type: "insight",
      insight: {
        name: "Verifications by Country",
        description: "Geographic distribution of successful verifications",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          display: "WorldMap",
          events: [
            {
              id: VERIFICATION_EVENTS.success_view,
              type: "events",
              name: "Verifications",
              math: "dau",
            },
          ],
          breakdown: "$geoip_country_code",
          breakdown_type: "event",
        },
      },
      layouts: {
        sm: { h: 6, w: 12, x: 0, y: 23 },
      },
    },
  ],
}
