import type { DashboardDefinition } from "../schemas"

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
    {
      type: "insight",
      insight: {
        name: "Verification Funnel",
        description: "Complete verification journey from CTA click to on-chain storage",
        filters: {
          insight: "FUNNELS",
          date_from: "-30d",
          funnel_viz_type: "steps",
          funnel_window_interval: 7,
          funnel_window_interval_unit: "day",
          events: [
            // Client-side: User journey
            { id: "verification:cta_clicked", type: "events", name: "CTA Clicked", order: 0 },
            { id: "verification:flow_started", type: "events", name: "Flow Started", order: 1 },
            { id: "verification:sign_completed", type: "events", name: "Message Signed", order: 2 },
            // Action combining qr_displayed (desktop) and deeplink_opened (mobile)
            { id: "Self App Initiated", type: "actions", name: "Self App Opened", order: 3 },
            // Server-side: Backend processing
            { id: "verification:proof_submitted", type: "events", name: "Proof Submitted", order: 4 },
            { id: "verification:proof_validated", type: "events", name: "Proof Validated", order: 5 },
            { id: "verification:stored_onchain", type: "events", name: "Stored On-chain", order: 6 },
            // Client-side: Completion
            { id: "verification:success_displayed", type: "events", name: "Success Screen", order: 7 },
          ],
        },
      },
      layouts: {
        sm: { h: 8, w: 12, x: 0, y: 0 },
      },
    },

    // Row 2: User Paths (left) + Platform breakdown (right)
    {
      type: "insight",
      insight: {
        name: "User Paths",
        description: "How users navigate through the verification flow",
        filters: {
          insight: "PATHS",
          date_from: "-30d",
          // Show paths for custom events (verification events)
          include_event_types: ["custom_event"],
          // Start from CTA click, end at success
          start_point: "verification:cta_clicked",
          end_point: "verification:success_displayed",
          // Limit steps to keep visualization clean
          step_limit: 8,
        },
      },
      layouts: {
        sm: { h: 6, w: 6, x: 0, y: 8 },
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
              // Use success_displayed (client-side) instead of stored_onchain (server-side)
              // because $device_type is only available on client-side events
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
        sm: { h: 6, w: 6, x: 6, y: 8 },
      },
    },

    // Row 3: Nationality breakdown (left) + Error analysis (right)
    {
      type: "insight",
      insight: {
        name: "Verifications by Nationality",
        description: "Distribution of verified users by nationality",
        filters: {
          insight: "TRENDS",
          date_from: "-30d",
          display: "ActionsPie",
          events: [
            {
              id: "verification:stored_onchain",
              type: "events",
              name: "Stored On-chain",
              math: "total",
            },
          ],
          breakdown: "nationality",
          breakdown_type: "event",
        },
      },
      layouts: {
        sm: { h: 5, w: 6, x: 0, y: 14 },
      },
    },
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
        sm: { h: 5, w: 6, x: 6, y: 14 },
      },
    },

    // Row 4: Key metrics
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
        sm: { h: 4, w: 3, x: 0, y: 19 },
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
        sm: { h: 4, w: 3, x: 3, y: 19 },
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
