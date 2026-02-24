"use client"

import { useEffect } from "react"
import Script from "next/script"
import { USERJOT_CONFIG } from "../config"

// Declare UserJot types for TypeScript
declare global {
  interface Window {
    $ujq: unknown[]
    uj: {
      init: (projectId: string, options?: { widget?: boolean }) => void
      identify: (userId: string, traits?: Record<string, unknown>) => void
      setWidgetEnabled?: (enabled: boolean) => void
    }
  }
}

const USERJOT_SCRIPT_SRC = "https://cdn.userjot.com/sdk/v2/uj.js"
let hasInitializedUserJot = false

function initializeUserJotWidget() {
  if (typeof window === "undefined") {
    return
  }

  if (hasInitializedUserJot) {
    return
  }

  hasInitializedUserJot = true

  // Initialize UserJot queue
  window.$ujq = window.$ujq || []
  window.uj =
    window.uj ||
    (new Proxy(
      {},
      {
        get:
          (_, prop: string) =>
          (...args: unknown[]) =>
            window.$ujq.push([prop, ...args]),
      },
    ) as Window["uj"])

  // Initialize widget with project ID
  if (typeof window.uj.init === "function") {
    window.uj.init(USERJOT_CONFIG.projectId, { widget: true })
    return
  }

  window.$ujq.push(["init", USERJOT_CONFIG.projectId, { widget: true }])
}

/**
 * UserJot Widget Component
 *
 * Integrates the UserJot feedback widget into the application.
 * The widget allows users to submit feedback, view the roadmap,
 * and stay updated with changelogs without leaving the app.
 *
 * @see https://userjot.com/knowledge/widget/quickstart
 */
export function UserJotWidget() {
  useEffect(() => {
    if (!USERJOT_CONFIG.enabled) {
      return
    }
    initializeUserJotWidget()
  }, [])

  if (!USERJOT_CONFIG.enabled) {
    return null
  }

  return (
    <Script
      id="userjot-sdk"
      src={USERJOT_SCRIPT_SRC}
      type="module"
      strategy="lazyOnload"
      onLoad={initializeUserJotWidget}
    />
  )
}

/**
 * Identify a user in UserJot
 *
 * Call this function after a user signs in to associate their feedback
 * with their account. This enables personalized feedback tracking.
 *
 * @param userId - Unique identifier for the user (e.g., NEAR account ID)
 * @param traits - Optional user traits for segmentation
 */
export function identifyUserJotUser(userId: string, traits?: Record<string, unknown>) {
  if (!USERJOT_CONFIG.enabled || typeof window === "undefined") {
    return
  }

  if (window.uj) {
    window.uj.identify(userId, traits)
  }
}
