import type { DashboardDefinition } from "../schemas"
import { VERIFICATION_EVENTS, CITIZENS_EVENTS, CONSENT_EVENTS, ERRORS_EVENTS } from "@/lib/schemas"

/**
 * Verification Analytics Dashboard
 *
 * Uses event constants from @/lib/schemas/analytics-events (single source of truth).
 *
 * Happy path flow:
 * 1. cta_click - User clicks "Get Verified" button (on landing page)
 * 2. flow_start - Verification page mounts (after navigation)
 * 3. wallet_connect_success - Wallet connected
 * 4. sign_success - Message signed
 * 5. sumsub_sdk_load - SumSub SDK initialized
 * 6. sumsub_submit - User submitted documents
 * 7. onchain_store_success - Server confirmed verification (authoritative, final step)
 *
 * Funnel Strategy:
 * - Start and end with SERVER-SIDE events (token_generate, onchain_store_success)
 *   to ensure reliable tracking even when client-side events are blocked by ad blockers
 * - Middle steps (client-side) are marked as OPTIONAL using optionalInFunnel
 * - This captures 100% of verified users while still showing drop-off for those with tracking
 *
 * Note: success_view is NOT in funnel because client can render success before
 * the server-side onchain_store_success event is recorded (race condition).
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
    // Row 1: Verification Funnel (full width)
    // Starts and ends with SERVER-SIDE events for reliable tracking.
    // Client-side steps are OPTIONAL to handle ad blockers (which block ~30% of users).
    // This ensures we capture ALL verified users while still showing drop-off details.
    {
      type: "insight",
      insight: {
        name: "Verification Funnel",
        description:
          "Conversion funnel from token generation to on-chain verification. Client-side steps are optional to handle ad blockers.",
        query: {
          kind: "InsightVizNode",
          source: {
            kind: "FunnelsQuery",
            // Uses dashboard date range
            funnelsFilter: {
              funnelVizType: "steps",
              funnelWindowInterval: 7,
              funnelWindowIntervalUnit: "day",
            },
            series: [
              // Step 1: Token generated (SERVER-SIDE, required)
              // This proves wallet connected + signed (server validates the signature)
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.token_generate,
                custom_name: "Token Generated (Wallet + Sign verified)",
              },
              // Step 2: SumSub SDK loaded (CLIENT-SIDE, optional)
              // May be blocked by ad blockers
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.sumsub_sdk_load,
                custom_name: "ID verification started",
                optionalInFunnel: true,
              },
              // Step 3: User submitted documents to SumSub (CLIENT-SIDE, optional)
              // May be blocked by ad blockers
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.sumsub_submit,
                custom_name: "ID verification submitted",
                optionalInFunnel: true,
              },
              // Step 4: Server confirmed and stored on-chain (SERVER-SIDE, required)
              // This is the authoritative success event
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.onchain_store_success,
                custom_name: "Successfully verified on-chain",
              },
            ],
          },
        },
      },
      layouts: {
        sm: { h: 6, w: 12, x: 0, y: 0 },
      },
    },

    // Row 2: Time to Convert (histogram visualizations)
    // Uses PostHog's native funnel time_to_convert for bar chart display
    // All use server-side events for reliable tracking
    {
      type: "insight",
      insight: {
        name: "Time: Token → Verified",
        description: "Time from token generation to successful verification",
        query: {
          kind: "InsightVizNode",
          source: {
            kind: "FunnelsQuery",
            funnelsFilter: {
              funnelVizType: "time_to_convert",
              funnelWindowInterval: 7,
              funnelWindowIntervalUnit: "day",
              binCount: 10,
            },
            series: [
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.token_generate,
                custom_name: "Token Generated",
              },
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.onchain_store_success,
                custom_name: "Verified",
              },
            ],
          },
        },
      },
      layouts: {
        sm: { h: 5, w: 4, x: 0, y: 6 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Time: ID Start → Verified",
        description: "Time from ID verification started to verified",
        query: {
          kind: "InsightVizNode",
          source: {
            kind: "FunnelsQuery",
            funnelsFilter: {
              funnelVizType: "time_to_convert",
              funnelWindowInterval: 7,
              funnelWindowIntervalUnit: "day",
              binCount: 10,
            },
            series: [
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.sumsub_sdk_load,
                custom_name: "ID Verification Started",
              },
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.onchain_store_success,
                custom_name: "Verified",
              },
            ],
          },
        },
      },
      layouts: {
        sm: { h: 5, w: 4, x: 4, y: 6 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Time: ID Submit → Verified",
        description: "Time from document submission to verified",
        query: {
          kind: "InsightVizNode",
          source: {
            kind: "FunnelsQuery",
            funnelsFilter: {
              funnelVizType: "time_to_convert",
              funnelWindowInterval: 7,
              funnelWindowIntervalUnit: "day",
              binCount: 10,
            },
            series: [
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.sumsub_submit,
                custom_name: "Documents Submitted",
              },
              {
                kind: "EventsNode",
                event: VERIFICATION_EVENTS.onchain_store_success,
                custom_name: "Verified",
              },
            ],
          },
        },
      },
      layouts: {
        sm: { h: 5, w: 4, x: 8, y: 6 },
      },
    },

    // Row 3: Key metrics (4 across)
    // Uses server-side events for reliable counts
    {
      type: "insight",
      insight: {
        name: "Started Flow",
        description: "Unique users who got a verification token",
        filters: {
          insight: "TRENDS",
          // Uses dashboard date range
          display: "BoldNumber",
          events: [
            {
              id: VERIFICATION_EVENTS.token_generate,
              type: "events",
              name: "Started verification",
              math: "dau",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 0, y: 11 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Successful",
        description: "Verified on-chain",
        filters: {
          insight: "TRENDS",
          // Uses dashboard date range
          display: "BoldNumber",
          events: [
            {
              id: VERIFICATION_EVENTS.onchain_store_success,
              type: "events",
              name: "Successful verifications",
              math: "dau",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 3, y: 11 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Rejected",
        description: "Verification rejected",
        filters: {
          insight: "TRENDS",
          // Uses dashboard date range
          display: "BoldNumber",
          formula: "A + B",
          events: [
            {
              id: VERIFICATION_EVENTS.onchain_store_reject,
              type: "events",
              name: "Contract rejections (A)",
              math: "dau",
            },
            {
              id: VERIFICATION_EVENTS.webhook_review_reject,
              type: "events",
              name: "SumSub rejections (B)",
              math: "dau",
            },
          ],
        },
      },
      layouts: {
        sm: { h: 4, w: 3, x: 6, y: 11 },
      },
    },
    {  
      name: "Conversion Rate (%)",  
      description: "Token generated to verification complete",  
      query: {  
        kind: "TrendsQuery",  
        dateRange: {  
          date_from: null,  // Uses dashboard date range  
          date_to: null  
        },  
        series: [  
          {  
            kind: "EventsNode",  
            event: VERIFICATION_EVENTS.onchain_store_success,  
            name: "Successfully verified (A)",  
            math: "dau"  
          },  
          {  
            kind: "EventsNode",  
            event: VERIFICATION_EVENTS.token_generate,  
            name: "Token generated (B)",  
            math: "dau"  
          }  
        ],  
        trendsFilter: {  
          display: "BoldNumber",  
          aggregationAxisFormat: "percentage",  
          decimalPlaces: 0,  
          formulaNodes: [  
            {  
              formula: "A / B * 100"  
            }  
          ]  
        }  
      },
      layouts: {
        sm: { h: 4, w: 3, x: 9, y: 11 },
      },
    },

    // Row 4: Rejection Reasons (full width)
    // Shows all rejection events with their raw properties
    {
      type: "insight",
      insight: {
        name: "Rejection Reasons",
        description: "Why verifications are rejected (SumSub + contract)",
        query: {
          kind: "DataTableNode",
          source: {
            kind: "HogQLQuery",
            query: `
SELECT
  timestamp,
  event,
  distinct_id AS account_id,
  properties.reviewAnswer AS review_answer,
  properties.reviewRejectType AS reject_type,
  properties.rejectLabels AS reject_labels,
  properties.moderationComment AS moderation_comment,
  properties.clientComment AS client_comment,
  properties.errorCode AS error_code,
  properties.reason AS reason
FROM events
WHERE event IN ('${VERIFICATION_EVENTS.webhook_review_reject}', '${VERIFICATION_EVENTS.onchain_store_reject}')
  AND {filters}
ORDER BY timestamp DESC
LIMIT 100
            `.trim(),
          },
        },
      },
      layouts: {
        sm: { h: 5, w: 12, x: 0, y: 15 },
      },
    },

    // Row 5: Geographic distribution + Platform breakdown
    {
      type: "insight",
      insight: {
        name: "Verifications by Country",
        description: "Geographic distribution of successful verifications",
        filters: {
          insight: "TRENDS",
          // Uses dashboard date range
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
        sm: { h: 6, w: 8, x: 0, y: 20 },
      },
    },
    {
      type: "insight",
      insight: {
        name: "Verifications by Platform",
        description: "Desktop vs Mobile breakdown",
        filters: {
          insight: "TRENDS",
          // Uses dashboard date range
          display: "ActionsBarValue",
          events: [
            {
              id: VERIFICATION_EVENTS.success_view,
              type: "events",
              name: "Verified successfully",
              math: "dau",
            },
          ],
          breakdown: "platform",
          breakdown_type: "event",
        },
      },
      layouts: {
        sm: { h: 6, w: 4, x: 8, y: 20 },
      },
    },

    // Row 6: Verification User Paths (full width, at bottom)
    // Shows verification events starting from wallet connection (consistent distinct_id)
    {
      type: "insight",
      insight: {
        name: "Verification User Paths",
        description: "How users navigate through the verification flow after connecting wallet",
        filters: {
          insight: "PATHS",
          // Uses dashboard date range
          // Only custom events (our analytics events)
          include_event_types: ["custom_event"],
          // Start from wallet_connect_success for consistent user tracking
          start_point: VERIFICATION_EVENTS.wallet_connect_success,
          // More steps to see granular flow
          step_limit: 8,
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

            // === Server-side events (not visible to user) ===
            // Proof lifecycle
            VERIFICATION_EVENTS.proof_submit,
            VERIFICATION_EVENTS.proof_validate,
            VERIFICATION_EVENTS.onchain_store_success,
            VERIFICATION_EVENTS.onchain_store_reject,
            // Token route (server-side)
            VERIFICATION_EVENTS.token_validate_fail,
            VERIFICATION_EVENTS.token_config_error,
            VERIFICATION_EVENTS.token_already_verified,
            VERIFICATION_EVENTS.token_applicant_reuse,
            VERIFICATION_EVENTS.token_applicant_deactivated,
            VERIFICATION_EVENTS.token_metadata_store,
            VERIFICATION_EVENTS.token_generate,
            VERIFICATION_EVENTS.token_error,
            // Webhook route
            VERIFICATION_EVENTS.webhook_auth_fail,
            VERIFICATION_EVENTS.webhook_parse_fail,
            VERIFICATION_EVENTS.webhook_receive,
            VERIFICATION_EVENTS.webhook_user_missing,
            VERIFICATION_EVENTS.webhook_review_reject,
            VERIFICATION_EVENTS.webhook_review_hold,
            VERIFICATION_EVENTS.webhook_review_late_reject,
            VERIFICATION_EVENTS.webhook_validation_fail,
            VERIFICATION_EVENTS.webhook_config_error,
            VERIFICATION_EVENTS.webhook_storage_fail,
            VERIFICATION_EVENTS.webhook_error,

            // === Pre-connection events (different distinct_id) ===
            VERIFICATION_EVENTS.cta_click,
            VERIFICATION_EVENTS.flow_start,
          ],
        },
      },
      layouts: {
        sm: { h: 6, w: 12, x: 0, y: 26 },
      },
    },
  ],
}
