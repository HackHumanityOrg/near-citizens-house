import type { DashboardDefinition } from "../schemas"
import { NATIONALITY_TO_ALPHA2_HOGQL } from "../country-codes"

/**
 * Single high-value dashboard for verification analytics
 * Includes: full funnel (client + server events), paths, platform breakdown, and key metrics
 */
export const verificationAnalyticsDashboard: DashboardDefinition = {
  name: "Verification Analytics",
  description:
    "Core verification metrics: conversion funnel, user paths, platform breakdown, and nationality distribution",
  tags: ["verification", "analytics"],
  tiles: [
    // Row 1: Verification Funnel (full width, taller for 8 steps)
    // Complete funnel including client-side and server-side events
    // Uses query format to support Actions (OR logic for desktop/mobile)
    {
      type: "insight",
      insight: {
        name: "Verification Funnel",
        description: "Complete verification journey from CTA click to on-chain storage",
        // Use query format for funnels with Actions
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
              // Client-side: User journey
              { kind: "EventsNode", event: "verification:cta_clicked", name: "CTA Clicked" },
              { kind: "EventsNode", event: "verification:flow_started", name: "Flow Started" },
              { kind: "EventsNode", event: "verification:sign_completed", name: "Message Signed" },
              // Action: qr_displayed OR deeplink_opened
              // This handles both desktop (QR) and mobile (deeplink) flows
              { kind: "ActionsNode", id: 228291, name: "verification:qr_displayed or verification:deeplink_opened" },
              // Server-side: Backend processing
              { kind: "EventsNode", event: "verification:proof_submitted", name: "Proof Submitted" },
              { kind: "EventsNode", event: "verification:proof_validated", name: "Proof Validated" },
              { kind: "EventsNode", event: "verification:stored_onchain", name: "Stored On-chain" },
              // Client-side: Completion
              { kind: "EventsNode", event: "verification:success_displayed", name: "Success Screen" },
            ],
          },
        },
      },
      layouts: {
        sm: { h: 8, w: 12, x: 0, y: 0 },
      },
    },

    // Row 2: User Paths (full width)
    {
      type: "insight",
      insight: {
        name: "User Paths",
        description: "How users navigate through the app and verification flow",
        filters: {
          insight: "PATHS",
          date_from: "-30d",
          // Include both pageviews and custom events to see full user journey
          include_event_types: ["$pageview", "custom_event"],
          // No fixed start/end - show all paths
          // Group similar paths to clean up visualization
          path_groupings: ["/citizens/.*"],
          // Limit steps to keep visualization readable
          step_limit: 6,
          // Filter out noise
          exclude_events: ["$pageleave"],
        },
      },
      layouts: {
        sm: { h: 6, w: 12, x: 0, y: 8 },
      },
    },

    // Row 3: WorldMap (half) + key metrics (half)
    // Note: Self.xyz returns alpha-3 codes (USA, GBR), PostHog WorldMap needs alpha-2 (US, GB)
    // We use HogQL multiIf() to transform the codes for WorldMap compatibility
    {
      type: "insight",
      insight: {
        name: "Verifications by Nationality",
        description: "Geographic distribution of verified users (WorldMap)",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          display: "WorldMap",
          events: [
            {
              id: "verification:stored_onchain",
              type: "events",
              name: "Stored On-chain",
              math: "total",
            },
          ],
          // Use HogQL to transform alpha-3 (Self.xyz) to alpha-2 (PostHog WorldMap)
          breakdown: NATIONALITY_TO_ALPHA2_HOGQL,
          breakdown_type: "hogql",
        },
      },
      layouts: {
        sm: { h: 5, w: 6, x: 0, y: 14 },
      },
    },
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
              id: "verification:stored_onchain",
              type: "events",
              name: "Stored On-chain",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 5, w: 3, x: 6, y: 14 },
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
              id: "verification:stored_onchain",
              type: "events",
              name: "Completed (A)",
              math: "total",
            },
            {
              id: "verification:flow_started",
              type: "events",
              name: "Started (B)",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 5, w: 3, x: 9, y: 14 },
      },
    },

    // Row 4: Breakdowns and trends
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
              id: "verification:rejected",
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
        sm: { h: 4, w: 3, x: 0, y: 19 },
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
              id: "verification:success_displayed",
              type: "events",
              name: "Success Screen",
              math: "total",
            },
          ],
          breakdown: "$device_type",
          breakdown_type: "event",
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 3, y: 19 },
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
              id: "verification:stored_onchain",
              type: "events",
              name: "Stored On-chain",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 6, y: 19 },
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
              id: "verification:stored_onchain",
              type: "events",
              name: "Verifications",
              math: "total",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 9, y: 19 },
      },
    },
  ],
}
