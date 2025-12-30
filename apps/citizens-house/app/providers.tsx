"use client"

import { Suspense, useEffect } from "react"
import { SWRConfig } from "swr"
import { NearWalletProvider } from "@near-citizens/shared"
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
