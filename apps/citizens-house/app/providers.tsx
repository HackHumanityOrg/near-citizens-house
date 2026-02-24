"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { SWRConfig } from "swr"
import { NearWalletProvider } from "@/lib"
import { ErrorBoundary } from "@near-citizens/ui"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { env } from "@/lib/schemas/env"

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
          <ErrorBoundary>{children}</ErrorBoundary>
        </NearWalletProvider>
      </SWRConfig>
    </PostHogProvider>
  )
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return

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
        // Keep exception/error tracking in Sentry instead of PostHog.
        capture_exceptions: false,
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
        // Prevent the recorder from auto-starting on init. The posthog-recorder.js
        // script and initial DOM snapshot are deferred until after window.load below,
        // so they don't compete with page hydration for the main thread.
        disable_session_recording: true,
        // Console log recording - captures console.log, console.warn, console.error in session replays
        enable_recording_console_log: true,
        // Consent mode (opt-out behavior)
        opt_out_capturing_by_default: false,
        // Keep remote config (needed for replay config), but skip feature flag evaluation
        advanced_disable_feature_flags: true,
        // Auto-add session/distinct ID headers to same-origin fetch requests
        // This enables server-side events to link to session replays
        __add_tracing_headers: [window.location.hostname],
      })

      if (CONSENT_FEATURE_FLAG) {
        const storedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY)

        if (storedConsent === "granted") {
          posthog.opt_in_capturing()
        }

        if (storedConsent === "denied") {
          posthog.opt_out_capturing()
        }
      }

      // Start session recording only after the page has fully loaded so the
      // recorder script fetch and initial DOM serialization don't block
      // interactive content. posthog.startSessionRecording() still respects
      // any opt-out captured above.
      const startRecording = () => posthog.startSessionRecording()
      if (document.readyState === "complete") {
        startRecording()
      } else {
        window.addEventListener("load", startRecording, { once: true })
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
