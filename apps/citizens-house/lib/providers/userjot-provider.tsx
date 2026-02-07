"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { USERJOT_CONFIG } from "../config"

let hasLoggedUserJotDisabled = false

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
      if (!USERJOT_CONFIG.enabled && !hasLoggedUserJotDisabled) {
        hasLoggedUserJotDisabled = true
        Sentry.logger.warn("userjot_widget_disabled_missing_project_id")
      }
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
    script.onload = () => {
      Sentry.logger.info("userjot_sdk_loaded")
    }
    script.onerror = () => {
      Sentry.logger.error("userjot_sdk_load_failed", {
        script_src: script.src,
      })
    }
    document.head.appendChild(script)

    // Initialize widget with project ID
    try {
      window.uj.init(USERJOT_CONFIG.projectId, { widget: true })
      Sentry.logger.info("userjot_widget_initialized", {
        project_id: USERJOT_CONFIG.projectId,
      })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { area: "userjot-widget-init" },
      })
      Sentry.logger.error("userjot_widget_init_failed", {
        project_id: USERJOT_CONFIG.projectId,
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
    }
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
    Sentry.logger.info("userjot_user_identified", { user_id: userId })
  } else {
    Sentry.logger.warn("userjot_identify_skipped_widget_unavailable", { user_id: userId })
  }
}
