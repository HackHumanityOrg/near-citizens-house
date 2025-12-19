"use client"

import { useEffect } from "react"
import { USERJOT_CONFIG } from "./config"

// Declare UserJot types for TypeScript
declare global {
  interface Window {
    $ujq: unknown[]
    uj: {
      init: (projectId: string, options?: { widget?: boolean }) => void
      identify: (userId: string, traits?: Record<string, unknown>) => void
    }
  }
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
    // Skip if no project ID configured or already initialized
    if (!USERJOT_CONFIG.enabled || typeof window === "undefined") {
      return
    }

    // Check if script is already loaded
    if (document.querySelector('script[src*="userjot.com"]')) {
      return
    }

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

    // Load UserJot SDK
    const script = document.createElement("script")
    script.src = "https://cdn.userjot.com/sdk/v2/uj.js"
    script.type = "module"
    script.async = true
    document.head.appendChild(script)

    // Initialize widget with project ID
    window.uj.init(USERJOT_CONFIG.projectId, { widget: true })
  }, [])

  return null
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
