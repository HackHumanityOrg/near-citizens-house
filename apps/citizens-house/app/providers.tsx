"use client"

import { useEffect } from "react"
import { SWRConfig } from "swr"
import { NearWalletProvider } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

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
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: "https://us.posthog.com",
        // Use latest config defaults (enables strictMinimumDuration and content_ignorelist for rageclicks)
        defaults: "2025-11-30",
        // Pageview handling - defaults: "2025-11-30" sets capture_pageview: 'history_change' automatically
        capture_pageleave: true,
        // Dead click capture - tracks clicks on non-responsive elements
        capture_dead_clicks: true,
        // Exception autocapture - captures uncaught errors via window.onerror and unhandledrejection
        capture_exceptions: true,
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
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}
