"use client"

import { Suspense, useEffect, useRef } from "react"
import { SWRConfig } from "swr"
import { NearWalletProvider, useNearWallet } from "@near-citizens/shared"
import { ErrorBoundary } from "@near-citizens/ui"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react"
import { usePathname, useSearchParams } from "next/navigation"

interface ProvidersProps {
  children: React.ReactNode
}

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
            <Suspense fallback={null}>
              <PostHogPageview />
            </Suspense>
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
        ui_host: "https://us.i.posthog.com",
        // Use latest config defaults
        defaults: "2025-11-30",
        // Pageview handling
        capture_pageview: false, // Manual capture for SPA
        capture_pageleave: true,
        // Exception autocapture - captures $exception events via window.onerror and onunhandledrejection
        capture_exceptions: true,
        // Heatmaps - captures mouse movements, clicks, rageclicks, and scroll depth
        enable_heatmaps: true,
        // Session recording configuration
        disable_session_recording: false,
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
      })

      // Register super properties that apply to all events
      posthog.register({
        environment: process.env.NODE_ENV,
        near_network: process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet",
        self_network: process.env.NEXT_PUBLIC_SELF_NETWORK || "mainnet",
        app_version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

export function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + "?" + searchParams.toString()
      }
      posthog.capture("$pageview", { $current_url: url })
    }
  }, [pathname, searchParams, posthog])

  return null
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

  useEffect(() => {
    if (!posthog) return

    if (isConnected && accountId) {
      // Only identify if we haven't already identified this account
      if (identifiedAccountRef.current !== accountId) {
        // PostHog identify() signature: identify(distinctId, userPropertiesToSet, userPropertiesToSetOnce)
        posthog.identify(
          accountId,
          // Properties to $set (updated on every identify)
          {
            near_account: accountId,
            wallet_type: "near",
            near_network: process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet",
          },
          // Properties to $set_once (only set if not already set)
          {
            first_connected_at: new Date().toISOString(),
            first_connected_url: typeof window !== "undefined" ? window.location.href : "",
          },
        )
        identifiedAccountRef.current = accountId
      }
    } else if (!isConnected && identifiedAccountRef.current) {
      // User disconnected - reset PostHog to anonymous state
      posthog.reset()
      identifiedAccountRef.current = null
    }
  }, [posthog, accountId, isConnected])

  return null
}
