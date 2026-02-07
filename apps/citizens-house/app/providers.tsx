"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { SWRConfig } from "swr"
import { NearWalletProvider } from "@/lib"
import { ErrorBoundary } from "@near-citizens/ui"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { env } from "@/lib/schemas/env"
import { DebugProvider } from "@/lib/providers/debug-provider"
import { DebugMenu } from "@/components/debug"

interface ProvidersProps {
  children: React.ReactNode
}

const CONSENT_FEATURE_FLAG = true
const CONSENT_STORAGE_KEY = "posthog_consent"

export function Providers({ children }: ProvidersProps) {
  return (
    <PostHogProvider>
      <SWRConfig
        value={{
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          dedupingInterval: 60000, // 1 minute deduplication
        }}
      >
        <NearWalletProvider>
          <DebugProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
            <DebugMenu />
          </DebugProvider>
        </NearWalletProvider>
      </SWRConfig>
    </PostHogProvider>
  )
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    if (!env.NEXT_PUBLIC_POSTHOG_KEY) {
      Sentry.logger.warn("posthog_client_disabled_missing_key")
      return
    }

    try {
      posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: "https://us.posthog.com",
        // Use latest config defaults (enables strictMinimumDuration and content_ignorelist for rageclicks)
        defaults: "2025-11-30",
        // Pageview handling - defaults: "2025-11-30" sets capture_pageview: 'history_change' automatically
        capture_pageleave: true,
        // Dead click capture - tracks clicks on non-responsive elements
        capture_dead_clicks: true,
        // Heatmaps - captures mouse movements, clicks, rageclicks, and scroll depth
        enable_heatmaps: true,
        // Session recording configuration
        session_recording: {
          // Privacy: mask all input values by default
          maskAllInputs: true,
          // Additional text masking via data attribute
          maskTextSelector: "[data-mask]",
          // Granular input masking - always mask passwords even if maskAllInputs is disabled
          maskInputOptions: {
            password: true,
          },
        },
        // Console log recording - captures console.log, console.warn, console.error in session replays
        enable_recording_console_log: true,
        // Consent mode (opt-out behavior)
        opt_out_capturing_by_default: false,
        // Auto-add session/distinct ID headers to same-origin fetch requests
        // This enables server-side events to link to session replays
        __add_tracing_headers: [window.location.hostname],
      })
      Sentry.logger.info("posthog_client_initialized", {
        consent_feature_flag: CONSENT_FEATURE_FLAG,
        tracing_header_host: window.location.hostname,
      })

      if (CONSENT_FEATURE_FLAG) {
        const storedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY)
        Sentry.logger.info("posthog_client_consent_loaded", {
          consent_state: storedConsent ?? "unset",
        })

        if (storedConsent === "granted") {
          posthog.opt_in_capturing()
          Sentry.logger.info("posthog_client_opt_in_applied")
        }

        if (storedConsent === "denied") {
          posthog.opt_out_capturing()
          Sentry.logger.info("posthog_client_opt_out_applied")
        }
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { area: "posthog-client-init" },
      })
      Sentry.logger.error("posthog_client_init_failed", {
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
