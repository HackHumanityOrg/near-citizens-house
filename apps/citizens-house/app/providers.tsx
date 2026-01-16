"use client"

import { useEffect, useRef } from "react"
import { SWRConfig } from "swr"
import { NearWalletProvider, useNearWallet } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react"
import { AnalyticsProperties, redactSensitiveFields } from "@/lib/analytics-schema"

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
          <ErrorBoundary>
            {/* Global PostHog identification based on NEAR wallet connection */}
            <PostHogIdentifier />
            {children}
          </ErrorBoundary>
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
        before_send: (event) => {
          if (!event || typeof event.event !== "string") return event
          if (event.event.startsWith("$")) return event

          return {
            ...event,
            properties: redactSensitiveFields(event.properties || {}),
            $set: redactSensitiveFields(event.$set || {}),
            $set_once: redactSensitiveFields(event.$set_once || {}),
          }
        },
        // Debug mode in development - enables verbose logging
        loaded: (posthog) => {
          if (process.env.NODE_ENV === "development") {
            posthog.debug()
          }
        },
      })

      // Register super properties that apply to all events
      posthog.register({
        environment: process.env.NODE_ENV,
        near_network: process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet",
        self_network: process.env.NEXT_PUBLIC_SELF_NETWORK || "mainnet",
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
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

/**
 * Global PostHog identification component.
 * Automatically identifies users by their NEAR wallet address when connected.
 * This ensures all events are attributed to the correct user, even on page reload.
 */
export function PostHogIdentifier() {
  const posthog = usePostHog()
  const { accountId, isConnected } = useNearWallet()
  const identifiedAccountRef = useRef<string | null>(null)
  const aliasedAccountsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!posthog) return

    if (isConnected && accountId) {
      // Only identify if we haven't already identified this account
      if (identifiedAccountRef.current !== accountId) {
        const currentDistinctId = posthog.get_distinct_id()

        if (currentDistinctId && !aliasedAccountsRef.current.has(accountId)) {
          posthog.alias(accountId, currentDistinctId)
          aliasedAccountsRef.current.add(accountId)
        }

        // PostHog identify() signature: identify(distinctId, userPropertiesToSet, userPropertiesToSetOnce)
        posthog.identify(
          accountId,
          // Properties to $set (updated on every identify)
          {
            [AnalyticsProperties.nearAccount]: accountId,
            [AnalyticsProperties.nearNetwork]: process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet",
          },

          // Properties to $set_once (only set if not already set)
          {
            [AnalyticsProperties.firstConnectedAt]: new Date().toISOString(),
            [AnalyticsProperties.firstConnectedUrl]: typeof window !== "undefined" ? window.location.href : "",
          },
        )
        identifiedAccountRef.current = accountId
      }
    } else if (!isConnected && identifiedAccountRef.current) {
      // User disconnected - reset PostHog to anonymous state
      posthog.reset()
      identifiedAccountRef.current = null
      aliasedAccountsRef.current.clear()
    }
  }, [posthog, accountId, isConnected])

  return null
}
